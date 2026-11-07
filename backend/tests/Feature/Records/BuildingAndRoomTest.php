<?php

use App\Models\User;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    $this->withHeader('Referer', 'http://localhost:5173');
    $this->seed(ReferenceDataSeeder::class);

    $this->actingAs(User::factory()->create()->assignRole('glc'));

    $this->buildingId = DB::table('buildings')->insertGetId(['name' => 'Main']);
    $this->roomId = DB::table('rooms')->insertGetId(['building_id' => $this->buildingId, 'room_number' => '101']);
});

function roomBody(array $overrides = []): array
{
    return ['room_number' => '102', 'room_name' => null, 'capacity' => 45, 'is_active' => true, ...$overrides];
}

it('lets a Master Teacher manage too', function () {
    $this->actingAs(User::factory()->create()->assignRole('master_teacher'));

    $this->postJson('/api/buildings', ['name' => 'Annex'])->assertCreated();
});

it('lets the Admin manage too, since sections need rooms', function () {
    $this->actingAs(User::factory()->create()->assignRole('super_admin'));

    $this->getJson('/api/buildings')->assertOk()->assertJsonPath('data.0.name', 'Main');
    $this->postJson('/api/buildings', ['name' => 'Annex'])->assertCreated();
    $this->postJson("/api/buildings/{$this->buildingId}/rooms", roomBody())->assertCreated();
});

it('keeps teachers out completely', function () {
    $this->actingAs(User::factory()->create()->assignRole('teacher'));

    $this->getJson('/api/buildings')->assertForbidden();
    $this->postJson('/api/buildings', ['name' => 'Annex'])->assertForbidden();
    $this->putJson("/api/buildings/{$this->buildingId}", ['name' => 'X'])->assertForbidden();
    $this->deleteJson("/api/buildings/{$this->buildingId}")->assertForbidden();
    $this->postJson("/api/buildings/{$this->buildingId}/rooms", roomBody())->assertForbidden();
    $this->putJson("/api/rooms/{$this->roomId}", roomBody())->assertForbidden();
    $this->deleteJson("/api/rooms/{$this->roomId}")->assertForbidden();
});

it('adds and renames a building, and writes audit logs', function () {
    $id = $this->postJson('/api/buildings', ['name' => ' Annex '])->assertCreated()->json('data.id');
    $this->putJson("/api/buildings/{$id}", ['name' => 'New Annex'])->assertOk();

    expect(DB::table('buildings')->where('id', $id)->value('name'))->toBe('New Annex')
        ->and(DB::table('audit_logs')->where('table_name', 'buildings')->count())->toBe(2);
});

it('refuses a repeated or empty building name, but not its own', function () {
    $this->postJson('/api/buildings', ['name' => 'Main'])->assertUnprocessable()->assertJsonValidationErrors('name');
    $this->postJson('/api/buildings', ['name' => ''])->assertUnprocessable()->assertJsonValidationErrors('name');
    $this->putJson("/api/buildings/{$this->buildingId}", ['name' => 'Main'])->assertOk();
});

it('only deletes a building with no rooms', function () {
    $this->deleteJson("/api/buildings/{$this->buildingId}")
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['building' => 'rooms']);

    $this->deleteJson("/api/rooms/{$this->roomId}")->assertOk();
    $this->deleteJson("/api/buildings/{$this->buildingId}")->assertOk();

    expect(DB::table('buildings')->count())->toBe(0);
});

it('lists rooms in their buildings', function () {
    $this->postJson("/api/buildings/{$this->buildingId}/rooms", roomBody(['room_name' => 'Science Lab']))->assertCreated();

    $this->getJson('/api/buildings')
        ->assertJsonPath('data.0.rooms.0.room_number', '101')
        ->assertJsonPath('data.0.rooms.1.room_number', '102')
        ->assertJsonPath('data.0.rooms.1.room_name', 'Science Lab')
        ->assertJsonPath('data.0.rooms.1.capacity', 45)
        ->assertJsonPath('data.0.rooms.1.is_active', true);
});

it('rejects bad rooms', function (array $overrides, string $field) {
    $this->postJson("/api/buildings/{$this->buildingId}/rooms", roomBody($overrides))
        ->assertUnprocessable()
        ->assertJsonValidationErrors($field);
})->with([
    'no number' => [['room_number' => ''], 'room_number'],
    'number already in the building' => [['room_number' => '101'], 'room_number'],
    'negative capacity' => [['capacity' => -1], 'capacity'],
]);

it('allows the same room number in another building', function () {
    $other = DB::table('buildings')->insertGetId(['name' => 'Annex']);

    $this->postJson("/api/buildings/{$other}/rooms", roomBody(['room_number' => '101']))->assertCreated();
});

it('saves a room without tripping over its own number', function () {
    $this->putJson("/api/rooms/{$this->roomId}", roomBody(['room_number' => '101', 'is_active' => false]))->assertOk();

    expect((bool) DB::table('rooms')->where('id', $this->roomId)->value('is_active'))->toBeFalse();
});

describe('a room in use', function () {
    beforeEach(function () {
        $this->yearId = DB::table('school_years')->insertGetId([
            'name' => '2026-2027', 'start_date' => '2026-06-01', 'end_date' => '2027-03-31',
        ]);
        $this->gradeId = DB::table('grade_levels')->where('grade', 7)->value('id');
    });

    it('stays when it is a home room, and says why', function () {
        DB::table('sections')->insert([
            'school_year_id' => $this->yearId, 'grade_level_id' => $this->gradeId, 'name' => 'Honesty', 'home_room_id' => $this->roomId,
        ]);

        $this->getJson('/api/buildings')->assertJsonPath('data.0.rooms.0.cannot_delete_reason', 'It is the home room of a section. Mark it as not in use instead.');
        $this->deleteJson("/api/rooms/{$this->roomId}")->assertUnprocessable()->assertJsonValidationErrors(['room' => 'home room']);
    });

    it('stays when it is used in schedules', function () {
        $termId = DB::table('school_terms')->insertGetId([
            'school_year_id' => $this->yearId, 'term_no' => 1, 'name' => 'First',
            'start_date' => '2026-06-01', 'end_date' => '2026-09-30',
        ]);
        $sectionId = DB::table('sections')->insertGetId([
            'school_year_id' => $this->yearId, 'grade_level_id' => $this->gradeId, 'name' => 'Honesty',
        ]);
        DB::table('schedule_entries')->insert([
            'term_id' => $termId, 'section_id' => $sectionId, 'room_id' => $this->roomId, 'created_by' => auth()->id(),
            'day_of_week' => 1, 'start_time' => '07:00', 'end_time' => '07:45',
        ]);

        $this->deleteJson("/api/rooms/{$this->roomId}")->assertUnprocessable()->assertJsonValidationErrors(['room' => 'schedules']);
    });
});
