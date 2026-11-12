<?php

namespace App\Http\Controllers;

use App\Models\Room;
use App\Models\Section;
use App\Services\ScheduleService;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * "+ Add Section" on a room card: the room becomes the section's home room (JHS) or usual room
 * (SHS), the room its classes use by default. Leaving it empty takes the section out of the room.
 */
class SectionRoomController extends Controller
{
    public function update(Request $request, Section $section, AuditLogger $audit, ScheduleService $schedule): JsonResponse
    {
        Gate::authorize('manage', [Section::class, $section->grade_level_id]);

        $data = $request->validate([
            'room_id' => ['nullable', 'integer', Rule::exists('rooms', 'id')->where('is_active', true)],
        ], ['room_id.exists' => 'Choose a room that is in use.']);

        $before = $section->home_room_id;
        $section->update(['home_room_id' => $data['room_id'] ?? null]);
        $audit->log($request->user(), 'update', 'sections', $section->id, ['home_room_id' => $before], ['home_room_id' => $section->home_room_id]);

        $room = $section->home_room_id ? Room::with('building')->find($section->home_room_id) : null;
        $filled = $room ? $schedule->fillMissingRooms($section, $room->id) : ['filled' => 0, 'busy' => 0];

        return response()->json([
            'message' => $room
                ? "{$section->label()} now uses {$room->label()}."
                    .($filled['filled'] > 0 ? " {$filled['filled']} ".($filled['filled'] === 1 ? 'class' : 'classes').' without a room now use it.' : '')
                    .($filled['busy'] > 0 ? " {$filled['busy']} could not, since the room is used by another section then." : '')
                : "{$section->label()} has no room now.",
            'filled' => $filled,
        ]);
    }
}
