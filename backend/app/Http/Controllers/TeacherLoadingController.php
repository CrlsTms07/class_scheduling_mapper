<?php

namespace App\Http\Controllers;

use App\Http\Requests\QuickAddTeacherRequest;
use App\Http\Requests\SaveLoadingRequest;
use App\Models\SchoolTerm;
use App\Models\Section;
use App\Models\Subject;
use App\Services\TeacherLoadingService;
use App\Services\TeacherService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class TeacherLoadingController extends Controller
{
    public function show(SchoolTerm $term, Section $section, TeacherLoadingService $loading): JsonResponse
    {
        Gate::authorize('plot', $section);
        $this->ensureSameSchoolYear($term, $section);

        return response()->json(['data' => $loading->forSection($term, $section)]);
    }

    public function assign(SaveLoadingRequest $request, SchoolTerm $term, Section $section, Subject $subject, TeacherLoadingService $loading): JsonResponse
    {
        $this->ensureSameSchoolYear($term, $section);

        $loading->assign($term, $section, $subject, $request->integer('teacher_id'), $request->user());

        return response()->json(['data' => $loading->forSection($term, $section)]);
    }

    public function remove(Request $request, SchoolTerm $term, Section $section, Subject $subject, TeacherLoadingService $loading): JsonResponse
    {
        Gate::authorize('plot', $section);
        $this->ensureSameSchoolYear($term, $section);

        $loading->remove($term, $section, $subject, $request->user());

        return response()->json(['data' => $loading->forSection($term, $section)]);
    }

    public function quickAddTeacher(QuickAddTeacherRequest $request, TeacherService $teachers): JsonResponse
    {
        $teacher = $teachers->quickAdd($request->input('first_name'), $request->input('last_name'), $request->user());

        return response()->json(['data' => ['id' => $teacher->id, 'name' => $teacher->printedName()]], 201);
    }

    private function ensureSameSchoolYear(SchoolTerm $term, Section $section): void
    {
        abort_unless($term->school_year_id === $section->school_year_id, 404);
    }
}
