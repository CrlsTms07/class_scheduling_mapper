<?php

namespace App\Services;

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
            'status' => DB::table('section_term_status')
                ->where('term_id', $termId)
                ->where('section_id', $section->id)
                ->value('status'),
            'can_plot' => $user->can('plot', $section),
            'patterns' => $this->patterns($section),
            'loading' => $this->loading($section, $termId),
            'entries' => $this->entries($section, $termId),
            'rooms' => Room::with('building')
                ->where('is_active', true)
                ->orderBy('room_number')
                ->get()
                ->map(fn (Room $room) => ['id' => $room->id, 'label' => $room->label()])
                ->values(),
            'flags' => $this->flags->forSection($section, $termId),
        ];
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
                'subject' => $loading->subject->name,
                'is_priority' => $loading->subject->is_priority,
                'required_minutes' => $loading->subject->minutes_per_week,
                'scheduled_minutes' => (int) ($scheduled[$loading->id] ?? 0),
                'teacher' => $loading->teacher->printedName(),
            ])
            ->values();
    }

    private function entries(Section $section, int $termId)
    {
        return ScheduleEntry::with(['sectionSubject.subject', 'teacher', 'room.building'])
            ->where('term_id', $termId)
            ->where('section_id', $section->id)
            ->where('status', '<>', 'rejected')
            ->get()
            ->map(fn (ScheduleEntry $entry) => [
                'id' => $entry->id,
                'day' => $entry->day_of_week,
                'start_time' => ScheduleFormat::shortTime($entry->start_time),
                'end_time' => ScheduleFormat::shortTime($entry->end_time),
                'status' => $entry->status,
                'section_subject_id' => $entry->section_subject_id,
                'subject' => $entry->sectionSubject?->subject->name,
                'teacher' => $entry->teacher?->printedName(),
                'room_id' => $entry->room_id,
                'room' => $entry->room?->label(),
            ])
            ->values();
    }
}
