<?php

namespace App\Services;

use App\Models\DayPattern;
use App\Models\Room;
use App\Models\ScheduleEntry;
use App\Models\Section;
use App\Models\TimeSlot;
use App\Support\ScheduleFormat;
use Illuminate\Database\Eloquent\Builder;

/**
 * Checks hard conflicts before saving, to give a clear message. The PostgreSQL
 * exclusion constraints stay as the final guard against two users saving at once.
 */
class ConflictService
{
    /**
     * Entries of other sections that use the same teacher or room at the same time.
     *
     * @param  array<int, int>  $days
     * @return array<int, array<string, mixed>>
     */
    public function findConflicts(int $termId, Section $section, int $teacherId, int $roomId, array $days, string $start, string $end): array
    {
        $entries = $this->overlapping($termId, $days, $start, $end)
            ->where('section_id', '<>', $section->id)
            ->where(fn (Builder $query) => $query->where('teacher_id', $teacherId)->orWhere('room_id', $roomId))
            ->with(['section.gradeLevel', 'teacher', 'room.building'])
            ->orderBy('day_of_week')
            ->get();

        // The same clash on several days becomes one message that lists the days.
        $groups = [];

        foreach ($entries as $entry) {
            if ((int) $entry->teacher_id === $teacherId) {
                $this->addToGroup($groups, 'teacher', "{$entry->teacher->printedName()} is teaching {$entry->section->label()}", $entry);
            }

            if ((int) $entry->room_id === $roomId) {
                $this->addToGroup($groups, 'room', "{$entry->room->label()} is used by {$entry->section->label()}", $entry);
            }
        }

        return array_map(fn (array $group) => [
            'type' => $group['type'],
            'days' => $group['days'],
            'message' => "{$group['what']} on {$this->dayList($group['days'])} at {$group['time']}.",
        ], array_values($groups));
    }

    /**
     * Where a teacher is already busy at the times of these entries, in words. Used when a
     * subject that is already plotted moves to another teacher.
     *
     * @param  iterable<ScheduleEntry>  $entries
     * @return array<int, string>
     */
    public function teacherClashes(int $termId, int $teacherId, iterable $entries): array
    {
        $groups = [];

        foreach ($entries as $entry) {
            if ($entry->status === 'rejected') {
                continue;
            }

            $busy = $this->overlapping($termId, [$entry->day_of_week], $entry->start_time, $entry->end_time)
                ->where('teacher_id', $teacherId)
                ->with(['section.gradeLevel', 'teacher'])
                ->get();

            foreach ($busy as $other) {
                $this->addToGroup($groups, 'teacher', "{$other->teacher->printedName()} is teaching {$other->section->label()}", $other);
            }
        }

        return array_map(
            fn (array $group) => "{$group['what']} on {$this->dayList($group['days'])} at {$group['time']}.",
            array_values($groups),
        );
    }

    /**
     * @param  array<string, array<string, mixed>>  $groups
     */
    private function addToGroup(array &$groups, string $type, string $what, ScheduleEntry $entry): void
    {
        $key = "{$type}|{$what}|{$entry->start_time}";

        $groups[$key]['type'] = $type;
        $groups[$key]['what'] = $what;
        $groups[$key]['time'] = ScheduleFormat::time($entry->start_time);
        $groups[$key]['days'][] = $entry->day_of_week;
    }

    /**
     * [1, 2, 3] becomes "Monday, Tuesday and Wednesday".
     *
     * @param  array<int, int>  $days
     */
    private function dayList(array $days): string
    {
        $names = array_map(ScheduleFormat::dayName(...), $days);
        $last = array_pop($names);

        return $names === [] ? $last : implode(', ', $names)." and {$last}";
    }

    /**
     * Rooms that are free at this time, and other periods when the teacher and room are free.
     *
     * @param  array<int, int>  $days
     * @return array{rooms: array<int, array<string, mixed>>, slots: array<int, array<string, mixed>>}
     */
    public function suggest(int $termId, Section $section, TimeSlot $slot, int $teacherId, int $roomId, array $days): array
    {
        $usedRoomIds = $this->overlapping($termId, $days, $slot->start_time, $slot->end_time)
            ->where('section_id', '<>', $section->id)
            ->whereNotNull('room_id')
            ->pluck('room_id');

        $rooms = Room::with('building')
            ->where('is_active', true)
            ->whereNotIn('id', $usedRoomIds)
            ->orderBy('room_number')
            ->limit(5)
            ->get()
            ->map(fn (Room $room) => ['id' => $room->id, 'label' => $room->label()])
            ->values()
            ->all();

        $slots = DayPattern::find($slot->day_pattern_id)
            ->timeSlots()
            ->where('is_break', false)
            ->where('id', '<>', $slot->id)
            ->get()
            ->filter(fn (TimeSlot $other) => $this->isSlotFree($termId, $section, $other, $teacherId, $roomId, $days))
            ->take(3)
            ->map(fn (TimeSlot $other) => [
                'id' => $other->id,
                'label' => ScheduleFormat::time($other->start_time).' – '.ScheduleFormat::time($other->end_time),
            ])
            ->values()
            ->all();

        return ['rooms' => $rooms, 'slots' => $slots];
    }

    /**
     * @param  array<int, int>  $days
     */
    private function isSlotFree(int $termId, Section $section, TimeSlot $slot, int $teacherId, int $roomId, array $days): bool
    {
        return ! $this->overlapping($termId, $days, $slot->start_time, $slot->end_time)
            ->where(fn (Builder $query) => $query
                ->where('section_id', $section->id)
                ->orWhere('teacher_id', $teacherId)
                ->orWhere('room_id', $roomId))
            ->exists();
    }

    /**
     * Same term, same days, overlapping [start, end) time. Rejected entries do not count.
     *
     * @param  array<int, int>  $days
     */
    private function overlapping(int $termId, array $days, string $start, string $end): Builder
    {
        return ScheduleEntry::query()
            ->where('term_id', $termId)
            ->where('status', '<>', 'rejected')
            ->whereIn('day_of_week', $days)
            ->where('start_time', '<', $end)
            ->where('end_time', '>', $start);
    }
}
