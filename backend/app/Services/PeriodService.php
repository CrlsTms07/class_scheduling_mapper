<?php

namespace App\Services;

use App\Models\DayPattern;
use App\Models\SchoolYear;
use App\Models\Section;
use App\Models\TimeSlot;
use App\Models\User;
use App\Support\ScheduleFormat;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Typed times, for building a schedule by hand from the start. A time that matches a period of
 * the section's bell schedule uses that period. A new time becomes a new period (or break) of the
 * bell schedule, so the conflict rules, the Class Program and Auto-fill keep working the same way.
 * A day with no bell schedule yet gets one. A time that overlaps another period or a break is refused.
 */
class PeriodService
{
    private const DAY_NAMES = [1 => 'Monday', 2 => 'Tuesday', 3 => 'Wednesday', 4 => 'Thursday', 5 => 'Friday'];

    public function __construct(private TimeSlotService $slots) {}

    /**
     * @param  array<int, int>  $days
     * @return array<int, int> the time slot used on each day
     */
    public function resolve(Section $section, array $days, string $start, string $end, bool $isBreak, ?string $label, User $user): array
    {
        $start = substr($start, 0, 5);
        $end = substr($end, 0, 5);

        if ($end <= $start) {
            throw ValidationException::withMessages(['end_time' => 'The end time must be after the start time.']);
        }

        return DB::transaction(function () use ($section, $days, $start, $end, $isBreak, $label, $user) {
            $section->loadMissing('gradeLevel');
            $this->coverDays($section, $days, $user);

            $used = [];
            foreach ($days as $day) {
                $pattern = $this->patternsOf($section)->first(fn (DayPattern $item) => in_array((int) $day, $item->day_numbers, true));
                $used[(int) $day] = $this->slotIn($pattern, $start, $end, $isBreak, $label, $user)->id;
            }

            return $used;
        });
    }

    /** Days with no bell schedule for the section's department and shift get one, together. */
    private function coverDays(Section $section, array $days, User $user): void
    {
        $patterns = $this->patternsOf($section);
        $covered = $patterns->flatMap(fn (DayPattern $pattern) => $pattern->day_numbers)->all();
        // With no bell schedule at all, start with the whole week, like most schools.
        $missing = $patterns->isEmpty() ? [1, 2, 3, 4, 5] : array_values(array_diff(array_map('intval', $days), $covered));

        if ($missing === []) {
            return;
        }

        sort($missing);
        $this->slots->createPattern(SchoolYear::findOrFail($section->school_year_id), [
            'level' => $section->gradeLevel->level,
            'shift' => $section->shift,
            'name' => $this->nameOf($missing),
            'days' => $missing,
        ], $user);
    }

    private function slotIn(DayPattern $pattern, string $start, string $end, bool $isBreak, ?string $label, User $user): TimeSlot
    {
        $same = $pattern->timeSlots->first(fn (TimeSlot $slot) => substr($slot->start_time, 0, 5) === $start && substr($slot->end_time, 0, 5) === $end);

        if ($same) {
            if ($same->is_break !== $isBreak) {
                $this->refuse($same, $pattern);
            }

            return $same;
        }

        $overlapping = $pattern->timeSlots->first(fn (TimeSlot $slot) => substr($slot->start_time, 0, 5) < $end && substr($slot->end_time, 0, 5) > $start);
        if ($overlapping) {
            $this->refuse($overlapping, $pattern);
        }

        $slot = $this->slots->addSlot($pattern, [
            'is_break' => $isBreak,
            'label' => $isBreak ? ($label ?: 'Break') : null,
            'start_time' => $start,
            'end_time' => $end,
        ], $user);
        $pattern->load('timeSlots');

        return $slot->fresh();
    }

    private function refuse(TimeSlot $slot, DayPattern $pattern): never
    {
        $name = $slot->is_break ? ($slot->label ?: 'a break') : "Period {$slot->period_no}";
        $from = ScheduleFormat::time($slot->start_time);
        $to = ScheduleFormat::time($slot->end_time);

        throw ValidationException::withMessages([
            'start_time' => "This overlaps {$name} ({$from} – {$to}) of the {$pattern->name} bell schedule. Choose a time that fits around it, or pick that period.",
        ]);
    }

    private function patternsOf(Section $section)
    {
        return DayPattern::where('school_year_id', $section->school_year_id)
            ->where('level', $section->gradeLevel->level)
            ->where('shift', $section->shift)
            ->with('timeSlots')
            ->orderBy('id')
            ->get();
    }

    /** "Monday – Friday", "Monday – Thursday" or "Tuesday, Friday". */
    private function nameOf(array $days): string
    {
        $isRun = $days === range($days[0], end($days));

        return count($days) === 1
            ? self::DAY_NAMES[$days[0]]
            : ($isRun ? self::DAY_NAMES[$days[0]].' – '.self::DAY_NAMES[end($days)] : implode(', ', array_map(fn ($day) => self::DAY_NAMES[$day], $days)));
    }
}
