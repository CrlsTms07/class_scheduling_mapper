<?php

namespace App\Services;

use App\Exports\ReportSheet;
use App\Models\DayPattern;
use App\Models\ScheduleEntry;
use App\Models\SchoolTerm;
use App\Models\Section;
use App\Support\ScheduleFormat;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;

class ReportService
{
    public function __construct(private ReportSettingsService $settings) {}

    /**
     * @param  bool  $isPublic  the public copy names only the adviser and co-adviser
     */
    public function classProgramPdf(SchoolTerm $term, Section $section, bool $isPublic = false): string
    {
        $section->loadMissing('gradeLevel');

        // JHS has one block per bell schedule. SHS has one column per day, like its official form.
        $view = $section->gradeLevel->level === 'SHS' ? 'reports.class-program-shs' : 'reports.class-program-jhs';

        return $this->renderPdf($view, [...$this->classProgramData($term, $section), 'isPublic' => $isPublic]);
    }

    /**
     * Forms are A4, with their page numbers in the document control block.
     *
     * @param  array<string, mixed>  $data
     */
    public function renderPdf(string $view, array $data, string $orientation = 'portrait'): string
    {
        $pdf = Pdf::loadView($view, $data)->setPaper('a4', $orientation);

        $pdf->render();

        [$x, $y] = $orientation === 'landscape' ? [788, 559] : [541, 806];
        $pdf->getCanvas()->page_text($x, $y, '{PAGE_NUM} of {PAGE_COUNT}', null, 6.5, [0, 0, 0]);

        return $pdf->output();
    }

    /**
     * The settings of one form. A setting for the department wins over one for all departments.
     */
    public function documentSettings(string $reportType, ?string $level): ?object
    {
        return DB::table('report_settings')
            ->where('report_type', $reportType)
            ->where(fn ($query) => $query->whereNull('level')->when($level, fn ($inner) => $inner->orWhere('level', $level)))
            ->orderByRaw('level IS NULL')
            ->first();
    }

    /**
     * @return array<string, mixed>
     */
    public function classProgramData(SchoolTerm $term, Section $section): array
    {
        $section->loadMissing(['gradeLevel', 'adviser', 'coAdviser']);
        $term->loadMissing('schoolYear');

        $entries = ScheduleEntry::with(['sectionSubject.subject', 'teacher', 'room.building'])
            ->where('term_id', $term->id)
            ->where('section_id', $section->id)
            ->where('status', '<>', 'rejected')
            ->get();

        $settings = $this->documentSettings('class_program', $section->gradeLevel->level);

        return [
            'school' => DB::table('school_profile')->first(),
            'logos' => $this->settings->logoDataUris(),
            'title' => $this->title($settings?->title_format, $section),
            'term' => $term,
            'section' => $section,
            'adviser' => $section->adviser?->printedName(),
            'coAdviser' => $section->coAdviser?->printedName(),
            'settings' => $settings,
            'blocks' => $this->blocks($section, $entries),
            'weekly' => $section->gradeLevel->level === 'SHS' ? $this->weeklyTable($section, $entries) : null,
            'signatories' => $this->signatories($term, 'class_program', $section->gradeLevel->level, [
                'section_adviser' => $section->adviser?->printedName(),
            ]),
            'isDraft' => $entries->isEmpty() || $entries->contains(fn (ScheduleEntry $entry) => $entry->status !== 'approved'),
        ];
    }

    private function title(?string $format, Section $section): string
    {
        return strtr($format ?? '{level} GRADE {grade} – CLASS PROGRAM', [
            '{level}' => $section->gradeLevel->level,
            '{grade}' => $section->gradeLevel->grade,
        ]);
    }

    /**
     * One block per day pattern, such as Monday – Thursday and Friday.
     *
     * @return array<int, array<string, mixed>>
     */
    private function blocks(Section $section, Collection $entries): array
    {
        return DayPattern::forSection($section)
            ->with('timeSlots')
            ->orderBy('id')
            ->get()
            ->map(function (DayPattern $pattern) use ($entries) {
                $rows = $pattern->timeSlots->map(function ($slot) use ($pattern, $entries) {
                    $slotEntries = $entries->filter(fn (ScheduleEntry $entry) => in_array($entry->day_of_week, $pattern->day_numbers)
                        && $entry->start_time === $slot->start_time);

                    return [
                        'time' => $this->printedTime($slot->start_time).' – '.$this->printedTime($slot->end_time),
                        'minutes' => ScheduleFormat::minutesBetween($slot->start_time, $slot->end_time),
                        'is_break' => $slot->is_break,
                        'subject' => $slot->is_break
                            ? strtoupper((string) $slot->label)
                            : $slotEntries->map(fn ($entry) => $entry->sectionSubject?->subject->name)->filter()->unique()->implode(' / '),
                        'teacher' => $slotEntries->map(fn ($entry) => $entry->teacher?->printedName())->filter()->unique()->implode(' / '),
                    ];
                })->values();

                $totalMinutes = $rows->sum('minutes');

                return [
                    'name' => $pattern->name,
                    'rows' => $rows,
                    'total_minutes' => $totalMinutes,
                    'class_minutes' => $rows->where('is_break', false)->sum('minutes'),
                    'duration' => ScheduleFormat::duration($totalMinutes),
                ];
            })
            ->all();
    }

    /**
     * A section's approved week, for the public Guest view. Teachers stay private there.
     *
     * @return array<string, mixed>
     */
    public function approvedWeek(SchoolTerm $term, Section $section): array
    {
        $entries = ScheduleEntry::with(['sectionSubject.subject', 'teacher', 'room.building'])
            ->where('term_id', $term->id)
            ->where('section_id', $section->id)
            ->where('status', 'approved')
            ->get();

        $week = $this->weeklyTable($section, $entries);

        foreach ($week['rows'] as &$row) {
            foreach ($row['cells'] as $day => $cell) {
                if ($cell !== null) {
                    unset($row['cells'][$day]['teacher']);
                }
            }
        }

        return $week;
    }

    /**
     * The SHS form: one row per period or break, one column per day.
     *
     * A day's total counts its breaks, as the official form does, but a day with
     * no classes yet stays at zero.
     *
     * @return array<string, mixed>
     */
    private function weeklyTable(Section $section, Collection $entries): array
    {
        $patterns = DayPattern::forSection($section)->with('timeSlots')->orderBy('id')->get();

        $patternOf = [];
        foreach ($patterns as $pattern) {
            foreach ($pattern->day_numbers as $day) {
                $patternOf[$day] = $pattern;
            }
        }

        $slots = $patterns
            ->flatMap(fn (DayPattern $pattern) => $pattern->timeSlots)
            ->unique(fn ($slot) => "{$slot->start_time}|{$slot->end_time}")
            ->sortBy(['start_time', 'end_time'])
            ->values();

        $rows = $slots->map(function ($slot) use ($patternOf, $entries) {
            $cells = [];
            $breaks = [];
            $days = [];

            foreach ([1, 2, 3, 4, 5] as $day) {
                $daySlot = ($patternOf[$day] ?? null)?->timeSlots
                    ->first(fn ($other) => $other->start_time === $slot->start_time && $other->end_time === $slot->end_time);

                if ($daySlot) {
                    $days[] = $day;
                }

                if ($daySlot?->is_break) {
                    $breaks[$day] = mb_strtoupper((string) $daySlot->label);
                }

                // Both ends must match: two bell schedules can start a period at the same time.
                $entry = $entries->first(fn (ScheduleEntry $item) => $item->day_of_week === $day
                    && $item->start_time === $slot->start_time
                    && $item->end_time === $slot->end_time);

                $cells[$day] = $entry ? [
                    'subject' => $entry->sectionSubject?->subject->name,
                    'teacher' => $entry->teacher?->printedName(),
                    'room' => $entry->room?->label(),
                ] : null;
            }

            return [
                'start_time' => $slot->start_time,
                'end_time' => $slot->end_time,
                'time' => $this->printedTime($slot->start_time).' - '.$this->printedTime($slot->end_time),
                'minutes' => ScheduleFormat::minutesBetween($slot->start_time, $slot->end_time),
                'days' => $days,
                'cells' => $cells,
                'breaks' => $breaks,
                // The same break on all five days prints as one wide row.
                'wide_break' => count($breaks) === 5 && count(array_unique($breaks)) === 1 ? reset($breaks) : null,
            ];
        })->all();

        $totals = [];
        foreach ([1, 2, 3, 4, 5] as $day) {
            $classMinutes = $entries
                ->where('day_of_week', $day)
                ->sum(fn (ScheduleEntry $entry) => ScheduleFormat::minutesBetween($entry->start_time, $entry->end_time));

            $breakMinutes = $classMinutes > 0 && isset($patternOf[$day])
                ? $patternOf[$day]->timeSlots
                    ->where('is_break', true)
                    ->sum(fn ($slot) => ScheduleFormat::minutesBetween($slot->start_time, $slot->end_time))
                : 0;

            $totals[$day] = $classMinutes + $breakMinutes;
        }

        return [
            'days' => array_map(fn (int $day) => ['day' => $day, 'name' => ScheduleFormat::dayName($day)], [1, 2, 3, 4, 5]),
            'patterns' => $patterns
                ->map(fn (DayPattern $pattern) => ['name' => $pattern->name, 'days' => $pattern->day_numbers])
                ->values()
                ->all(),
            'rows' => $rows,
            'totals' => array_map(fn (int $minutes) => $minutes > 0 ? ScheduleFormat::duration($minutes) : '–', $totals),
        ];
    }

    /**
     * The official form prints times without AM or PM, such as "12:50 – 2:10".
     */
    private function printedTime(string $time): string
    {
        return date('g:i', strtotime($time));
    }

    /**
     * Who signs a form, in order. A signatory without a typed name takes it from
     * what the form is about, such as the adviser of the section.
     *
     * @param  array<string, string|null>  $autoNames
     * @return array<int, array<string, string|null>>
     */
    public function signatories(SchoolTerm $term, string $reportType, ?string $level, array $autoNames = []): array
    {
        return DB::table('report_signatories')
            ->where('term_id', $term->id)
            ->where(fn ($query) => $query->where('report_type', $reportType)->orWhereNull('report_type'))
            ->where(fn ($query) => $query->whereNull('level')->when($level, fn ($inner) => $inner->orWhere('level', $level)))
            ->orderBy('sort_order')
            ->get()
            ->map(fn ($signatory) => [
                'label' => $signatory->label,
                'name' => $signatory->auto_source ? ($autoNames[$signatory->auto_source] ?? null) : $signatory->name,
                'position' => $signatory->position,
            ])
            ->all();
    }

    /**
     * The Class Program as a worksheet: one block per bell schedule, side by side.
     *
     * @param  array<string, mixed>  $data
     */
    public function classProgramSheet(array $data): ReportSheet
    {
        if ($data['weekly'] !== null) {
            return $this->weeklySheet($data);
        }

        $blocks = $data['blocks'];
        $lastColumn = max(1, count($blocks) * 5 - 1);
        $lastLetter = Coordinate::stringFromColumnIndex($lastColumn);

        $rows = [
            [$data['school']?->school_name],
            [$data['title']],
            ["{$data['term']->name}, School Year {$data['term']->schoolYear->name}"],
            ["GRADE {$data['section']->gradeLevel->grade} – ".mb_strtoupper($data['section']->name)],
            ['Class Adviser: '.($data['adviser'] ?? '')],
            ...($data['coAdviser'] ? [['Co-Adviser: '.$data['coAdviser']]] : []),
            [],
        ];

        $headerRow = count($rows) + 1;
        $header = [];
        foreach ($blocks as $index => $block) {
            if ($index > 0) {
                $header[] = '';
            }
            array_push($header, 'TIME', 'No. of Mins.', mb_strtoupper($block['name']), 'TEACHER');
        }
        $rows[] = $header;

        $shaded = [];
        $rowCount = collect($blocks)->max(fn (array $block) => count($block['rows'])) ?? 0;

        for ($index = 0; $index < $rowCount; $index++) {
            $cells = [];
            foreach ($blocks as $blockIndex => $block) {
                if ($blockIndex > 0) {
                    $cells[] = '';
                }

                $row = $block['rows'][$index] ?? null;
                array_push($cells, $row['time'] ?? '', $row['minutes'] ?? '', $row['subject'] ?? '', $row['teacher'] ?? '');

                if ($row['is_break'] ?? false) {
                    $first = $blockIndex * 5 + 1;
                    $number = count($rows) + 1;
                    $shaded[] = Coordinate::stringFromColumnIndex($first).$number.':'.Coordinate::stringFromColumnIndex($first + 3).$number;
                }
            }
            $rows[] = $cells;
        }

        $lastTableRow = count($rows);
        $bordered = [];
        $headers = [];
        foreach (array_keys($blocks) as $blockIndex) {
            $from = Coordinate::stringFromColumnIndex($blockIndex * 5 + 1);
            $to = Coordinate::stringFromColumnIndex($blockIndex * 5 + 4);
            $bordered[] = "{$from}{$headerRow}:{$to}{$lastTableRow}";
            $headers[] = "{$from}{$headerRow}:{$to}{$headerRow}";
        }

        $rows[] = [];
        foreach ($blocks as $block) {
            $rows[] = ["{$block['name']}: {$block['total_minutes']} minutes ({$block['duration']}), of which {$block['class_minutes']} minutes are class time"];
        }

        if ($data['settings']?->reference_note) {
            $rows[] = [$data['settings']->reference_note];
        }

        $rows[] = [];
        foreach ($data['signatories'] as $signatory) {
            $rows[] = ["{$signatory['label']}: {$signatory['name']}".($signatory['position'] ? ", {$signatory['position']}" : '')];
        }

        $merged = array_map(fn (int $row) => "A{$row}:{$lastLetter}{$row}", range(1, 5));
        foreach (range($lastTableRow + 1, count($rows)) as $row) {
            if (($rows[$row - 1][0] ?? null) !== null) {
                $merged[] = "A{$row}:{$lastLetter}{$row}";
            }
        }

        return new ReportSheet(
            title: $data['section']->name,
            rows: $rows,
            merged: $merged,
            centered: ["A1:{$lastLetter}5"],
            bordered: $bordered,
            headers: $headers,
            shaded: $shaded,
            columnWidths: array_merge(...array_map(
                fn (int $index) => $index > 0 ? [3, 14, 7, 24, 24] : [14, 7, 24, 24],
                array_keys($blocks ?: [0]),
            )),
        );
    }

    /**
     * The SHS form as a worksheet: one row per period or break, one column per day.
     *
     * @param  array<string, mixed>  $data
     */
    private function weeklySheet(array $data): ReportSheet
    {
        $weekly = $data['weekly'];

        $rows = [
            [$data['school']?->school_name],
            [$data['title']],
            ["{$data['term']->name}, School Year {$data['term']->schoolYear->name}"],
            [mb_strtoupper($data['section']->name)],
            ['Class Adviser: '.($data['adviser'] ?? '')],
            ...($data['coAdviser'] ? [['Co-Adviser: '.$data['coAdviser']]] : []),
            [],
            ['TIME', 'NO. OF MINUTES', ...array_map(fn (array $day) => mb_strtoupper($day['name']), $weekly['days'])],
        ];
        $headerRow = count($rows);

        $merged = array_map(fn (int $row) => "A{$row}:G{$row}", range(1, 5));
        $shaded = [];

        foreach ($weekly['rows'] as $row) {
            $number = count($rows) + 1;

            $cells = array_map(function (int $day) use ($row) {
                if (isset($row['breaks'][$day])) {
                    return $row['breaks'][$day];
                }

                return implode("\n", array_filter($row['cells'][$day] ?? []));
            }, [1, 2, 3, 4, 5]);

            if ($row['wide_break'] !== null) {
                $cells = [$row['wide_break'], '', '', '', ''];
                $merged[] = "C{$number}:G{$number}";
                $shaded[] = "A{$number}:G{$number}";
            } else {
                foreach (array_keys($row['breaks']) as $day) {
                    $column = Coordinate::stringFromColumnIndex($day + 2);
                    $shaded[] = "{$column}{$number}";
                }
            }

            $rows[] = [$row['time'], $row['minutes'], ...$cells];
        }

        $rows[] = ['Total Time Duration', '', ...array_values($weekly['totals'])];
        $lastTableRow = count($rows);
        $merged[] = "A{$lastTableRow}:B{$lastTableRow}";
        $firstBelow = $lastTableRow + 1;

        if ($data['settings']?->reference_note) {
            $rows[] = [$data['settings']->reference_note];
        }

        $rows[] = [];

        foreach ($data['signatories'] as $signatory) {
            $rows[] = ["{$signatory['label']}: {$signatory['name']}".($signatory['position'] ? ", {$signatory['position']}" : '')];
        }

        foreach (range($firstBelow, max($firstBelow, count($rows))) as $row) {
            if (($rows[$row - 1][0] ?? null) !== null) {
                $merged[] = "A{$row}:G{$row}";
            }
        }

        return new ReportSheet(
            title: $data['section']->name,
            rows: $rows,
            merged: $merged,
            centered: ['A1:G5'],
            bordered: ["A{$headerRow}:G{$lastTableRow}"],
            headers: ["A{$headerRow}:G{$headerRow}"],
            shaded: $shaded,
            columnWidths: [14, 9, 24, 24, 24, 24, 24],
        );
    }
}
