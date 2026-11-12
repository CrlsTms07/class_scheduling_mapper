<?php

namespace App\Http\Controllers;

use App\Http\Requests\SaveBuildingRequest;
use App\Http\Requests\SaveRoomRequest;
use App\Models\Building;
use App\Models\Room;
use App\Services\BuildingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class BuildingController extends Controller
{
    public function index(BuildingService $service): JsonResponse
    {
        Gate::authorize('view-school-records');

        return response()->json(['data' => $service->all()]);
    }

    public function store(SaveBuildingRequest $request, BuildingService $service): JsonResponse
    {
        $building = $service->createBuilding($request->input('name'), $request->user());

        return response()->json(['data' => ['id' => $building->id, 'name' => $building->name]], 201);
    }

    public function update(SaveBuildingRequest $request, Building $building, BuildingService $service): JsonResponse
    {
        $service->renameBuilding($building, $request->input('name'), $request->user());

        return response()->json(['data' => ['id' => $building->id, 'name' => $building->name]]);
    }

    public function destroy(Request $request, Building $building, BuildingService $service): JsonResponse
    {
        Gate::authorize('manage-school-records');

        $service->deleteBuilding($building, $request->user());

        return response()->json(['message' => "{$building->name} was deleted."]);
    }

    public function storeRoom(SaveRoomRequest $request, Building $building, BuildingService $service): JsonResponse
    {
        $room = $service->addRoom($building, $request->validated(), $request->user());

        return response()->json(['data' => ['id' => $room->id]], 201);
    }

    public function updateRoom(SaveRoomRequest $request, Room $room, BuildingService $service): JsonResponse
    {
        $service->updateRoom($room, $request->validated(), $request->user());

        return response()->json(['data' => ['id' => $room->id]]);
    }

    public function destroyRoom(Request $request, Room $room, BuildingService $service): JsonResponse
    {
        Gate::authorize('manage-school-records');

        $service->deleteRoom($room, $request->user());

        return response()->json(['message' => 'The room was deleted.']);
    }
}
