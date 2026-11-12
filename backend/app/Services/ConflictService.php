<?php

namespace App\Services;

use App\Models\DayPattern;
use App\Models\Room;
use App\Models\ScheduleEntry;
use App\Models\Section;
use App\Models\Subject;
use App\Models\Teacher;
use App\Models\TimeSlot;
use App\Support\ScheduleFormat;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

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
            ->with(['section.gradeLevel', 'sectionSubject.subject', 'activity', 'teacher', 'room.building'])
            ->orderBy('day_of_week')
            ->get();

        // The same clash on several days becomes one message that lists the days.
        $groups = [];

        foreach ($entries as $entry) {
            if ((int) $entry->teacher_id === $teacherId) {
                $this->addToGroup($groups, 'teacher', "{$entry->teacher->printedName()} is teaching {$entry->section->labelFor(withArticle: true)}", $entry);
            }

            if ((int) $entry->room_id === $roomId) {
                $this->addToGroup($groups, 'room', "{$entry->room->label()} is used by {$entry->section->labelFor(withArticle: true)}", $entry);
            }
        }

        return array_map(fn (array $group) => [
            'type' => $group['type'],
            'days' => $group['days'],
            'message' => "{$group['what']} on {$this->dayList($group['days'])} at {$group['time']}.",
            // The same facts one by one, so the screen can show them its own way.
            'section' => $group['section'],
            'subject' => $group['subject'],
            'time' => $group['range'],
        ], array_values($groups));
    }

    /**
     * Teaching personnel who are free at this time, for when the chosen teacher is not.
     * Those who already teach this subject in the term come first, then the lightest load.
     *
     * @param  array<int, int>  $days
     * @return array<int, array{id: int, name: string, teaches_subject: bool, hours_per_week: float}>
     */
    public function availableTeachers(int $termId, Section $section, array $days, string $start, string $end, int $exceptTeacherId, ?int $subjectId = null): array
    {
        $busy = $this->overlapping($termId, $days, $start, $end)
            ->whereNotNull('teacher_id')
            ->pluck('teacher_id')
            ->push($exceptTeacherId)
            ->unique()
            ->all();

        $subjectName = $subjectId ? Subject::whereKey($subjectId)->value('name') : null;

        $teachesIt = $subjectName === null ? collect() : DB::table('section_subjects')
            ->join('subjects', 'subjects.id', '=', 'section_subjects.subject_id')
            ->where('section_subjects.term_id', $termId)
            ->where('subjects.name', $subjectName)
            ->pluck('section_subjects.teacher_id')
            ->flip();

        $minutes = DB::table('section_subjects')
            ->join('subjects', 'subjects.id', '=', 'section_subjects.subject_id')
            ->where('section_subjects.term_id', $termId)
            ->groupBy('section_subjects.teacher_id')
            ->selectRaw('section_subjects.teacher_id, SUM(subjects.minutes_per_week) AS minutes')
            ->pluck('minutes', 'teacher_id');

        return Teacher::where('personnel_type', 'teaching')
            ->where('is_active', true)
            ->whereNotIn('id', $busy)
            ->when($section->shift !== 'WHOLE_DAY', fn (Builder $query) => $query->whereIn('shift', [$section->shift, 'WHOLE_DAY']))
            ->get()
            ->sortBy([
                fn (Teacher $a, Teacher $b) => $teachesIt->has($b->id) <=> $teachesIt->has($a->id),
                fn (Teacher $a, Teacher $b) => (int) ($minutes[$a->id] ?? 0) <=> (int) ($minutes[$b->id] ?? 0),
                fn (Teacher $a, Teacher $b) => [$a->last_name, $a->first_name, $a->id] <=> [$b->last_name, $b->first_name, $b->id],
            ])
            ->take(5)
            ->map(fn (Teacher $teacher) => [
                'id' => $teacher->id,
                'name' => $teacher->printedName(),
                'teaches_subject' => $teachesIt->has($teacher->id),
                'hours_per_week' => round(((int) ($minutes[$teacher->id] ?? 0)) / 60, 1),
            ])
            ->values()
            ->all();
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
                ->with(['section.gradeLevel', 'sectionSubject.subject', 'activity', 'teacher'])
                ->get();

            foreach ($busy as $other) {
                $this->addToGroup($groups, 'teacher', "{$other->teacher->printedName()} is teaching {$other->section->labelFor(withArticle: true)}", $other);
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
        $viewer = auth()->user();
        $subject = ! $viewer || $entry->section->isVisibleTo($viewer) ? ($entry->subjectName() ?? 'Open slot') : 'a class';
        $key = "{$type}|{$what}|{$subject}|{$entry->start_time}";

        $groups[$key]['type'] = $type;
        $groups[$key]['what'] = $what;
        $groups[$key]['time'] = ScheduleFormat::time($entry->start_time);
        $groups[$key]['range'] = ScheduleFormat::time($entry->start_time).' – '.ScheduleFormat::time($entry->end_time);
        $groups[$key]['section'] = $entry->section->labelFor();
        $groups[$key]['subject'] = $subject;
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
     * @return array{rooms: array<int, array<string, mixed>>, slots: array<int, array<string, mixed>>, teachers: array<int, array<string, mixed>>}
     */
    public function suggest(int $termId, Section $section, TimeSlot $slot, int $teacherId, int $roomId, array $days, ?int $subjectId = null): array
    {
        $teachers = $this->availableTeachers($termId, $section, $days, $slot->start_time, $slot->end_time, $teacherId, $subjectId);

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

        return ['rooms' => $rooms, 'slots' => $slots, 'teachers' => $teachers];
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
