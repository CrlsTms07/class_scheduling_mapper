<?php

namespace App\Http\Controllers;

use App\Models\Room;
use App\Models\SchoolTerm;
use App\Models\Section;
use App\Models\Teacher;
use App\Services\ReportService;
use App\Services\ScheduleReportService;
use App\Services\ValidationReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Excel as ExcelWriter;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\Response;

class ReportController extends Controller
{
    private const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

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

    public function roomUsage(SchoolTerm $term, ScheduleReportService $reports): JsonResponse
    {
        Gate::authorize('view-school-records');

        $usage = $reports->roomUsage($term);

        return response()->json(['data' => ['buildings' => $usage['buildings']]]);
    }

    public function roomUsagePdf(SchoolTerm $term, ScheduleReportService $reports): Response
    {
        Gate::authorize('view-school-records');

        return $this->pdf($reports->usagePdf($reports->roomUsage($term)), "room-usage-{$term->name}");
    }

    public function roomUsageXlsx(SchoolTerm $term, ScheduleReportService $reports): Response
    {
        Gate::authorize('view-school-records');

        return $this->xlsx($reports->usageSheet($reports->roomUsage($term)), "room-usage-{$term->name}");
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

    private function xlsx(object $sheet, string $name): Response
    {
        return response(Excel::raw($sheet, ExcelWriter::XLSX), 200, [
            'Content-Type' => self::XLSX,
            'Content-Disposition' => 'attachment; filename="'.Str::slug($name).'.xlsx"',
        ]);
    }
}
