<?php

namespace App\Http\Controllers;

use App\Http\Requests\SaveSchoolYearRequest;
use App\Http\Requests\StartSchoolYearRequest;
use App\Http\Resources\SchoolYearResource;
use App\Models\SchoolTerm;
use App\Models\SchoolYear;
use App\Services\SchoolYearService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;

class SchoolYearController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        Gate::authorize('manage', SchoolYear::class);

        return SchoolYearResource::collection(
            SchoolYear::with('terms')->orderByDesc('start_date')->get(),
        );
    }

    public function store(StartSchoolYearRequest $request, SchoolYearService $service): JsonResponse
    {
        ['year' => $year, 'copied' => $copied] = $service->start($request->validated(), $request->user());

        return response()->json([
            'data' => new SchoolYearResource($year->load('terms')),
            'copied' => $copied,
        ], 201);
    }

    public function update(SaveSchoolYearRequest $request, SchoolYear $schoolYear, SchoolYearService $service): SchoolYearResource
    {
        $year = $service->updateCalendar($schoolYear, $request->validated(), $request->user());

        return new SchoolYearResource($year->load('terms'));
    }

    public function destroy(Request $request, SchoolYear $schoolYear, SchoolYearService $service): JsonResponse
    {
        Gate::authorize('manage', SchoolYear::class);

        $service->delete($schoolYear, $request->user());

        return response()->json(['message' => "School year {$schoolYear->name} was deleted."]);
    }

    public function activateTerm(Request $request, SchoolTerm $term, SchoolYearService $service): JsonResponse
    {
        Gate::authorize('manage', SchoolYear::class);

        $service->activateTerm($term, $request->user());

        return response()->json(['message' => "{$term->name} is now active."]);
    }
}
