<?php

namespace App\Http\Controllers;

use App\Http\Requests\PlaceActivityRequest;
use App\Http\Requests\SaveActivityRequest;
use App\Models\Activity;
use App\Models\SchoolTerm;
use App\Models\SchoolYear;
use App\Models\Section;
use App\Models\Subject;
use App\Models\TimeSlot;
use App\Services\ActivityService;
use App\Services\PlotterService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class ActivityController extends Controller
{
    public function index(SchoolYear $schoolYear, ActivityService $activities): JsonResponse
    {
        // Whoever may see subjects may see activities.
        Gate::authorize('viewAny', Subject::class);

        return response()->json(['data' => $activities->listFor($schoolYear)]);
    }

    public function store(SaveActivityRequest $request, SchoolYear $schoolYear, ActivityService $activities): JsonResponse
    {
        $activity = $activities->create($schoolYear, $request->validated(), $request->user());

        return response()->json(['data' => ['id' => $activity->id]], 201);
    }

    public function update(SaveActivityRequest $request, Activity $activity, ActivityService $activities): JsonResponse
    {
        $activities->update($activity, $request->validated(), $request->user());

        return response()->json(['data' => ['id' => $activity->id]]);
    }

    public function destroy(Request $request, Activity $activity, ActivityService $activities): JsonResponse
    {
        abort_unless($request->user()->hasAnyRole(['glc', 'master_teacher']), 403);

        $activities->delete($activity, $request->user());

        return response()->json(['message' => "{$activity->name} was deleted."]);
    }

    /**
     * With preview, only says what would happen. Otherwise places it and returns the plotter.
     */
    public function place(PlaceActivityRequest $request, SchoolTerm $term, Section $section, TimeSlot $timeSlot, ActivityService $activities, PlotterService $plotter): JsonResponse
    {
        abort_unless($term->school_year_id === $section->school_year_id, 404);

        $isPreview = $request->boolean('preview');
        $summary = $activities->place($term, $section, $timeSlot, $request->activity(), $request->input('days'), $request->input('scope'), $request->user(), $isPreview);

        return response()->json([
            'summary' => $summary,
            'data' => $isPreview ? null : $plotter->forSection($section, $term->id, $request->user()),
        ]);
    }
}
