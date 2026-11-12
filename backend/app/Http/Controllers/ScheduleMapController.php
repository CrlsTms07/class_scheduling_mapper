<?php

namespace App\Http\Controllers;

use App\Models\Room;
use App\Models\SchoolTerm;
use App\Services\ScheduleMapService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class ScheduleMapController extends Controller
{
    public function index(Request $request, SchoolTerm $term, ScheduleMapService $map): JsonResponse
    {
        Gate::authorize('view-school-records');

        return response()->json(['data' => $map->forTerm($term, $request->user())]);
    }

    public function room(Request $request, SchoolTerm $term, Room $room, ScheduleMapService $map): JsonResponse
    {
        Gate::authorize('view-school-records');

        return response()->json(['data' => $map->roomSchedule($term, $room, $request->user())]);
    }
}
