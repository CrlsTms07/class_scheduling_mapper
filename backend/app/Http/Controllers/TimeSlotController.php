<?php

namespace App\Http\Controllers;

use App\Http\Requests\PresetSlotsRequest;
use App\Http\Requests\SaveDayPatternRequest;
use App\Http\Requests\SaveTimeSlotRequest;
use App\Http\Resources\DayPatternResource;
use App\Models\DayPattern;
use App\Models\SchoolYear;
use App\Models\TimeSlot;
use App\Models\User;
use App\Services\TimeSlotService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;

class TimeSlotController extends Controller
{
    public function index(Request $request, SchoolYear $schoolYear): AnonymousResourceCollection
    {
        Gate::authorize('manage', DayPattern::class);
        // A Chairperson or Master Teacher sees the bell schedules of their own department only.
        $departments = $request->user()->hasRole(User::ROLE_ADMIN) ? null : $request->user()->departmentsInScope();

        $patterns = DayPattern::where('school_year_id', $schoolYear->id)
            ->when($departments !== null, fn ($query) => $query->whereIn('level', $departments))
            ->with('timeSlots.dayPattern')
            ->orderBy('level')
            ->orderBy('shift')
            ->orderBy('id')
            ->get();

        return DayPatternResource::collection($patterns);
    }

    public function storePattern(SaveDayPatternRequest $request, SchoolYear $schoolYear, TimeSlotService $service): JsonResponse
    {
        $pattern = $service->createPattern($schoolYear, $request->validated(), $request->user());

        return (new DayPatternResource($pattern->load('timeSlots')))->response()->setStatusCode(201);
    }

    public function updatePattern(SaveDayPatternRequest $request, DayPattern $dayPattern, TimeSlotService $service): DayPatternResource
    {
        $pattern = $service->updatePattern($dayPattern, $request->validated(), $request->user());

        return new DayPatternResource($pattern->load('timeSlots.dayPattern'));
    }

    public function destroyPattern(Request $request, DayPattern $dayPattern, TimeSlotService $service): JsonResponse
    {
        Gate::authorize('manage', [DayPattern::class, $dayPattern->level]);

        $service->deletePattern($dayPattern, $request->user());

        return response()->json(['message' => "{$dayPattern->name} was deleted."]);
    }

    public function copyPattern(SaveDayPatternRequest $request, DayPattern $dayPattern, TimeSlotService $service): JsonResponse
    {
        $copy = $service->copyPattern($dayPattern, $request->validated(), $request->user());

        return (new DayPatternResource($copy->load('timeSlots.dayPattern')))->response()->setStatusCode(201);
    }

    public function storeSlot(SaveTimeSlotRequest $request, DayPattern $dayPattern, TimeSlotService $service): JsonResponse
    {
        $service->addSlot($dayPattern, $request->validated(), $request->user());

        return (new DayPatternResource($dayPattern->load('timeSlots.dayPattern')))->response()->setStatusCode(201);
    }

    public function presetSlots(PresetSlotsRequest $request, DayPattern $dayPattern, TimeSlotService $service): JsonResponse
    {
        $service->addSlots($dayPattern, $request->validated('slots'), $request->user());

        return (new DayPatternResource($dayPattern->load('timeSlots.dayPattern')))->response()->setStatusCode(201);
    }

    public function updateSlot(SaveTimeSlotRequest $request, TimeSlot $timeSlot, TimeSlotService $service): DayPatternResource
    {
        $service->updateSlot($timeSlot, $request->validated(), $request->user());

        return new DayPatternResource($timeSlot->dayPattern->load('timeSlots.dayPattern'));
    }

    public function destroySlot(Request $request, TimeSlot $timeSlot, TimeSlotService $service): JsonResponse
    {
        Gate::authorize('manage', [DayPattern::class, $timeSlot->dayPattern->level]);

        $service->deleteSlot($timeSlot, $request->user());

        return response()->json(['message' => 'The time slot was deleted.']);
    }
}
