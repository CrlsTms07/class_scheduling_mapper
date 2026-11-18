<?php

namespace App\Http\Controllers;

use App\Http\Requests\SaveSubjectRequest;
use App\Models\SchoolYear;
use App\Models\Subject;
use App\Services\SubjectService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class SubjectController extends Controller
{
    public function index(Request $request, SchoolYear $schoolYear, SubjectService $service): JsonResponse
    {
        Gate::authorize('viewAny', Subject::class);

        return response()->json(['data' => $service->listFor($schoolYear, $request->user())]);
    }

    public function options(Request $request, SchoolYear $schoolYear, SubjectService $service): JsonResponse
    {
        Gate::authorize('viewAny', Subject::class);

        return response()->json(['data' => $service->options($schoolYear, $request->user())]);
    }

    public function store(SaveSubjectRequest $request, SchoolYear $schoolYear, SubjectService $service): JsonResponse
    {
        $subject = $service->create($schoolYear, $request->validated(), $request->user());

        return response()->json(['data' => ['id' => $subject->id]], 201);
    }

    public function update(SaveSubjectRequest $request, Subject $subject, SubjectService $service): JsonResponse
    {
        $service->update($subject, $request->validated(), $request->user());

        return response()->json(['data' => ['id' => $subject->id]]);
    }

    public function destroy(Request $request, Subject $subject, SubjectService $service): JsonResponse
    {
        Gate::authorize('manageGrade', $subject);

        $service->delete($subject, $request->user());

        return response()->json(['message' => "{$subject->name} was deleted."]);
    }
}
