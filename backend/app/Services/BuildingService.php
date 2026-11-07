<?php

namespace App\Services;

use App\Models\Building;
use App\Models\Room;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class BuildingService
{
    public function __construct(private AuditLogger $audit) {}

    /**
     * @return array<int, array<string, mixed>>
     */
    public function all(): array
    {
        return Building::with(['rooms' => fn ($query) => $query->orderBy('room_number')])
            ->orderBy('name')
            ->get()
            ->map(fn (Building $building) => [
                'id' => $building->id,
                'name' => $building->name,
                'rooms' => $building->rooms->map(fn (Room $room) => [
                    'id' => $room->id,
                    'room_number' => $room->room_number,
                    'room_name' => $room->room_name,
                    'capacity' => $room->capacity,
                    'is_active' => $room->is_active,
                    'cannot_delete_reason' => $this->whyRoomCannotBeDeleted($room),
                ])->values(),
            ])
            ->all();
    }

    public function createBuilding(string $name, User $user): Building
    {
        return DB::transaction(function () use ($name, $user) {
            $building = Building::create(['name' => trim($name)]);

            $this->audit->log($user, 'create', 'buildings', $building->id, null, ['name' => $building->name]);

            return $building;
        });
    }

    public function renameBuilding(Building $building, string $name, User $user): void
    {
        DB::transaction(function () use ($building, $name, $user) {
            $before = $building->name;
            $building->update(['name' => trim($name)]);

            $this->audit->log($user, 'update', 'buildings', $building->id, ['name' => $before], ['name' => $building->name]);
        });
    }

    public function deleteBuilding(Building $building, User $user): void
    {
        if ($building->rooms()->exists()) {
            throw ValidationException::withMessages(['building' => 'Remove the rooms of this building first.']);
        }

        DB::transaction(function () use ($building, $user) {
            $name = $building->name;
            $building->delete();

            $this->audit->log($user, 'delete', 'buildings', $building->id, ['name' => $name]);
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function addRoom(Building $building, array $data, User $user): Room
    {
        return DB::transaction(function () use ($building, $data, $user) {
            $room = $building->rooms()->create([...$data, 'room_number' => trim($data['room_number'])]);

            $this->audit->log($user, 'create', 'rooms', $room->id, null, $data);

            return $room;
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function updateRoom(Room $room, array $data, User $user): void
    {
        DB::transaction(function () use ($room, $data, $user) {
            $before = $room->only(array_keys($data));
            $room->update([...$data, 'room_number' => trim($data['room_number'])]);

            $this->audit->log($user, 'update', 'rooms', $room->id, $before, $data);
        });
    }

    public function deleteRoom(Room $room, User $user): void
    {
        $reason = $this->whyRoomCannotBeDeleted($room);
        if ($reason !== null) {
            throw ValidationException::withMessages(['room' => $reason]);
        }

        DB::transaction(function () use ($room, $user) {
            $before = $room->only(['building_id', 'room_number']);
            $room->delete();

            $this->audit->log($user, 'delete', 'rooms', $room->id, $before);
        });
    }

    /**
     * A used room stays, so old schedules keep showing where the class was held.
     */
    public function whyRoomCannotBeDeleted(Room $room): ?string
    {
        if (DB::table('schedule_entries')->where('room_id', $room->id)->exists()) {
            return 'It is used in schedules. Mark it as not in use instead.';
        }

        if (DB::table('sections')->where('home_room_id', $room->id)->exists()) {
            return 'It is the home room of a section. Mark it as not in use instead.';
        }

        return null;
    }
}
