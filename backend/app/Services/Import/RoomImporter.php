<?php

namespace App\Services\Import;

use App\Models\Building;
use App\Models\Room;

/**
 * Rooms by building and room number. A building that is not in the system yet is added with the
 * row's department (Junior High, Senior High, or shared when empty).
 */
class RoomImporter extends MasterDataImporter
{
    public function columns(): array
    {
        return [
            'building' => true,
            'room_number' => true,
            'room_name' => false,
            'department' => false,
        ];
    }

    public function example(): array
    {
        return [
            'building' => 'Main Building',
            'room_number' => '101',
            'room_name' => 'Computer Laboratory',
            'department' => 'JHS',
        ];
    }

    public function notes(): array
    {
        return [
            'building' => 'Up to 80 characters. A building not in the system yet is added.',
            'room_number' => 'Up to 20 characters, e.g. 101. A room number repeats only in other buildings.',
            'room_name' => 'Optional, e.g. Computer Laboratory or HE Room.',
            'department' => 'Only for a new building: JHS, SHS, or empty for a building both departments share.',
        ];
    }

    public function table(): string
    {
        return 'rooms';
    }

    public function key(array $row): ?string
    {
        return strtolower("{$row['building']}|{$row['room_number']}");
    }

    public function describeKey(array $row): string
    {
        return "room {$row['room_number']} of {$row['building']}";
    }

    public function label(array $row): string
    {
        return trim("{$row['building']} · Room {$row['room_number']}", ' ·');
    }

    public function handle(array $row): array
    {
        $errors = [];

        if (mb_strlen($row['building']) > 80) {
            $errors[] = 'the building name is longer than 80 characters.';
        }
        if (mb_strlen($row['room_number']) > 20) {
            $errors[] = 'the room number is longer than 20 characters.';
        }
        if (mb_strlen($row['room_name']) > 80) {
            $errors[] = 'the room name is longer than 80 characters.';
        }

        $department = $this->department($row['department']);
        if ($department === false) {
            $errors[] = "department \"{$row['department']}\" is not JHS, SHS or empty (shared).";
        }

        if ($errors !== []) {
            return ['error', $errors];
        }

        $messages = [];
        $building = Building::whereRaw('LOWER(TRIM(name)) = LOWER(?)', [$row['building']])->first();

        if ($building === null) {
            $building = Building::create(['name' => $row['building'], 'department' => $department]);
            $this->audit->log($this->user, 'create', 'buildings', $building->id, null, ['source' => 'import', 'name' => $building->name, 'department' => $department]);
            $messages[] = "building {$building->name} is added".($department ? " for {$department}." : ' (shared).');
        } elseif ($row['department'] !== '' && $building->department !== $department) {
            $messages[] = "{$building->name} stays ".($building->department ?? 'shared').'. Change it on the Buildings and Rooms page.';
        }

        $room = Room::where('building_id', $building->id)
            ->whereRaw('LOWER(TRIM(room_number)) = LOWER(?)', [$row['room_number']])
            ->first();
        $roomName = $row['room_name'] === '' ? null : $row['room_name'];

        if ($room === null) {
            $room = Room::create(['building_id' => $building->id, 'room_number' => $row['room_number'], 'room_name' => $roomName]);
            $this->log('create', $room->id, null, $room->only(['building_id', 'room_number', 'room_name']));

            return ['new', $messages];
        }

        if ($this->skipOrUpdate() === 'skip') {
            return ['skip', [...$messages, "{$this->describeKey($row)} is already in the system. Skipped."]];
        }

        $before = $room->only(['room_name']);
        $room->update(['room_name' => $roomName]);
        $this->log('update', $room->id, $before, ['room_name' => $roomName]);

        return ['update', $messages];
    }
}
