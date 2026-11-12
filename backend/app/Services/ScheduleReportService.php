<?php

namespace App\Services;

use App\Exports\ReportSheet;
use App\Models\Room;
use App\Models\ScheduleEntry;
use App\Models\SchoolTerm;
use App\Models\Section;
use App\Models\Teacher;
use App\Models\User;
use App\Support\ScheduleFormat;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Teacher Program, Room Schedule and the room usage summary.
 *
 * Teachers and rooms cross departments, whose bell schedules differ. So these forms have
 * one row per class time actually used, instead of the rows of one bell schedule.
 */
class ScheduleReportService
{
    private const DAYS = [1, 2, 3, 4, 5];

    public function __construct(
        private ReportService $reports,
        private ReportSettingsService $settings,
    ) {}

    /**
     * What the Reports page offers this user to print.
     *
     * @return array<string, mixed>
     */
    public function options(SchoolTerm $term, User $user): array
    {
        $scope = $user->gradeLevelIdsInScope();

        $sections = Section::with('gradeLevel')
            ->where('school_year_id', $term->school_year_id)
            ->whereIn('grade_level_id', $scope)
            ->get()
            ->sortBy(fn (Section $section) => [$section->gradeLevel->grade, $section->name])
            ->map(fn (Section $section) => [
                'id' => $section->id,
                'label' => $section->label(),
                'level' => $section->gradeLevel->level,
            ])
            ->values();

        // Everyone with loading in this term, among the sections this user can reach.
        $teacherIds = DB::table('section_subjects')
            ->join('sections', 'sections.id', '=', 'section_subjects.section_id')
            ->where('section_subjects.term_id', $term->id)
            ->whereIn('sections.grade_level_id', $scope)
            ->pluck('section_subjects.teacher_id')
            ->unique();

        $teachers = Teacher::whereIn('id', $teacherIds)
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get()
            ->map(fn (Teacher $teacher) => ['id' => $teacher->id, 'label' => $teacher->printedName()])
            ->values();

        $rooms = Room::with('building')
            ->where('is_active', true)
            ->orderBy('building_id')
            ->orderBy('room_number')
            ->get()
            ->map(fn (Room $room) => ['id' => $room->id, 'label' => $room->label()])
            ->values();

        $grades = DB::table('grade_levels')->whereIn('id', $scope)->orderBy('grade')->pluck('grade');

        return ['sections' => $sections, 'teachers' => $teachers, 'rooms' => $rooms, 'grades' => $grades];
    }

    /**
     * @param  bool  $approvedOnly  a teacher's own view shows only what is final
     * @return array<string, mixed>
     */
    public function teacherProgram(SchoolTerm $term, Teacher $teacher, bool $approvedOnly = false): array
    {
        $term->loadMissing('schoolYear');

        $entries = $this->entries($term)
            ->where('teacher_id', $teacher->id)
            ->when($approvedOnly, fn ($query) => $query->where('status', 'approved'))
            ->get();

        $department = DB::table('departments')->where('id', $teacher->department_id)->value('name');
        $designation = DB::table('designations')->where('id', $teacher->designation_id)->value('name');
        $advisory = Section::with('gradeLevel')
            ->where('school_year_id', $term->school_year_id)
            ->where('adviser_id', $teacher->id)
            ->first();

        $entries = $entries->concat($this->activitiesFor($term, $advisory, $approvedOnly))
            ->sortBy(fn (ScheduleEntry $entry) => "{$entry->start_time}|{$entry->end_time}")
            ->values();

        return [
            ...$this->documentParts('teacher_program', 'TEACHER PROGRAM', $term, $entries),
            'heading' => mb_strtoupper($teacher->printedName()),
            'details' => array_values(array_filter([
                $designation,
                $department,
                $advisory ? "Adviser of {$advisory->label()}" : null,
            ])),
            'signatories' => $this->reports->signatories($term, 'teacher_program', null, ['teacher' => $teacher->printedName()]),
            ...$this->grid($entries, fn (ScheduleEntry $entry) => $entry->activity_id !== null
                ? [$entry->subjectName()]
                : ($this->isOwn($entry)
                    ? [$entry->section->label(), $entry->subjectName(), $entry->room?->label()]
                    : [$entry->section->labelFor()])),
        ];
    }

    /** Whether the person looking may see this class in full: their own department, or the Admin. */
    private function isOwn(ScheduleEntry $entry): bool
    {
        $viewer = auth()->user();

        return ! $viewer || $entry->section->isVisibleTo($viewer);
    }

    /**
     * Activities a teacher takes part in: those of their advisory class, and those that every
     * section of the school year has at the same time. Each shows once.
     *
     * @return Collection<int, ScheduleEntry>
     */
    private function activitiesFor(SchoolTerm $term, ?Section $advisory, bool $approvedOnly): Collection
    {
        $sectionCount = Section::where('school_year_id', $term->school_year_id)->count();

        $activities = $this->entries($term)
            ->whereNotNull('activity_id')
            ->when($approvedOnly, fn ($query) => $query->where('status', 'approved'))
            ->get();

        $keyOf = fn (ScheduleEntry $entry) => "{$entry->activity_id}|{$entry->day_of_week}|{$entry->start_time}|{$entry->end_time}";

        $everywhere = $activities->groupBy($keyOf)
            ->filter(fn (Collection $group) => $group->pluck('section_id')->unique()->count() === $sectionCount)
            ->keys()
            ->flip();

        return $activities
            ->filter(fn (ScheduleEntry $entry) => $entry->section_id === $advisory?->id || $everywhere->has($keyOf($entry)))
            ->unique($keyOf)
            ->values();
    }

    /**
     * @return array<string, mixed>
     */
    public function roomSchedule(SchoolTerm $term, Room $room): array
    {
        $term->loadMissing('schoolYear');
        $room->loadMissing('building');

        $entries = $this->entries($term)->where('room_id', $room->id)->get();

        return [
            ...$this->documentParts('room_schedule', 'ROOM SCHEDULE', $term, $entries),
            'heading' => mb_strtoupper($room->label()),
            'details' => array_values(array_filter([
                $room->room_name,
                $room->capacity ? "Capacity: {$room->capacity}" : null,
            ])),
            'signatories' => $this->reports->signatories($term, 'room_schedule', null),
            ...$this->grid($entries, fn (ScheduleEntry $entry) => $this->isOwn($entry)
                ? [$entry->section->label(), $entry->subjectName(), $entry->teacher?->printedName()]
                : [$entry->section->labelFor()]),
        ];
    }

    /**
     * Which sections use each room and building in a term.
     *
     * @return array<string, mixed>
     */
    /** With a building, only that building's rooms: the printout of the building view. */
    public function roomUsage(SchoolTerm $term, ?int $buildingId = null): array
    {
        $term->loadMissing('schoolYear');

        $usage = DB::table('room_usage')->where('term_id', $term->id)->get()->groupBy('room_id');
        $sections = Section::with('gradeLevel')
            ->whereIn('id', $usage->flatten(1)->pluck('section_id')->unique())
            ->get()
            ->keyBy('id');

        $rooms = Room::with('building')
            ->when($buildingId, fn ($query) => $query->where('building_id', $buildingId))
            ->orderBy('building_id')
            ->orderBy('room_number')
            ->get()
            ->filter(fn (Room $room) => $room->is_active || $usage->has($room->id));

        $buildings = $rooms->groupBy('building_id')->map(fn (Collection $group) => [
            'id' => $group->first()->building_id,
            'name' => $group->first()->building->name,
            'rooms' => $group->map(function (Room $room) use ($usage, $sections) {
                $rows = $usage->get($room->id, collect());

                return [
                    'id' => $room->id,
                    'room_number' => $room->room_number,
                    'room_name' => $room->room_name,
                    'periods_per_week' => (int) $rows->sum('periods_per_week'),
                    // Another department's sections are added up under its name.
                    'sections' => $rows
                        ->groupBy(fn ($row) => $sections[$row->section_id]->labelFor())
                        ->map(fn (Collection $group, string $label) => [
                            'label' => $label,
                            'periods_per_week' => (int) $group->sum('periods_per_week'),
                        ])
                        ->sortBy('label')
                        ->values()
                        ->all(),
                ];
            })->values()->all(),
        ])->values()->all();

        return [
            'title' => $buildingId && $rooms->isNotEmpty()
                ? mb_strtoupper($rooms->first()->building->name).' – ROOM USAGE'
                : 'ROOM AND BUILDING USAGE',
            'term' => $term,
            'term_label' => "{$term->name}, School Year {$term->schoolYear->name}",
            'buildings' => $buildings,
            'school' => DB::table('school_profile')->first(),
            'logos' => $this->settings->logoDataUris(),
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function gridPdf(array $data): string
    {
        return $this->reports->renderPdf('reports.schedule-grid', $data);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function usagePdf(array $data): string
    {
        return $this->reports->renderPdf('reports.room-usage', $data);
    }

    /**
     * The same document as the PDF, as a worksheet.
     *
     * @param  array<string, mixed>  $data
     */
    public function gridSheet(array $data, string $sheetTitle): ReportSheet
    {
        $rows = [
            [$data['school']?->school_name],
            [$data['title']],
            [$data['term_label']],
            [$data['heading']],
        ];

        if ($data['details'] !== []) {
            $rows[] = [implode(' · ', $data['details'])];
        }

        $titleRows = count($rows);
        $rows[] = [];

        $headerRow = count($rows) + 1;
        $rows[] = ['TIME', 'No. of Mins.', ...array_column($data['days'], 'name')];

        foreach ($data['rows'] as $row) {
            $rows[] = [
                $row['time'],
                $row['minutes'],
                ...array_map(
                    fn (int $day) => implode("\n\n", array_map(fn (array $lines) => implode("\n", array_filter($lines)), $row['cells'][$day])),
                    self::DAYS,
                ),
            ];
        }

        $rows[] = ['Total minutes', '', ...array_map(fn (int $day) => $data['totals']['per_day'][$day], self::DAYS)];
        $lastTableRow = count($rows);
        $rows[] = ["Total per week: {$data['totals']['week']} minutes ({$data['totals']['week_duration']})"];
        $weekRow = count($rows);

        if ($data['settings']?->reference_note) {
            $rows[] = [$data['settings']->reference_note];
        }

        $rows[] = [];

        foreach ($data['signatories'] as $signatory) {
            $rows[] = ["{$signatory['label']}: {$signatory['name']}".($signatory['position'] ? ", {$signatory['position']}" : '')];
        }

        $merged = array_map(fn (int $row) => "A{$row}:G{$row}", range(1, $titleRows));
        $merged[] = "A{$weekRow}:G{$weekRow}";

        foreach (range($weekRow + 1, count($rows)) as $row) {
            if (($rows[$row - 1][0] ?? null) !== null) {
                $merged[] = "A{$row}:G{$row}";
            }
        }

        return new ReportSheet(
            title: $sheetTitle,
            rows: $rows,
            merged: $merged,
            centered: ["A1:G{$titleRows}"],
            bordered: ["A{$headerRow}:G{$lastTableRow}"],
            headers: ["A{$headerRow}:G{$headerRow}"],
            columnWidths: [16, 8, 22, 22, 22, 22, 22],
        );
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function usageSheet(array $data): ReportSheet
    {
        $rows = [
            [$data['school']?->school_name],
            [$data['title']],
            [$data['term_label']],
            [],
            ['Building', 'Room', 'Sections', 'Periods per week'],
        ];

        foreach ($data['buildings'] as $building) {
            foreach ($building['rooms'] as $room) {
                $rows[] = [
                    $building['name'],
                    $room['room_number'].($room['room_name'] ? " – {$room['room_name']}" : ''),
                    implode("\n", array_map(fn (array $section) => "{$section['label']} ({$section['periods_per_week']})", $room['sections'])) ?: 'Not used',
                    $room['periods_per_week'],
                ];
            }
        }

        $last = count($rows);

        return new ReportSheet(
            title: 'Room Usage',
            rows: $rows,
            merged: ['A1:D1', 'A2:D2', 'A3:D3'],
            centered: ['A1:D3'],
            bordered: ["A5:D{$last}"],
            headers: ['A5:D5'],
            columnWidths: [24, 18, 40, 12],
        );
    }

    /**
     * What every form has around its table.
     *
     * @return array<string, mixed>
     */
    private function documentParts(string $reportType, string $defaultTitle, SchoolTerm $term, Collection $entries): array
    {
        $settings = $this->reports->documentSettings($reportType, null);

        return [
            'school' => DB::table('school_profile')->first(),
            'logos' => $this->settings->logoDataUris(),
            'title' => $settings?->title_format ?? $defaultTitle,
            'settings' => $settings,
            'term' => $term,
            'term_label' => "{$term->name}, School Year {$term->schoolYear->name}",
            'isDraft' => $entries->isEmpty() || $entries->contains(fn (ScheduleEntry $entry) => $entry->status !== 'approved'),
        ];
    }

    private function entries(SchoolTerm $term)
    {
        return ScheduleEntry::with(['section.gradeLevel', 'sectionSubject.subject', 'activity', 'teacher', 'room.building'])
            ->where('term_id', $term->id)
            ->where('status', '<>', 'rejected')
            ->orderBy('start_time')
            ->orderBy('end_time');
    }

    /**
     * One row per class time, one column per day. Minutes are added up from the entries,
     * so a total can never disagree with what is on the form.
     *
     * @return array<string, mixed>
     */
    private function grid(Collection $entries, callable $linesOf): array
    {
        $rows = $entries
            ->groupBy(fn (ScheduleEntry $entry) => "{$entry->start_time}|{$entry->end_time}")
            ->map(function (Collection $group) use ($linesOf) {
                $first = $group->first();

                $cells = [];
                foreach (self::DAYS as $day) {
                    $cells[$day] = $group->where('day_of_week', $day)->map($linesOf)->values()->all();
                }

                return [
                    'start_time' => ScheduleFormat::shortTime($first->start_time),
                    'end_time' => ScheduleFormat::shortTime($first->end_time),
                    'time' => ScheduleFormat::time($first->start_time).' – '.ScheduleFormat::time($first->end_time),
                    'minutes' => ScheduleFormat::minutesBetween($first->start_time, $first->end_time),
                    'cells' => $cells,
                ];
            })
            ->values()
            ->all();

        // Activities show on the form but are not teaching time.
        $minutesOn = fn (int $day) => $entries
            ->where('day_of_week', $day)
            ->whereNull('activity_id')
            ->sum(fn (ScheduleEntry $entry) => ScheduleFormat::minutesBetween($entry->start_time, $entry->end_time));

        $perDay = [];
        foreach (self::DAYS as $day) {
            $perDay[$day] = $minutesOn($day);
        }

        $week = array_sum($perDay);

        return [
            'days' => array_map(fn (int $day) => ['day' => $day, 'name' => ScheduleFormat::dayName($day)], self::DAYS),
            'rows' => $rows,
            'totals' => [
                'per_day' => $perDay,
                'week' => $week,
                'week_duration' => ScheduleFormat::duration($week),
            ],
        ];
    }
}
