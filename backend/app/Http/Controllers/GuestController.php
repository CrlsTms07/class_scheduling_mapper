<?php

namespace App\Http\Controllers;

use App\Models\SchoolTerm;
use App\Models\Section;
use App\Services\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * Public, with no login: approved schedules of the active term only.
 * A section shows only when all of it is approved. There is no student data here at all.
 */
class GuestController extends Controller
{
    public function sections(): JsonResponse
    {
        $term = $this->activeTerm();

        if (! $term) {
            return response()->json(['data' => ['term' => null, 'sections' => []]]);
        }

        $statuses = DB::table('section_term_status')->where('term_id', $term->id)->pluck('status', 'section_id');

        $sections = Section::with(['gradeLevel', 'track'])
            ->where('school_year_id', $term->school_year_id)
            ->get()
            ->sortBy(fn (Section $section) => [$section->gradeLevel->grade, $section->name])
            ->map(fn (Section $section) => [
                'id' => $section->id,
                'name' => $section->name,
                'grade' => $section->gradeLevel->grade,
                'level' => $section->gradeLevel->level,
                'track' => $section->track?->name,
                'is_ready' => ($statuses[$section->id] ?? null) === 'approved',
            ])
            ->values();

        return response()->json(['data' => [
            'term' => ['name' => $term->name, 'school_year' => $term->schoolYear->name],
            'sections' => $sections,
        ]]);
    }

    public function show(Section $section, ReportService $reports): JsonResponse
    {
        $term = $this->termOfOr404($section);
        $status = $this->statusOf($term, $section);

        $base = [
            'id' => $section->id,
            'label' => $section->label(),
            'term' => ['name' => $term->name, 'school_year' => $term->schoolYear->name],
        ];

        // Being worked on, or reopened after approval: nothing unapproved is shown.
        if ($status !== 'approved') {
            return response()->json(['data' => [
                ...$base,
                'state' => $status === null || $status === 'not_started' ? 'not_ready' : 'updating',
            ]]);
        }

        return response()->json(['data' => [
            ...$base,
            'state' => 'ready',
            'adviser' => $section->adviser?->printedName(),
            'week' => $reports->approvedWeek($term, $section),
        ]]);
    }

    public function pdf(Section $section, ReportService $reports): Response
    {
        $term = $this->termOfOr404($section);

        abort_unless($this->statusOf($term, $section) === 'approved', 404, 'Schedule is being updated.');

        $fileName = Str::slug("class-program-{$section->label()}-{$term->name}").'.pdf';

        return response($reports->classProgramPdf($term, $section), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$fileName.'"',
        ]);
    }

    private function activeTerm(): ?SchoolTerm
    {
        return SchoolTerm::with('schoolYear')->where('is_active', true)->first();
    }

    /**
     * A section of another school year is simply not found, so old links reveal nothing.
     */
    private function termOfOr404(Section $section): SchoolTerm
    {
        $term = $this->activeTerm();

        abort_unless($term && $term->school_year_id === $section->school_year_id, 404);

        $section->loadMissing(['gradeLevel', 'adviser']);

        return $term;
    }

    private function statusOf(SchoolTerm $term, Section $section): ?string
    {
        return DB::table('section_term_status')
            ->where('term_id', $term->id)
            ->where('section_id', $section->id)
            ->value('status');
    }
}
