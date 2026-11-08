<?php

namespace App\Services;

use App\Exports\ReportSheet;
use App\Models\DayPattern;
use App\Models\ScheduleEntry;
use App\Models\SchoolTerm;
use App\Models\Section;
use App\Models\SectionSubject;
use App\Models\Teacher;
use App\Models\User;
use App\Support\ScheduleFormat;
use Illuminate\Support\Facades\DB;

/**
 * Teacher Load Report and Grade Level Timetable: the whole picture at one glance.
 */
class SummaryReportService
{
    /** More sections than this on one row would not fit on the page. */
    private const SECTIONS_PER_TABLE = 6;

    public function __construct(
        private ReportService $reports,
        private ReportSettingsService $settings,
    ) {}

    /**
     * Everyone teaching in the user's grade levels, with their whole load in the term.
     *
     * @return array<string, mixed>
     */
    public function teacherLoad(SchoolTerm $term, User $user): array
    {
        $term->loadMissing('schoolYear');

        $inScope = DB::table('section_subjects')
            ->join('sections', 'sections.id', '=', 'section_subjects.section_id')
            ->where('section_subjects.term_id', $term->id)
            ->whereIn('sections.grade_level_id', $user->gradeLevelIdsInScope())
            ->pluck('section_subjects.teacher_id')
            ->unique();

        $loadings = SectionSubject::with(['subject', 'section.gradeLevel'])
            ->where('term_id', $term->id)
            ->whereIn('teacher_id', $inScope)
            ->get()
            ->groupBy('teacher_id');

        $minutes = ScheduleEntry::where('term_id', $term->id)
            ->whereIn('teacher_id', $inScope)
            ->where('status', '<>', 'rejected')
            ->get()
            ->groupBy('teacher_id')
            ->map(fn ($entries) => $entries->sum(fn (ScheduleEntry $entry) => ScheduleFormat::minutesBetween($entry->start_time, $entry->end_time)));

        $departments = DB::table('departments')->pluck('name', 'id');

        $teachers = Teacher::whereIn('id', $inScope)
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get()
            ->map(function (Teacher $teacher) use ($loadings, $minutes, $departments) {
                $load = $loadings->get($teacher->id, collect());
                $scheduled = (int) $minutes->get($teacher->id, 0);

                return [
                    'id' => $teacher->id,
                    'name' => $teacher->printedName(),
                    'department' => $departments[$teacher->department_id] ?? null,
                    'assigned' => $load->count(),
                    'limit' => $teacher->max_subjects,
                    'is_overloaded' => $load->count() > $teacher->max_subjects,
                    'minutes' => $scheduled,
                    'duration' => $scheduled > 0 ? ScheduleFormat::duration($scheduled) : '–',
                    'classes' => $load
                        ->map(fn (SectionSubject $row) => "{$row->section->label()}: {$row->subject->name}")
                        ->sort()
                        ->values()
                        ->all(),
                ];
            })
            ->values();

        return [
            'term_label' => "{$term->name}, School Year {$term->schoolYear->name}",
            'summary' => [
                'teachers' => $teachers->count(),
                'overloaded' => $teachers->where('is_overloaded', true)->count(),
            ],
            'teachers' => $teachers->all(),
        ];
    }

    /**
     * What every section of a grade has, period by period, with one table per bell schedule.
     *
     * @return array<string, mixed>
     */
    public function gradeTimetable(SchoolTerm $term, int $grade): array
    {
        $term->loadMissing('schoolYear');

        $sections = Section::with('gradeLevel')
            ->where('school_year_id', $term->school_year_id)
            ->whereHas('gradeLevel', fn ($level) => $level->where('grade', $grade))
            ->orderBy('name')
            ->get();

        $entries = ScheduleEntry::with(['sectionSubject.subject', 'teacher', 'room.building'])
            ->where('term_id', $term->id)
            ->whereIn('section_id', $sections->pluck('id'))
            ->where('status', '<>', 'rejected')
            ->get();

        return [
            'grade' => $grade,
            'title' => "GRADE {$grade} – TIMETABLE",
            'term_label' => "{$term->name}, School Year {$term->schoolYear->name}",
            'isDraft' => $entries->isEmpty() || $entries->contains(fn (ScheduleEntry $entry) => $entry->status !== 'approved'),
            'tables' => $this->tables($sections, $entries),
        ];
    }

    private function tables($sections, $entries): array
    {
        $patterns = [];

        foreach ($sections as $section) {
            foreach (DayPattern::forSection($section)->with('timeSlots')->orderBy('id')->get() as $pattern) {
                $patterns[$pattern->id] ??= ['pattern' => $pattern, 'sections' => []];
                $patterns[$pattern->id]['sections'][] = $section;
            }
        }

        $tables = [];

        foreach ($patterns as ['pattern' => $pattern, 'sections' => $withPattern]) {
            foreach (array_chunk($withPattern, self::SECTIONS_PER_TABLE) as $part) {
                $tables[] = [
                    'name' => $pattern->name,
                    'sections' => array_map(fn (Section $section) => ['id' => $section->id, 'label' => $section->name], $part),
                    'rows' => $pattern->timeSlots
                        ->map(fn ($slot) => $this->row($slot, $pattern, $part, $entries))
                        ->values()
                        ->all(),
                ];
            }
        }

        return $tables;
    }

    private function row($slot, DayPattern $pattern, array $sections, $entries): array
    {
        $cells = [];

        foreach ($sections as $section) {
            $cells[$section->id] = $slot->is_break ? [] : $this->cell($section, $slot, $pattern, $entries);
        }

        return [
            'key' => $slot->id,
            'time' => ScheduleFormat::time($slot->start_time).' – '.ScheduleFormat::time($slot->end_time),
            'minutes' => ScheduleFormat::minutesBetween($slot->start_time, $slot->end_time),
            'break' => $slot->is_break ? mb_strtoupper((string) $slot->label) : null,
            'cells' => $cells,
        ];
    }

    /**
     * One group per subject. A subject that is not on every day of the table says which days.
     *
     * @return array<int, array{subject: string, teacher: string|null, room: string|null, days: string|null}>
     */
    private function cell(Section $section, $slot, DayPattern $pattern, $entries): array
    {
        return $entries
            ->filter(fn (ScheduleEntry $entry) => $entry->section_id === $section->id
                && in_array($entry->day_of_week, $pattern->day_numbers)
                && $entry->start_time === $slot->start_time
                && $entry->end_time === $slot->end_time)
            ->groupBy(fn (ScheduleEntry $entry) => $entry->section_subject_id ?? 'open')
            ->map(function ($group) use ($pattern) {
                $first = $group->first();
                $isEveryDay = $group->count() === count($pattern->day_numbers);

                return [
                    'subject' => $first->sectionSubject?->subject->name ?? 'Open slot',
                    'teacher' => $first->teacher?->printedName(),
                    'room' => $first->room?->label(),
                    'days' => $isEveryDay ? null : $group
                        ->sortBy('day_of_week')
                        ->map(fn (ScheduleEntry $entry) => substr(ScheduleFormat::dayName($entry->day_of_week), 0, 3))
                        ->implode(', '),
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function teacherLoadPdf(array $data): string
    {
        return $this->reports->renderPdf('reports.teacher-load', [...$data, ...$this->letterhead('TEACHER LOAD REPORT')]);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function gradeTimetablePdf(array $data): string
    {
        return $this->reports->renderPdf('reports.grade-timetable', [...$data, ...$this->letterhead($data['title'])], 'landscape');
    }

    /**
     * @return array<string, mixed>
     */
    private function letterhead(string $title): array
    {
        return [
            'school' => DB::table('school_profile')->first(),
            'logos' => $this->settings->logoDataUris(),
            'title' => $title,
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function teacherLoadSheet(array $data): ReportSheet
    {
        $rows = [
            [DB::table('school_profile')->value('school_name')],
            ['TEACHER LOAD REPORT'],
            [$data['term_label']],
            [],
            ['Teacher', 'Department', 'Assigned', 'Limit', 'Minutes per week', 'Classes', 'Overloaded'],
        ];

        foreach ($data['teachers'] as $teacher) {
            $rows[] = [
                $teacher['name'], $teacher['department'], $teacher['assigned'], $teacher['limit'],
                $teacher['minutes'], implode("\n", $teacher['classes']), $teacher['is_overloaded'] ? 'Yes' : 'No',
            ];
        }

        $last = count($rows);

        return new ReportSheet(
            title: 'Teacher Load',
            rows: $rows,
            merged: ['A1:G1', 'A2:G2', 'A3:G3'],
            centered: ['A1:G3'],
            bordered: ["A5:G{$last}"],
            headers: ['A5:G5'],
            columnWidths: [28, 20, 10, 8, 12, 50, 12],
        );
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function gradeTimetableSheet(array $data): ReportSheet
    {
        $rows = [
            [DB::table('school_profile')->value('school_name')],
            [$data['title']],
            [$data['term_label']],
        ];

        $headers = [];
        $bordered = [];
        $width = 2 + self::SECTIONS_PER_TABLE;
        $lastColumn = chr(ord('A') + $width - 1);

        foreach ($data['tables'] as $table) {
            $rows[] = [];
            $rows[] = [$table['name']];

            $start = count($rows) + 1;
            $rows[] = ['Time', 'Mins', ...array_column($table['sections'], 'label')];
            $headers[] = "A{$start}:{$lastColumn}{$start}";

            foreach ($table['rows'] as $row) {
                $rows[] = [
                    $row['time'],
                    $row['minutes'],
                    ...array_map(fn (array $section) => $row['break'] ?? $this->cellText($row['cells'][$section['id']]), $table['sections']),
                ];
            }

            $bordered[] = "A{$start}:{$lastColumn}".count($rows);
        }

        return new ReportSheet(
            title: "Grade {$data['grade']}",
            rows: $rows,
            merged: ["A1:{$lastColumn}1", "A2:{$lastColumn}2", "A3:{$lastColumn}3"],
            centered: ["A1:{$lastColumn}3"],
            bordered: $bordered,
            headers: $headers,
            columnWidths: [20, 7, ...array_fill(0, self::SECTIONS_PER_TABLE, 24)],
        );
    }

    /**
     * @param  array<int, array<string, mixed>>  $cell
     */
    private function cellText(array $cell): string
    {
        return collect($cell)
            ->map(fn (array $group) => implode("\n", array_filter([
                $group['subject'].($group['days'] ? " ({$group['days']})" : ''),
                $group['teacher'],
                $group['room'],
            ])))
            ->implode("\n");
    }
}
