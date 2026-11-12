<?php

namespace App\Services;

use App\Models\Activity;
use App\Models\DayPattern;
use App\Models\Room;
use App\Models\ScheduleEntry;
use App\Models\Section;
use App\Models\SectionSubject;
use App\Models\User;
use App\Support\ScheduleFormat;
use Illuminate\Support\Facades\DB;

/**
 * Gathers everything the plotter screen needs for one section in one term.
 */
class PlotterService
{
    public function __construct(private FlagService $flags) {}

    /**
     * @return array<string, mixed>
     */
    public function forSection(Section $section, int $termId, User $user): array
    {
        $section->loadMissing(['gradeLevel', 'adviser', 'homeRoom.building']);

        $status = DB::table('section_term_status')
            ->where('term_id', $termId)
            ->where('section_id', $section->id)
            ->value('status');

        $canPlot = $user->can('plot', $section);

        return [
            'section' => [
                'id' => $section->id,
                'name' => $section->name,
                'label' => $section->label(),
                'level' => $section->gradeLevel->level,
                'grade' => $section->gradeLevel->grade,
                'shift' => $section->shift,
                'adviser' => $section->adviser?->printedName(),
                'home_room_id' => $section->home_room_id,
            ],
            'status' => $status,
            'can_plot' => $canPlot,
            'can_edit' => $canPlot && in_array($status, ['not_started', 'draft']),
            'last_review' => $this->lastReview($section, $termId),
            'patterns' => $this->patterns($section),
            'loading' => $this->loading($section, $termId),
            'entries' => $this->entries($section, $termId, $status),
            'rooms' => Room::with('building')
                ->where('is_active', true)
                ->orderBy('room_number')
                ->get()
                ->map(fn (Room $room) => ['id' => $room->id, 'label' => $room->label()])
                ->values(),
            'flags' => $this->flags->forSection($section, $termId),
            'activities' => Activity::where('school_year_id', $section->school_year_id)
                ->orderBy('name')
                ->get(['id', 'name'])
                ->toArray(),
            'last_auto_fill' => $this->lastAutoFill($section, $termId),
            // How many sections "Apply to" reaches, for its labels.
            'apply_counts' => [
                'grade' => Section::visibleTo($user)->where('school_year_id', $section->school_year_id)
                    ->where('grade_level_id', $section->grade_level_id)->count(),
                'all' => Section::visibleTo($user)->where('school_year_id', $section->school_year_id)->count(),
            ],
        ];
    }

    /**
     * The latest auto-fill run that still has entries in this section, so it can be undone.
     *
     * @return array{id: int, created_at: string, entries: int}|null
     */
    private function lastAutoFill(Section $section, int $termId): ?array
    {
        $run = DB::table('auto_fill_runs')
            ->join('schedule_entries', 'schedule_entries.auto_fill_run_id', '=', 'auto_fill_runs.id')
            ->where('auto_fill_runs.term_id', $termId)
            ->whereNull('auto_fill_runs.undone_at')
            ->where('schedule_entries.section_id', $section->id)
            ->groupBy('auto_fill_runs.id', 'auto_fill_runs.created_at')
            ->orderByDesc('auto_fill_runs.id')
            ->selectRaw('auto_fill_runs.id, auto_fill_runs.created_at, COUNT(*) AS entries')
            ->first();

        return $run ? ['id' => $run->id, 'created_at' => $run->created_at, 'entries' => (int) $run->entries] : null;
    }

    /**
     * The Admin's latest decision on this section's entries, with its remarks.
     *
     * @return array<string, mixed>|null
     */
    private function lastReview(Section $section, int $termId): ?array
    {
        $review = DB::table('schedule_reviews')
            ->join('users', 'users.id', '=', 'schedule_reviews.reviewed_by')
            ->whereIn('schedule_reviews.id', ScheduleEntry::where('term_id', $termId)
                ->where('section_id', $section->id)
                ->whereNotNull('review_id')
                ->select('review_id'))
            ->orderByDesc('schedule_reviews.id')
            ->first(['schedule_reviews.action', 'schedule_reviews.remarks', 'schedule_reviews.created_at', 'users.first_name', 'users.last_name']);

        return $review ? [
            'action' => $review->action,
            'remarks' => $review->remarks,
            'reviewed_by' => "{$review->first_name} {$review->last_name}",
            'created_at' => $review->created_at,
        ] : null;
    }

    private function patterns(Section $section)
    {
        return DayPattern::forSection($section)
            ->with('timeSlots')
            ->orderBy('id')
            ->get()
            ->map(fn (DayPattern $pattern) => [
                'id' => $pattern->id,
                'name' => $pattern->name,
                'days' => $pattern->day_numbers,
                'slots' => $pattern->timeSlots->map(fn ($slot) => [
                    'id' => $slot->id,
                    'period_no' => $slot->period_no,
                    'label' => $slot->label,
                    'start_time' => ScheduleFormat::shortTime($slot->start_time),
                    'end_time' => ScheduleFormat::shortTime($slot->end_time),
                    'minutes' => ScheduleFormat::minutesBetween($slot->start_time, $slot->end_time),
                    'is_break' => $slot->is_break,
                ])->values(),
            ])
            ->values();
    }

    private function loading(Section $section, int $termId)
    {
        $scheduled = DB::table('subject_minutes_check')
            ->where('term_id', $termId)
            ->where('section_id', $section->id)
            ->pluck('scheduled_minutes', 'section_subject_id');

        return SectionSubject::with(['subject', 'teacher'])
            ->where('term_id', $termId)
            ->where('section_id', $section->id)
            ->get()
            ->sortBy(fn (SectionSubject $loading) => [! $loading->subject->is_priority, $loading->subject->name])
            ->map(fn (SectionSubject $loading) => [
                'id' => $loading->id,
                'subject_id' => $loading->subject_id,
                'teacher_id' => $loading->teacher_id,
                'subject' => $loading->subject->name,
                'is_priority' => $loading->subject->is_priority,
                'required_minutes' => $loading->subject->minutes_per_week,
                'scheduled_minutes' => (int) ($scheduled[$loading->id] ?? 0),
                'teacher' => $loading->teacher->printedName(),
            ])
            ->values();
    }

    /**
     * Rejected entries are only shown while the section is rejected, so the
     * scheduler can see what the Admin was looking at.
     */
    private function entries(Section $section, int $termId, ?string $status)
    {
        return ScheduleEntry::with(['sectionSubject.subject', 'activity', 'teacher', 'room.building'])
            ->where('term_id', $termId)
            ->where('section_id', $section->id)
            ->when($status !== 'rejected', fn ($query) => $query->where('status', '<>', 'rejected'))
            ->get()
            ->map(fn (ScheduleEntry $entry) => [
                'id' => $entry->id,
                'day' => $entry->day_of_week,
                'start_time' => ScheduleFormat::shortTime($entry->start_time),
                'end_time' => ScheduleFormat::shortTime($entry->end_time),
                'status' => $entry->status,
                'section_subject_id' => $entry->section_subject_id,
                'activity_id' => $entry->activity_id,
                'auto_filled' => $entry->auto_fill_run_id !== null,
                'subject' => $entry->subjectName(),
                'teacher' => $entry->teacher?->printedName(),
                'room_id' => $entry->room_id,
                'room' => $entry->room?->label(),
            ])
            ->values();
    }
}
