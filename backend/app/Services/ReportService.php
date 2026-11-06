<?php

namespace App\Services;

use App\Models\DayPattern;
use App\Models\ScheduleEntry;
use App\Models\SchoolTerm;
use App\Models\Section;
use App\Support\ScheduleFormat;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ReportService
{
    public function classProgramPdf(SchoolTerm $term, Section $section): string
    {
        $pdf = Pdf::loadView('reports.class-program-jhs', $this->classProgramData($term, $section))
            ->setPaper('a4', 'portrait');

        $pdf->render();
        $pdf->getCanvas()->page_text(541, 806, '{PAGE_NUM} of {PAGE_COUNT}', null, 6.5, [0, 0, 0]);

        return $pdf->output();
    }

    /**
     * @return array<string, mixed>
     */
    public function classProgramData(SchoolTerm $term, Section $section): array
    {
        $section->loadMissing(['gradeLevel', 'adviser']);
        $term->loadMissing('schoolYear');

        $entries = ScheduleEntry::with(['sectionSubject.subject', 'teacher'])
            ->where('term_id', $term->id)
            ->where('section_id', $section->id)
            ->where('status', '<>', 'rejected')
            ->get();

        $settings = DB::table('report_settings')
            ->where('report_type', 'class_program')
            ->where(fn ($query) => $query->where('level', $section->gradeLevel->level)->orWhereNull('level'))
            ->orderByRaw('level IS NULL')
            ->first();

        return [
            'school' => DB::table('school_profile')->first(),
            'logo' => $this->logoDataUri(),
            'title' => $this->title($settings?->title_format, $section),
            'term' => $term,
            'section' => $section,
            'adviser' => $section->adviser?->printedName(),
            'settings' => $settings,
            'blocks' => $this->blocks($section, $entries),
            'signatories' => $this->signatories($term, $section),
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
     * The official form prints times without AM or PM, such as "12:50 – 2:10".
     */
    private function printedTime(string $time): string
    {
        return date('g:i', strtotime($time));
    }

    /**
     * @return array<int, array<string, string|null>>
     */
    private function signatories(SchoolTerm $term, Section $section): array
    {
        return DB::table('report_signatories')
            ->where('term_id', $term->id)
            ->where(fn ($query) => $query->where('report_type', 'class_program')->orWhereNull('report_type'))
            ->where(fn ($query) => $query->where('level', $section->gradeLevel->level)->orWhereNull('level'))
            ->orderBy('sort_order')
            ->get()
            ->map(fn ($signatory) => [
                'label' => $signatory->label,
                'name' => $signatory->auto_source === 'section_adviser'
                    ? $section->adviser?->printedName()
                    : $signatory->name,
                'position' => $signatory->position,
            ])
            ->all();
    }

    /**
     * dompdf reads images most reliably when they are embedded in the page.
     */
    private function logoDataUri(): ?string
    {
        $path = DB::table('school_profile')->value('logo_path');

        if (! $path || ! is_file(base_path($path))) {
            return null;
        }

        return 'data:image/png;base64,'.base64_encode(file_get_contents(base_path($path)));
    }
}
