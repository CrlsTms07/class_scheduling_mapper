<?php

namespace App\Http\Controllers;

use App\Models\SchoolTerm;
use App\Models\Section;
use App\Models\Teacher;
use App\Services\ScheduleReportService;
use App\Support\SheetResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * A signed-in person's own schedule and profile, read-only.
 * What they see comes from the personnel record linked to their account.
 */
class MyRecordsController extends Controller
{
    private const FINAL_ONLY = true;

    public function schedule(Request $request, SchoolTerm $term, ScheduleReportService $reports): JsonResponse
    {
        $teacher = $request->user()->teacher;

        if (! $teacher) {
            return response()->json(['data' => null]);
        }

        $data = collect($reports->teacherProgram($term, $teacher, self::FINAL_ONLY))
            ->only(['heading', 'details', 'term_label', 'days', 'rows', 'totals'])
            ->all();

        // Entries not yet approved stay hidden, but the teacher should know more is coming.
        $notFinal = DB::table('schedule_entries')
            ->where('term_id', $term->id)
            ->where('teacher_id', $teacher->id)
            ->whereIn('status', ['draft', 'pending'])
            ->count();

        return response()->json(['data' => [...$data, 'not_final_count' => $notFinal]]);
    }

    public function schedulePdf(Request $request, SchoolTerm $term, ScheduleReportService $reports): Response
    {
        $teacher = $this->teacherOrFail($request);

        return response($reports->gridPdf($reports->teacherProgram($term, $teacher, self::FINAL_ONLY)), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$this->fileName($term, $teacher).'.pdf"',
        ]);
    }

    public function scheduleXlsx(Request $request, SchoolTerm $term, ScheduleReportService $reports): Response
    {
        $teacher = $this->teacherOrFail($request);
        $sheet = $reports->gridSheet($reports->teacherProgram($term, $teacher, self::FINAL_ONLY), 'My Schedule');

        return SheetResponse::make($sheet, $this->fileName($term, $teacher), SheetResponse::formatOf($request));
    }

    public function profile(Request $request, SchoolTerm $term): JsonResponse
    {
        $user = $request->user();
        $teacher = $user->teacher;

        if (! $teacher) {
            return response()->json(['data' => null]);
        }

        $advisory = Section::with('gradeLevel')
            ->where('school_year_id', $term->school_year_id)
            ->where('adviser_id', $teacher->id)
            ->first();

        return response()->json(['data' => [
            'printed_name' => $teacher->printedName(),
            'email' => $user->email,
            'department' => DB::table('departments')->where('id', $teacher->department_id)->value('name'),
            'designation' => DB::table('designations')->where('id', $teacher->designation_id)->value('name'),
            'shift' => $teacher->shift,
            'max_subjects' => $teacher->max_subjects,
            'advisory' => $advisory?->label(),
            'assigned' => DB::table('section_subjects')->where('term_id', $term->id)->where('teacher_id', $teacher->id)->count(),
            'tasks' => DB::table('teacher_tasks')
                ->join('teaching_tasks', 'teaching_tasks.id', '=', 'teacher_tasks.task_id')
                ->where('teacher_tasks.term_id', $term->id)
                ->where('teacher_tasks.teacher_id', $teacher->id)
                ->orderBy('teaching_tasks.name')
                ->pluck('teaching_tasks.name'),
            'qualifications' => DB::table('teacher_qualifications')
                ->where('teacher_id', $teacher->id)
                ->orderBy('id')
                ->get(['degree_level', 'degree', 'major', 'school', 'year_completed']),
        ]]);
    }

    private function teacherOrFail(Request $request): Teacher
    {
        $teacher = $request->user()->teacher;

        abort_unless($teacher !== null, 404, 'Your account has no personnel record yet. Please ask the Admin.');

        return $teacher;
    }

    private function fileName(SchoolTerm $term, Teacher $teacher): string
    {
        return Str::slug("my-schedule-{$teacher->printedName()}-{$term->name}");
    }
}
