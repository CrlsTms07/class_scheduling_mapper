<?php

namespace App\Http\Controllers;

use App\Models\Room;
use App\Models\SchoolTerm;
use App\Models\Section;
use App\Models\Teacher;
use App\Services\ReportService;
use App\Services\ScheduleReportService;
use App\Services\SummaryReportService;
use App\Services\ValidationReportService;
use App\Support\SheetResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class ReportController extends Controller
{
    public function options(Request $request, SchoolTerm $term, ScheduleReportService $reports): JsonResponse
    {
        Gate::authorize('view-school-records');

        return response()->json(['data' => $reports->options($term, $request->user())]);
    }

    public function classProgramXlsx(SchoolTerm $term, Section $section, ReportService $reports): Response
    {
        Gate::authorize('view', $section);
        abort_unless($term->school_year_id === $section->school_year_id, 404);

        return $this->xlsx(
            $reports->classProgramSheet($reports->classProgramData($term, $section)),
            "class-program-{$section->label()}-{$term->name}",
        );
    }

    public function teacherProgram(SchoolTerm $term, Teacher $teacher, ScheduleReportService $reports): JsonResponse
    {
        Gate::authorize('view-teacher-program', [$teacher, $term]);

        return response()->json(['data' => $this->gridOnly($reports->teacherProgram($term, $teacher))]);
    }

    public function teacherProgramPdf(SchoolTerm $term, Teacher $teacher, ScheduleReportService $reports): Response
    {
        Gate::authorize('view-teacher-program', [$teacher, $term]);

        return $this->pdf($reports->gridPdf($reports->teacherProgram($term, $teacher)), $this->teacherFile($term, $teacher));
    }

    public function teacherProgramXlsx(SchoolTerm $term, Teacher $teacher, ScheduleReportService $reports): Response
    {
        Gate::authorize('view-teacher-program', [$teacher, $term]);

        return $this->xlsx($reports->gridSheet($reports->teacherProgram($term, $teacher), 'Teacher Program'), $this->teacherFile($term, $teacher));
    }

    public function roomSchedule(SchoolTerm $term, Room $room, ScheduleReportService $reports): JsonResponse
    {
        Gate::authorize('view-school-records');

        return response()->json(['data' => $this->gridOnly($reports->roomSchedule($term, $room))]);
    }

    public function roomSchedulePdf(SchoolTerm $term, Room $room, ScheduleReportService $reports): Response
    {
        Gate::authorize('view-school-records');

        return $this->pdf($reports->gridPdf($reports->roomSchedule($term, $room)), $this->roomFile($term, $room));
    }

    public function roomScheduleXlsx(SchoolTerm $term, Room $room, ScheduleReportService $reports): Response
    {
        Gate::authorize('view-school-records');

        return $this->xlsx($reports->gridSheet($reports->roomSchedule($term, $room), 'Room Schedule'), $this->roomFile($term, $room));
    }

    public function roomUsage(Request $request, SchoolTerm $term, ScheduleReportService $reports): JsonResponse
    {
        Gate::authorize('view-school-records');

        $usage = $reports->roomUsage($term, $request->integer('building') ?: null);

        return response()->json(['data' => ['buildings' => $usage['buildings']]]);
    }

    public function roomUsagePdf(Request $request, SchoolTerm $term, ScheduleReportService $reports): Response
    {
        Gate::authorize('view-school-records');

        return $this->pdf($reports->usagePdf($reports->roomUsage($term, $request->integer('building') ?: null)), "room-usage-{$term->name}");
    }

    public function roomUsageXlsx(Request $request, SchoolTerm $term, ScheduleReportService $reports): Response
    {
        Gate::authorize('view-school-records');

        return $this->xlsx($reports->usageSheet($reports->roomUsage($term, $request->integer('building') ?: null)), "room-usage-{$term->name}");
    }

    public function teacherLoad(Request $request, SchoolTerm $term, SummaryReportService $reports): JsonResponse
    {
        Gate::authorize('view-school-records');

        return response()->json(['data' => $reports->teacherLoad($term, $request->user())]);
    }

    public function teacherLoadPdf(Request $request, SchoolTerm $term, SummaryReportService $reports): Response
    {
        Gate::authorize('view-school-records');

        return $this->pdf($reports->teacherLoadPdf($reports->teacherLoad($term, $request->user())), "teacher-load-{$term->name}");
    }

    public function teacherLoadXlsx(Request $request, SchoolTerm $term, SummaryReportService $reports): Response
    {
        Gate::authorize('view-school-records');

        return $this->xlsx($reports->teacherLoadSheet($reports->teacherLoad($term, $request->user())), "teacher-load-{$term->name}");
    }

    public function adviserSummary(Request $request, SchoolTerm $term, SummaryReportService $reports): JsonResponse
    {
        Gate::authorize('view-school-records');

        return response()->json(['data' => $reports->adviserSummary($term, $request->user())]);
    }

    public function adviserSummaryPdf(Request $request, SchoolTerm $term, SummaryReportService $reports): Response
    {
        Gate::authorize('view-school-records');

        return $this->pdf($reports->adviserSummaryPdf($reports->adviserSummary($term, $request->user())), 'adviser-summary');
    }

    public function adviserSummaryXlsx(Request $request, SchoolTerm $term, SummaryReportService $reports): Response
    {
        Gate::authorize('view-school-records');

        return $this->xlsx($reports->adviserSummarySheet($reports->adviserSummary($term, $request->user())), 'adviser-summary');
    }

    public function gradeTimetable(Request $request, SchoolTerm $term, int $grade, SummaryReportService $reports): JsonResponse
    {
        $this->authorizeGrade($request, $grade);

        return response()->json(['data' => $reports->gradeTimetable($term, $grade)]);
    }

    public function gradeTimetablePdf(Request $request, SchoolTerm $term, int $grade, SummaryReportService $reports): Response
    {
        $this->authorizeGrade($request, $grade);

        return $this->pdf($reports->gradeTimetablePdf($reports->gradeTimetable($term, $grade)), "grade-{$grade}-timetable-{$term->name}");
    }

    public function gradeTimetableXlsx(Request $request, SchoolTerm $term, int $grade, SummaryReportService $reports): Response
    {
        $this->authorizeGrade($request, $grade);

        return $this->xlsx($reports->gradeTimetableSheet($reports->gradeTimetable($term, $grade)), "grade-{$grade}-timetable-{$term->name}");
    }

    private function authorizeGrade(Request $request, int $grade): void
    {
        Gate::authorize('view-school-records');

        $inScope = DB::table('grade_levels')
            ->where('grade', $grade)
            ->whereIn('id', $request->user()->gradeLevelIdsInScope())
            ->exists();

        abort_unless($inScope, 403);
    }

    public function validationReport(Request $request, SchoolTerm $term, ValidationReportService $reports): JsonResponse
    {
        Gate::authorize('view-school-records');

        return response()->json(['data' => $reports->forUser($term, $request->user())]);
    }

    public function validationPdf(Request $request, SchoolTerm $term, ValidationReportService $reports): Response
    {
        Gate::authorize('view-school-records');

        return $this->pdf($reports->pdf($reports->forUser($term, $request->user())), "validation-report-{$term->name}");
    }

    public function validationXlsx(Request $request, SchoolTerm $term, ValidationReportService $reports): Response
    {
        Gate::authorize('view-school-records');

        return $this->xlsx($reports->sheet($reports->forUser($term, $request->user())), "validation-report-{$term->name}");
    }

    /**
     * What the on-screen preview needs, without the school's logos and the rest of the form.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function gridOnly(array $data): array
    {
        return collect($data)->only(['title', 'term_label', 'heading', 'details', 'days', 'rows', 'totals', 'isDraft'])->all();
    }

    private function teacherFile(SchoolTerm $term, Teacher $teacher): string
    {
        return "teacher-program-{$teacher->printedName()}-{$term->name}";
    }

    private function roomFile(SchoolTerm $term, Room $room): string
    {
        return "room-schedule-{$room->label()}-{$term->name}";
    }

    private function pdf(string $content, string $name): Response
    {
        return response($content, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.Str::slug($name).'.pdf"',
        ]);
    }

    /** XLSX, or CSV when the address ends in .csv. Both come from the same sheet. */
    private function xlsx(object $sheet, string $name): Response
    {
        return SheetResponse::make($sheet, Str::slug($name), SheetResponse::formatOf(request()));
    }
}
