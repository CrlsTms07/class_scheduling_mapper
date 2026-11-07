<?php

namespace App\Services;

use App\Models\Building;
use App\Models\Room;
use App\Models\ScheduleEntry;
use App\Models\SchoolTerm;
use App\Models\Section;
use App\Models\User;
use App\Support\ScheduleFormat;
use Illuminate\Support\Facades\DB;

/**
 * The Schedule page's way in: buildings, their rooms, and the sections in each room.
 * A section is in a room if it is its home room, or if it has classes there this term.
 */
class ScheduleMapService
{
    /**
     * @return array{buildings: array<int, array<string, mixed>>, unassigned: array<int, array<string, mixed>>}
     */
    public function forTerm(SchoolTerm $term, User $user): array
    {
        $statuses = DB::table('section_term_status')->where('term_id', $term->id)->pluck('status', 'section_id');

        $sections = Section::visibleTo($user)
            ->with(['gradeLevel', 'adviser'])
            ->where('school_year_id', $term->school_year_id)
            ->get()
            ->sortBy(fn (Section $section) => [$section->gradeLevel->grade, $section->name])
            ->values();

        $usedRooms = ScheduleEntry::where('term_id', $term->id)
            ->where('status', '<>', 'rejected')
            ->whereIn('section_id', $sections->pluck('id'))
            ->whereNotNull('room_id')
            ->select('section_id', 'room_id')
            ->distinct()
            ->get()
            ->groupBy('section_id')
            ->map(fn ($rows) => $rows->pluck('room_id')->all());

        $roomsOf = fn (Section $section) => array_values(array_unique(array_filter([
            $section->home_room_id,
            ...($usedRooms[$section->id] ?? []),
        ])));

        $summary = fn (Section $section) => [
            'id' => $section->id,
            'name' => $section->name,
            'grade' => $section->gradeLevel->grade,
            'level' => $section->gradeLevel->level,
            'adviser' => $section->adviser?->printedName(),
            'status' => $statuses[$section->id] ?? 'not_started',
        ];

        $buildings = Building::with(['rooms' => fn ($query) => $query->orderBy('room_number')])
            ->orderBy('name')
            ->get()
            ->map(fn (Building $building) => [
                'id' => $building->id,
                'name' => $building->name,
                'rooms' => $building->rooms
                    ->map(fn (Room $room) => [
                        'id' => $room->id,
                        'room_number' => $room->room_number,
                        'room_name' => $room->room_name,
                        'is_active' => $room->is_active,
                        'sections' => $sections
                            ->filter(fn (Section $section) => in_array($room->id, $roomsOf($section)))
                            ->map($summary)
                            ->values(),
                    ])
                    // A room no longer in use only shows if a section still has classes there.
                    ->filter(fn (array $room) => $room['is_active'] || $room['sections']->isNotEmpty())
                    ->values(),
            ])
            ->filter(fn (array $building) => $building['rooms']->isNotEmpty())
            ->values()
            ->all();

        return [
            'buildings' => $buildings,
            'unassigned' => $sections
                ->filter(fn (Section $section) => $roomsOf($section) === [])
                ->map($summary)
                ->values()
                ->all(),
        ];
    }

    /**
     * Who uses a room in a term, class by class. Schedulers can see others' classes here,
     * because a room is shared, but can only open the sections in their own grade levels.
     *
     * @return array<string, mixed>
     */
    public function roomSchedule(SchoolTerm $term, Room $room, User $user): array
    {
        $room->loadMissing('building');
        $inScope = $user->gradeLevelIdsInScope();

        $entries = ScheduleEntry::with(['section.gradeLevel', 'sectionSubject.subject', 'teacher'])
            ->where('term_id', $term->id)
            ->where('room_id', $room->id)
            ->where('status', '<>', 'rejected')
            ->orderBy('day_of_week')
            ->orderBy('start_time')
            ->get()
            ->map(fn (ScheduleEntry $entry) => [
                'id' => $entry->id,
                'day' => $entry->day_of_week,
                'start_time' => ScheduleFormat::shortTime($entry->start_time),
                'end_time' => ScheduleFormat::shortTime($entry->end_time),
                'minutes' => ScheduleFormat::minutesBetween($entry->start_time, $entry->end_time),
                'status' => $entry->status,
                'subject' => $entry->sectionSubject?->subject->name,
                'teacher' => $entry->teacher?->printedName(),
                'section_id' => $entry->section_id,
                'section' => $entry->section->label(),
                'can_open' => in_array($entry->section->grade_level_id, $inScope),
            ])
            ->values();

        return [
            'room' => [
                'id' => $room->id,
                'label' => $room->label(),
                'room_name' => $room->room_name,
                'capacity' => $room->capacity,
                'building' => $room->building->name,
            ],
            'sections' => $entries->pluck('section')->unique()->values(),
            'entries' => $entries,
        ];
    }
}
