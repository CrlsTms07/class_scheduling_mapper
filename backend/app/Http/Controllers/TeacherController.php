<?php

namespace App\Http\Controllers;

use App\Http\Requests\SaveTeacherRequest;
use App\Http\Requests\StorePersonnelOptionRequest;
use App\Models\SchoolTerm;
use App\Models\Teacher;
use App\Services\TeacherService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class TeacherController extends Controller
{
    public function index(SchoolTerm $term, TeacherService $service): JsonResponse
    {
        Gate::authorize('view-school-records');

        return response()->json(['data' => $service->listFor($term)]);
    }

    public function options(TeacherService $service): JsonResponse
    {
        Gate::authorize('view-school-records');

        return response()->json(['data' => $service->options()]);
    }

    public function storeOption(StorePersonnelOptionRequest $request, string $type, TeacherService $service): JsonResponse
    {
        return response()->json(['data' => $service->addOption($type, $request->input('name'), $request->user())], 201);
    }

    public function store(SaveTeacherRequest $request, SchoolTerm $term, TeacherService $service): JsonResponse
    {
        $teacher = $service->create($term, $request->validated(), $request->user());

        return response()->json(['data' => ['id' => $teacher->id]], 201);
    }

    public function update(SaveTeacherRequest $request, SchoolTerm $term, Teacher $teacher, TeacherService $service): JsonResponse
    {
        $service->update($teacher, $term, $request->validated(), $request->user());

        return response()->json(['data' => ['id' => $teacher->id]]);
    }

    public function destroy(Request $request, Teacher $teacher, TeacherService $service): JsonResponse
    {
        Gate::authorize('manage-school-records');

        $service->delete($teacher, $request->user());

        return response()->json(['message' => 'The record was deleted.']);
    }
}
