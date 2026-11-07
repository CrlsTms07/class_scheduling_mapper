<?php

namespace App\Http\Controllers;

use App\Http\Requests\AssignSlotRequest;
use App\Http\Requests\ClearSlotRequest;
use App\Http\Requests\MoveEntryRequest;
use App\Http\Requests\SubmitScheduleRequest;
use App\Models\SchoolTerm;
use App\Models\Section;
use App\Models\TimeSlot;
use App\Services\PlotterService;
use App\Services\ScheduleService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class PlotterController extends Controller
{
    public function show(Request $request, SchoolTerm $term, Section $section, PlotterService $plotter): JsonResponse
    {
        Gate::authorize('view', $section);
        $this->ensureSameSchoolYear($term, $section);

        return response()->json(['data' => $plotter->forSection($section, $term->id, $request->user())]);
    }

    public function assign(AssignSlotRequest $request, SchoolTerm $term, Section $section, TimeSlot $timeSlot, ScheduleService $schedule, PlotterService $plotter): JsonResponse
    {
        $this->ensureSameSchoolYear($term, $section);

        $schedule->assign($term->id, $section, $timeSlot, $request->loading(), $request->integer('room_id'), $request->input('days'), $request->user());

        return response()->json(['data' => $plotter->forSection($section, $term->id, $request->user())]);
    }

    public function move(MoveEntryRequest $request, SchoolTerm $term, Section $section, TimeSlot $timeSlot, ScheduleService $schedule, PlotterService $plotter): JsonResponse
    {
        $this->ensureSameSchoolYear($term, $section);

        $schedule->move($term->id, $section, $request->fromSlot(), $timeSlot, $request->input('from_days'), $request->input('days'), $request->user());

        return response()->json(['data' => $plotter->forSection($section, $term->id, $request->user())]);
    }

    public function clear(ClearSlotRequest $request, SchoolTerm $term, Section $section, TimeSlot $timeSlot, ScheduleService $schedule, PlotterService $plotter): JsonResponse
    {
        $this->ensureSameSchoolYear($term, $section);

        $schedule->clear($term->id, $section, $timeSlot, $request->input('days'));

        return response()->json(['data' => $plotter->forSection($section, $term->id, $request->user())]);
    }

    public function submit(SubmitScheduleRequest $request, SchoolTerm $term, Section $section, ScheduleService $schedule, PlotterService $plotter): JsonResponse
    {
        $this->ensureSameSchoolYear($term, $section);

        $schedule->submit($term->id, $section, $request->input('acknowledged_flags'), $request->input('note'), $request->user());

        return response()->json(['data' => $plotter->forSection($section, $term->id, $request->user())]);
    }

    public function revise(Request $request, SchoolTerm $term, Section $section, ScheduleService $schedule, PlotterService $plotter): JsonResponse
    {
        Gate::authorize('plot', $section);
        $this->ensureSameSchoolYear($term, $section);

        $removed = $schedule->revise($term->id, $section, $request->user());

        return response()->json([
            'data' => $plotter->forSection($section, $term->id, $request->user()),
            'removed' => $removed,
        ]);
    }

    private function ensureSameSchoolYear(SchoolTerm $term, Section $section): void
    {
        abort_unless($term->school_year_id === $section->school_year_id, 404);
    }
}
