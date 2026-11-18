<?php

namespace App\Http\Controllers;

use App\Models\ScheduleEntry;
use App\Models\SchoolTerm;
use App\Models\Teacher;
use App\Support\ScheduleFormat;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * One teacher's classes in a term, for the teacher detail page: each section with its subject,
 * and the day, time and room of every class. Another department's sections keep their name hidden.
 */
class TeacherScheduleController extends Controller
{
    public function show(Request $request, SchoolTerm $term, Teacher $teacher): JsonResponse
    {
        Gate::authorize('view-school-records');
        $viewer = $request->user();

        $entries = ScheduleEntry::with(['section.gradeLevel', 'sectionSubject.subject', 'room.building'])
            ->where('term_id', $term->id)
            ->where('teacher_id', $teacher->id)
            ->where('status', '<>', 'rejected')
            ->orderBy('day_of_week')
            ->orderBy('start_time')
            ->get();

        $classes = $entries
            ->groupBy(fn (ScheduleEntry $entry) => $entry->section_id.'|'.$entry->sectionSubject?->subject_id)
            ->map(function ($group) use ($viewer) {
                $first = $group->first();
                $isVisible = $first->section->isVisibleTo($viewer);

                return [
                    'section_id' => $isVisible ? $first->section_id : null,
                    'section' => $first->section->labelFor($viewer),
                    'subject' => $isVisible ? $first->sectionSubject?->subject?->name : null,
                    'minutes_per_week' => $group->sum(fn (ScheduleEntry $entry) => ScheduleFormat::minutesBetween($entry->start_time, $entry->end_time)),
                    'meetings' => $group->map(fn (ScheduleEntry $entry) => [
                        'day' => (int) $entry->day_of_week,
                        'start_time' => substr($entry->start_time, 0, 5),
                        'end_time' => substr($entry->end_time, 0, 5),
                        'minutes' => ScheduleFormat::minutesBetween($entry->start_time, $entry->end_time),
                        'room' => $entry->room?->label(),
                        'status' => $entry->status,
                    ])->values()->all(),
                ];
            })
            ->values();

        return response()->json(['data' => [
            'classes' => $classes,
            'minutes_per_week' => $classes->sum('minutes_per_week'),
        ]]);
    }
}
