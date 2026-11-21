<?php

namespace App\Http\Controllers;

use App\Http\Requests\ResolvePeriodRequest;
use App\Models\SchoolTerm;
use App\Models\Section;
use App\Services\PeriodService;
use App\Services\PlotterService;
use Illuminate\Http\JsonResponse;

class SectionPeriodController extends Controller
{
    /**
     * Returns the time slot for each day (found or newly made) and the refreshed plotter, so the
     * screen can place the class right away with the usual "place" request.
     */
    public function store(ResolvePeriodRequest $request, SchoolTerm $term, Section $section, PeriodService $periods, PlotterService $plotter): JsonResponse
    {
        abort_unless($term->school_year_id === $section->school_year_id, 404);

        $slots = $periods->resolve(
            $section,
            array_map('intval', $request->input('days')),
            $request->input('start_time'),
            $request->input('end_time'),
            $request->boolean('is_break'),
            $request->input('label'),
            $request->user(),
        );

        return response()->json(['data' => ['slots' => $slots, 'plotter' => $plotter->forSection($section, $term->id, $request->user())]]);
    }
}
