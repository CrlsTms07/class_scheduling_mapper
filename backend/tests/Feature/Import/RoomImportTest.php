<?php

use Illuminate\Support\Facades\DB;

require_once __DIR__.'/ImportHelpers.php';

const ROOM_HEADERS = ['building', 'room_number', 'room_name', 'department'];

beforeEach(function () {
    importSetUp($this);
});

it('adds rooms, and a new building once with its department', function () {
    $data = sendImport($this, 'rooms', importFile(ROOM_HEADERS, [
        ['Main Building', 101, 'Computer Laboratory', 'Junior High'],
        ['main building', 102, '', ''],
        ['Annex', 201, '', ''],
    ]), 'commit')->assertOk()->json('data');

    expect($data['added'])->toBe(3)
        ->and(DB::table('buildings')->count())->toBe(2)
        ->and(DB::table('buildings')->where('name', 'Main Building')->value('department'))->toBe('JHS')
        ->and(DB::table('buildings')->where('name', 'Annex')->value('department'))->toBeNull()
        ->and(DB::table('rooms')->where('room_number', '101')->value('room_name'))->toBe('Computer Laboratory')
        ->and($data['rows'][0]['messages'][0])->toBe('Row 2: building Main Building is added for JHS.');
});

it('skips or updates a room already in the building, and refuses an unknown department', function () {
    $buildingId = DB::table('buildings')->insertGetId(['name' => 'Main Building', 'department' => 'SHS']);
    DB::table('rooms')->insert(['building_id' => $buildingId, 'room_number' => '101']);

    $skip = sendImport($this, 'rooms', importFile(ROOM_HEADERS, [['Main Building', '101', 'ICT Room', 'JHS']]), 'commit')->json('data.rows.0');
    expect($skip['status'])->toBe('skip')
        ->and($skip['messages'][0])->toBe('Row 2: Main Building stays SHS. Change it on the Buildings and Rooms page.');

    sendImport($this, 'rooms', importFile(ROOM_HEADERS, [['Main Building', '101', 'ICT Room', '']]), 'commit', ['on_duplicate' => 'update']);
    expect(DB::table('rooms')->count())->toBe(1)
        ->and(DB::table('rooms')->value('room_name'))->toBe('ICT Room');

    $bad = sendImport($this, 'rooms', importFile(ROOM_HEADERS, [['Gym', '1', '', 'Elementary']]))->json('data.rows.0');
    expect($bad['status'])->toBe('error')
        ->and($bad['messages'][0])->toBe('Row 2: department "Elementary" is not JHS, SHS or empty (shared).');
});
