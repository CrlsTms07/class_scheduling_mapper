<?php

namespace App\Services;

use App\Models\DayPattern;
use App\Models\ScheduleEntry;
use App\Models\Section;
use App\Support\ScheduleFormat;
use Illuminate\Support\Facades\DB;

/**
 * Soft rules: the entry is saved but flagged. Flags are worked out on every read,
 * so they can never go out of date.
 */
class FlagService
{
    /**
     * @return array<int, array{type: string, severity: string, message: string, section_subject_id?: int}>
     */
    public function forSection(Section $section, int $termId): array
    {
        return [
            ...$this->adviser($section),
            ...$this->minutes($section, $termId),
            ...$this->openSlots($section, $termId),
            ...$this->breaksAndShifts($section, $termId),
            ...$this->overloadedTeachers($section, $termId),
        ];
    }

    private function adviser(Section $section): array
    {
        return $section->adviser_id ? [] : [[
            'type' => 'no_adviser',
            'severity' => 'amber',
            'message' => 'This section has no adviser.',
        ]];
    }

    private function minutes(Section $section, int $termId): array
    {
        $rows = DB::table('subject_minutes_check')
            ->where('term_id', $termId)
            ->where('section_id', $section->id)
            ->whereColumn('scheduled_minutes', '<>', 'required_minutes')
            ->orderBy('subject')
            ->get();

        return $rows->map(fn ($row) => [
            'type' => $row->scheduled_minutes > $row->required_minutes ? 'minutes_over' : 'minutes_under',
            'severity' => $row->scheduled_minutes > $row->required_minutes ? 'red' : 'amber',
            'message' => "{$row->subject}: {$row->scheduled_minutes} of {$row->required_minutes} minutes scheduled.",
            'section_subject_id' => $row->section_subject_id,
        ])->all();
    }

    private function openSlots(Section $section, int $termId): array
    {
        $count = ScheduleEntry::where('term_id', $termId)
            ->where('section_id', $section->id)
            ->whereNull('section_subject_id')
            ->count();

        return $count === 0 ? [] : [[
            'type' => 'open_slots',
            'severity' => 'amber',
            'message' => "{$count} open ".($count === 1 ? 'slot is' : 'slots are').' still unfilled.',
        ]];
    }

    /**
     * Normally impossible from the plotter. These catch entries left behind when a bell schedule changes.
     */
    private function breaksAndShifts(Section $section, int $termId): array
    {
        $patterns = DayPattern::forSection($section)->with('timeSlots')->get();
        $flags = [];

        $entries = ScheduleEntry::with('teacher')
            ->where('term_id', $termId)
            ->where('section_id', $section->id)
            ->where('status', '<>', 'rejected')
            ->get();

        foreach ($entries as $entry) {
            $when = ScheduleFormat::dayName($entry->day_of_week).' at '.ScheduleFormat::time($entry->start_time);
            $pattern = $patterns->first(fn (DayPattern $item) => in_array($entry->day_of_week, $item->day_numbers));

            $overlapsBreak = $pattern?->timeSlots->contains(fn ($slot) => $slot->is_break
                && $slot->start_time < $entry->end_time
                && $slot->end_time > $entry->start_time);

            if ($overlapsBreak) {
                $flags[] = ['type' => 'overlaps_break', 'severity' => 'red', 'message' => "The entry on {$when} overlaps a break."];
            }

            if ($pattern && ! $pattern->timeSlots->contains(fn ($slot) => $slot->start_time <= $entry->start_time && $slot->end_time >= $entry->end_time)) {
                $flags[] = ['type' => 'outside_shift', 'severity' => 'red', 'message' => "The entry on {$when} is outside the section's bell schedule."];
            }

            if ($entry->teacher && $this->isOutsideTeacherShift($entry, $section)) {
                $flags[] = [
                    'type' => 'teacher_shift',
                    'severity' => 'amber',
                    'message' => "{$entry->teacher->printedName()} has the {$entry->teacher->shift} shift, but teaches on {$when}.",
                ];
            }
        }

        return $flags;
    }

    private function isOutsideTeacherShift(ScheduleEntry $entry, Section $section): bool
    {
        if ($entry->teacher->shift === 'WHOLE_DAY') {
            return false;
        }

        $slots = DayPattern::where('school_year_id', $section->school_year_id)
            ->where('level', $section->gradeLevel->level)
            ->where('shift', $entry->teacher->shift)
            ->get()
            ->filter(fn (DayPattern $pattern) => in_array($entry->day_of_week, $pattern->day_numbers))
            ->flatMap(fn (DayPattern $pattern) => $pattern->timeSlots);

        // No bell schedule for that shift means there is nothing to compare with.
        if ($slots->isEmpty()) {
            return false;
        }

        return $entry->start_time < $slots->min('start_time') || $entry->end_time > $slots->max('end_time');
    }

    private function overloadedTeachers(Section $section, int $termId): array
    {
        $rows = DB::table('teacher_load')
            ->join('section_subjects', function ($join) use ($termId, $section) {
                $join->on('section_subjects.teacher_id', '=', 'teacher_load.teacher_id')
                    ->where('section_subjects.term_id', $termId)
                    ->where('section_subjects.section_id', $section->id);
            })
            ->join('teachers', 'teachers.id', '=', 'teacher_load.teacher_id')
            ->where('teacher_load.term_id', $termId)
            ->where('teacher_load.is_overloaded', true)
            ->select('teachers.first_name', 'teachers.last_name', 'teachers.display_name', 'teacher_load.subject_count', 'teacher_load.max_subjects')
            ->distinct()
            ->get();

        return $rows->map(fn ($row) => [
            'type' => 'teacher_overloaded',
            'severity' => 'amber',
            'message' => ($row->display_name ?: "{$row->first_name} {$row->last_name}")." has {$row->subject_count} classes (limit {$row->max_subjects}).",
        ])->all();
    }
}
