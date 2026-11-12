<?php

namespace App\Services;

use App\Models\DayPattern;
use App\Models\SchoolYear;
use App\Models\TimeSlot;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * Bell schedules (day patterns) and their periods and breaks.
 *
 * A saved schedule entry keeps its own day and time, so changing a bell schedule could
 * leave entries that no longer match any period. That is why anything already used by a
 * schedule is locked. Period numbers are never typed: they follow the order of the day.
 */
class TimeSlotService
{
    public function __construct(private AuditLogger $audit) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function createPattern(SchoolYear $year, array $data, User $admin): DayPattern
    {
        return DB::transaction(function () use ($year, $data, $admin) {
            $pattern = DayPattern::create([
                'school_year_id' => $year->id,
                'level' => $data['level'],
                'shift' => $data['shift'],
                'name' => $data['name'],
                'days' => $this->daysToText($data['days']),
            ]);

            $this->audit->log($admin, 'create', 'day_patterns', $pattern->id, null, $data);

            return $pattern;
        });
    }

    /**
     * Renaming is always allowed. A day can be added freely, but a day with schedules stays.
     *
     * @param  array<string, mixed>  $data
     */
    public function updatePattern(DayPattern $pattern, array $data, User $admin): DayPattern
    {
        return DB::transaction(function () use ($pattern, $data, $admin) {
            $before = $pattern->only(['name', 'days']);
            $removedDays = array_diff($pattern->day_numbers, $data['days']);

            if ($removedDays !== []) {
                $users = $this->sectionsUsing($pattern, null, $removedDays);
                if ($users->isNotEmpty()) {
                    throw ValidationException::withMessages([
                        'days' => "A removed day already has schedules: {$users->join(', ')}.",
                    ]);
                }
            }

            $pattern->update(['name' => $data['name'], 'days' => $this->daysToText($data['days'])]);

            $this->audit->log($admin, 'update', 'day_patterns', $pattern->id, $before, $pattern->only(['name', 'days']));

            return $pattern;
        });
    }

    public function deletePattern(DayPattern $pattern, User $admin): void
    {
        DB::transaction(function () use ($pattern, $admin) {
            $reason = $this->whyLocked($pattern);
            if ($reason !== null) {
                throw ValidationException::withMessages(['pattern' => $reason]);
            }

            $before = $pattern->only(['name', 'level', 'shift', 'days']);
            $pattern->delete();

            $this->audit->log($admin, 'delete', 'day_patterns', $pattern->id, $before);
        });
    }

    /**
     * A new bell schedule with the same periods and breaks, for another level, shift or days.
     *
     * @param  array<string, mixed>  $data
     */
    public function copyPattern(DayPattern $source, array $data, User $admin): DayPattern
    {
        return DB::transaction(function () use ($source, $data, $admin) {
            $copy = DayPattern::create([
                'school_year_id' => $source->school_year_id,
                'level' => $data['level'],
                'shift' => $data['shift'],
                'name' => $data['name'],
                'days' => $this->daysToText($data['days']),
            ]);

            foreach ($source->timeSlots as $slot) {
                $copy->timeSlots()->create($slot->only(['period_no', 'label', 'start_time', 'end_time', 'is_break']));
            }

            $this->audit->log($admin, 'copy', 'day_patterns', $copy->id, null, ['copied_from' => $source->id, ...$data]);

            return $copy;
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function addSlot(DayPattern $pattern, array $data, User $admin): TimeSlot
    {
        return DB::transaction(function () use ($pattern, $data, $admin) {
            $slot = $pattern->timeSlots()->create($this->slotValues($data, $pattern));
            $this->renumberPeriods($pattern);

            $this->audit->log($admin, 'create', 'time_slots', $slot->id, null, $data);

            return $slot;
        });
    }

    /**
     * Fills an empty bell schedule from a preset, all rows or none.
     *
     * @param  array<int, array<string, mixed>>  $slots
     */
    public function addSlots(DayPattern $pattern, array $slots, User $admin): void
    {
        DB::transaction(function () use ($pattern, $slots, $admin) {
            foreach ($slots as $data) {
                $pattern->timeSlots()->create($this->slotValues($data, $pattern));
            }
            $this->renumberPeriods($pattern);

            $this->audit->log($admin, 'create', 'time_slots', $pattern->id, null, ['preset_rows' => count($slots)]);
        });
    }

    /**
     * The name of a slot can always change. Its times and type are locked once it has schedules.
     *
     * @param  array<string, mixed>  $data
     */
    public function updateSlot(TimeSlot $slot, array $data, User $admin): TimeSlot
    {
        return DB::transaction(function () use ($slot, $data, $admin) {
            $before = $slot->only(['label', 'start_time', 'end_time', 'is_break']);
            $sameTimes = substr($slot->start_time, 0, 5) === $data['start_time']
                && substr($slot->end_time, 0, 5) === $data['end_time']
                && $slot->is_break === (bool) $data['is_break'];

            if (! $sameTimes) {
                $this->stopIfUsed($slot, 'start_time');
            }

            $slot->update($this->slotValues($data, $slot->dayPattern));
            $this->renumberPeriods($slot->dayPattern);

            $this->audit->log($admin, 'update', 'time_slots', $slot->id, $before, $data);

            return $slot;
        });
    }

    public function deleteSlot(TimeSlot $slot, User $admin): void
    {
        DB::transaction(function () use ($slot, $admin) {
            $this->stopIfUsed($slot, 'slot');

            $pattern = $slot->dayPattern;
            $before = $slot->only(['label', 'start_time', 'end_time', 'is_break']);
            $slot->delete();
            $this->renumberPeriods($pattern);

            $this->audit->log($admin, 'delete', 'time_slots', $slot->id, $before);
        });
    }

    /**
     * Why a whole bell schedule cannot be deleted, in words for the Admin, or null if it can.
     */
    public function whyLocked(DayPattern $pattern): ?string
    {
        $users = $this->sectionsUsing($pattern);

        return $users->isEmpty() ? null : "These sections have schedules on it: {$users->join(', ')}.";
    }

    /**
     * Why a period or break cannot change, in words for the Admin, or null if it can.
     */
    public function whySlotLocked(TimeSlot $slot): ?string
    {
        $users = $this->sectionsUsing($slot->dayPattern, $slot);

        return $users->isEmpty() ? null : "These sections have schedules on it: {$users->join(', ')}.";
    }

    private function stopIfUsed(TimeSlot $slot, string $field): void
    {
        $reason = $this->whySlotLocked($slot);

        if ($reason !== null) {
            throw ValidationException::withMessages([$field => $reason]);
        }
    }

    /**
     * Sections with schedule entries on this bell schedule, or only on one slot or some days.
     *
     * @param  array<int, int>|null  $days
     * @return Collection<int, string>
     */
    private function sectionsUsing(DayPattern $pattern, ?TimeSlot $slot = null, ?array $days = null): Collection
    {
        return DB::table('schedule_entries')
            ->join('school_terms', 'school_terms.id', '=', 'schedule_entries.term_id')
            ->join('sections', 'sections.id', '=', 'schedule_entries.section_id')
            ->join('grade_levels', 'grade_levels.id', '=', 'sections.grade_level_id')
            ->where('school_terms.school_year_id', $pattern->school_year_id)
            ->where('grade_levels.level', $pattern->level)
            ->where('sections.shift', $pattern->shift)
            ->whereIn('schedule_entries.day_of_week', $days ?? $pattern->day_numbers)
            ->when($slot, fn ($query) => $query
                ->where('schedule_entries.start_time', '<', $slot->end_time)
                ->where('schedule_entries.end_time', '>', $slot->start_time))
            ->selectRaw("DISTINCT 'Grade ' || grade_levels.grade || ' ' || sections.name AS label, grade_levels.grade, sections.name")
            ->orderBy('grade_levels.grade')
            ->orderBy('sections.name')
            ->pluck('label');
    }

    /**
     * Period 1, 2, 3... in the order of the day. Breaks have no number.
     */
    private function renumberPeriods(DayPattern $pattern): void
    {
        $periods = $pattern->timeSlots()->where('is_break', false)->get();

        foreach ($periods as $index => $period) {
            $period->update(['period_no' => $index + 1]);
        }
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function slotValues(array $data, DayPattern $pattern): array
    {
        $isBreak = (bool) $data['is_break'];
        $label = trim($data['label'] ?? '');

        return [
            'is_break' => $isBreak,
            'label' => $label === '' ? null : $label,
            'start_time' => $data['start_time'],
            'end_time' => $data['end_time'],
            // A placeholder for a new period. renumberPeriods() gives the real number right after.
            'period_no' => $isBreak ? null : $pattern->timeSlots()->count() + 1,
        ];
    }

    /**
     * @param  array<int, int>  $days
     */
    private function daysToText(array $days): string
    {
        $sorted = array_map('intval', $days);
        sort($sorted);

        return '{'.implode(',', $sorted).'}';
    }
}
