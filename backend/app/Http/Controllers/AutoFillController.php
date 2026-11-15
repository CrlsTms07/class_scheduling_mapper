<?php

namespace App\Http\Controllers;

use App\Http\Requests\AutoFillRequest;
use App\Models\AutoFillRun;
use App\Models\SchoolTerm;
use App\Models\Section;
use App\Services\AutoFillService;
use App\Services\PlotterService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AutoFillController extends Controller
{
    /** What auto-fill would place, and what it could not. Nothing is saved. */
    public function preview(AutoFillRequest $request, SchoolTerm $term, Section $section, AutoFillService $autoFill): JsonResponse
    {
        abort_unless($term->school_year_id === $section->school_year_id, 404);

        return response()->json(['data' => $autoFill->preview($term, $section, $request->input('scope'), $request->user())]);
    }

    public function store(AutoFillRequest $request, SchoolTerm $term, Section $section, AutoFillService $autoFill, PlotterService $plotter): JsonResponse
    {
        abort_unless($term->school_year_id === $section->school_year_id, 404);
        $request->validate(['plan_hash' => ['required']]);

        $summary = $autoFill->apply($term, $section, $request->input('scope'), $request->input('plan_hash'), $request->user());

        return response()->json([
            'summary' => $summary,
            'data' => $plotter->forSection($section, $term->id, $request->user()),
        ], 201);
    }

    public function destroy(Request $request, SchoolTerm $term, Section $section, AutoFillRun $run, AutoFillService $autoFill, PlotterService $plotter): JsonResponse
    {
        abort_unless($request->user()->can('plot', $section) && $run->term_id === $term->id && $run->undone_at === null, 404);

        $result = $autoFill->undo($run, $request->user());

        return response()->json([
            'summary' => $result,
            'data' => $plotter->forSection($section, $term->id, $request->user()),
        ]);
    }
}
