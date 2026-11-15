<?php

use App\Models\Section;
use App\Models\SectionSubject;
use App\Models\TimeSlot;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Support\Facades\DB;

/*
 * Each department keeps its own buildings and activities (team decision, Nov 13, 2026). Shared
 * ones (no department) are used by both and changed by the Admin. Teachers stay shared.
 */

beforeEach(function () {
    $this->withHeader('Referer', 'http://localhost:5173');
    $this->seed(DatabaseSeeder::class);

    $this->yearId = DB::table('school_terms')->where('is_active', true)->value('school_year_id');
    $this->termId = DB::table('school_terms')->where('is_active', true)->value('id');
    $grade = fn (int $grade) => DB::table('grade_levels')->where('grade', $grade)->value('id');

    $this->glc = User::factory()->create()->assignRole('glc');
    $this->glc->gradeLevels()->sync([$grade(7)]);
    $this->master = User::factory()->create()->assignRole('master_teacher');
    $this->master->gradeLevels()->sync([$grade(11)]);
    $this->admin = User::factory()->create()->assignRole('super_admin');

    $this->jhsBuilding = DB::table('buildings')->insertGetId(['name' => 'Junior Wing', 'department' => 'JHS']);
    $this->jhsRoom = DB::table('rooms')->insertGetId(['building_id' => $this->jhsBuilding, 'room_number' => '301']);
    $this->shsBuilding = DB::table('buildings')->insertGetId(['name' => 'Senior Wing', 'department' => 'SHS']);
    $this->shsRoom = DB::table('rooms')->insertGetId(['building_id' => $this->shsBuilding, 'room_number' => '401']);
    $this->gym = DB::table('buildings')->insertGetId(['name' => 'Gym', 'department' => null]);
    $this->gymRoom = DB::table('rooms')->insertGetId(['building_id' => $this->gym, 'room_number' => 'G1']);

    $this->stem = Section::create(['school_year_id' => $this->yearId, 'grade_level_id' => $grade(11), 'name' => 'STEM A']);
});

$names = fn ($response) => collect($response->json('data'))->pluck('name')->all();

it('shows each department its own buildings and the shared ones', function () use ($names) {
    $this->actingAs($this->glc);
    $glcSees = $names($this->getJson('/api/buildings')->assertOk());
    $this->actingAs($this->master);
    $masterSees = $names($this->getJson('/api/buildings')->assertOk());
    $this->actingAs($this->admin);
    $adminSees = $names($this->getJson('/api/buildings')->assertOk());

    expect($glcSees)->toContain('Junior Wing')->toContain('Gym')->not->toContain('Senior Wing')
        ->and($masterSees)->toContain('Senior Wing')->toContain('Gym')->not->toContain('Junior Wing')
        ->and($adminSees)->toContain('Junior Wing')->toContain('Senior Wing')->toContain('Gym');
});

it('gives a new building to the department of whoever makes it', function () {
    $this->actingAs($this->master)->postJson('/api/buildings', ['name' => 'Annex', 'department' => 'JHS'])->assertCreated();
    $this->actingAs($this->glc)->postJson('/api/buildings', ['name' => 'Science Hall'])->assertCreated();
    $this->actingAs($this->admin)->postJson('/api/buildings', ['name' => 'Library', 'department' => null])->assertCreated();

    expect(DB::table('buildings')->where('name', 'Annex')->value('department'))->toBe('SHS')
        ->and(DB::table('buildings')->where('name', 'Science Hall')->value('department'))->toBe('JHS')
        ->and(DB::table('buildings')->where('name', 'Library')->value('department'))->toBeNull();
});

it('lets only the own department change a building, and only the Admin change a shared one', function () {
    $this->actingAs($this->master);
    $this->putJson("/api/buildings/{$this->jhsBuilding}", ['name' => 'Taken'])->assertForbidden();
    $this->postJson("/api/buildings/{$this->jhsBuilding}/rooms", ['room_number' => '302', 'is_active' => true])->assertForbidden();
    $this->putJson("/api/rooms/{$this->gymRoom}", ['room_number' => 'G2', 'is_active' => true])->assertForbidden();
    $this->deleteJson("/api/buildings/{$this->gym}")->assertForbidden();
    $this->putJson("/api/buildings/{$this->shsBuilding}", ['name' => 'Senior Hall'])->assertOk();

    $this->getJson('/api/buildings')->assertJsonFragment(['name' => 'Gym', 'can_edit' => false]);

    $this->actingAs($this->admin);
    $this->putJson("/api/buildings/{$this->gym}", ['name' => 'Gym', 'department' => 'SHS'])->assertOk();
    expect(DB::table('buildings')->where('id', $this->gym)->value('department'))->toBe('SHS');
});

it('offers a section only rooms of its department and shared ones', function () {
    $this->actingAs($this->master);

    $rooms = collect($this->getJson("/api/terms/{$this->termId}/sections/{$this->stem->id}/plotter")->assertOk()->json('data.rooms'))->pluck('id');

    expect($rooms)->toContain($this->shsRoom)->toContain($this->gymRoom)->not->toContain($this->jhsRoom);
});

it('refuses a room of the other department for a class or a home room', function () {
    $pattern = DB::table('day_patterns')->insertGetId(['school_year_id' => $this->yearId, 'level' => 'SHS', 'shift' => 'WHOLE_DAY', 'name' => 'Monday – Friday', 'days' => '{1,2,3,4,5}']);
    $slot = TimeSlot::create(['day_pattern_id' => $pattern, 'period_no' => 1, 'start_time' => '07:15', 'end_time' => '08:00', 'is_break' => false]);
    $subject = DB::table('subjects')->insertGetId(['school_year_id' => $this->yearId, 'grade_level_id' => $this->stem->grade_level_id, 'name' => 'Gen Bio', 'minutes_per_week' => 240]);
    $teacher = DB::table('teachers')->insertGetId(['first_name' => 'Ana', 'last_name' => 'Reyes']);
    $loading = SectionSubject::create(['term_id' => $this->termId, 'section_id' => $this->stem->id, 'subject_id' => $subject, 'teacher_id' => $teacher]);
    $this->actingAs($this->admin);

    $this->putJson("/api/terms/{$this->termId}/sections/{$this->stem->id}/slots/{$slot->id}", ['section_subject_id' => $loading->id, 'room_id' => $this->jhsRoom, 'days' => [1]])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['room_id' => 'department']);
    $this->putJson("/api/sections/{$this->stem->id}/room", ['room_id' => $this->jhsRoom])->assertUnprocessable();
    $this->putJson("/api/sections/{$this->stem->id}/room", ['room_id' => $this->gymRoom])->assertOk();
});

it('keeps the other department\'s rooms off the Schedule page and its room schedules', function () {
    $this->actingAs($this->master);

    $buildings = collect($this->getJson("/api/terms/{$this->termId}/schedule-map")->assertOk()->json('data.buildings'))->pluck('name');
    expect($buildings)->not->toContain('Junior Wing');

    $this->getJson("/api/terms/{$this->termId}/rooms/{$this->jhsRoom}/schedule")->assertNotFound();
    $this->getJson("/api/terms/{$this->termId}/reports/rooms/{$this->jhsRoom}")->assertNotFound();
    $this->getJson("/api/terms/{$this->termId}/rooms/{$this->shsRoom}/schedule")->assertOk();
});

it('keeps activities apart the same way', function () use ($names) {
    $this->actingAs($this->glc)->postJson("/api/school-years/{$this->yearId}/activities", ['name' => 'JHS Club Day'])->assertCreated();
    $this->actingAs($this->master)->postJson("/api/school-years/{$this->yearId}/activities", ['name' => 'SHS Work Immersion'])->assertCreated();

    $this->actingAs($this->glc);
    $glcSees = $names($this->getJson("/api/school-years/{$this->yearId}/activities")->assertOk());
    $this->actingAs($this->master);
    $masterSees = $names($this->getJson("/api/school-years/{$this->yearId}/activities")->assertOk());

    // The seeded Flag Ceremony is school-wide: both see it, neither changes it.
    expect($glcSees)->toContain('JHS Club Day')->toContain('Flag Ceremony')->not->toContain('SHS Work Immersion')
        ->and($masterSees)->toContain('SHS Work Immersion')->toContain('Flag Ceremony')->not->toContain('JHS Club Day');

    $clubDay = DB::table('activities')->where('name', 'JHS Club Day')->value('id');
    $this->putJson("/api/activities/{$clubDay}", ['name' => 'Taken'])->assertForbidden();
    expect(DB::table('activities')->where('id', $clubDay)->value('department'))->toBe('JHS');
});

it('still shares the teachers', function () {
    $teacher = DB::table('teachers')->insertGetId(['first_name' => 'Shared', 'last_name' => 'Teacher', 'personnel_type' => 'teaching']);

    foreach ([$this->glc, $this->master] as $user) {
        $this->actingAs($user);
        expect(collect($this->getJson("/api/terms/{$this->termId}/teachers")->assertOk()->json('data'))->pluck('id'))->toContain($teacher);
    }
});

it('tells where each teacher teaches, for the directory tabs', function () {
    $both = DB::table('teachers')->insertGetId(['first_name' => 'Both', 'last_name' => 'Levels', 'personnel_type' => 'teaching']);
    $none = DB::table('teachers')->insertGetId(['first_name' => 'No', 'last_name' => 'Classes', 'personnel_type' => 'teaching']);
    $subject = DB::table('subjects')->insertGetId(['school_year_id' => $this->yearId, 'grade_level_id' => $this->stem->grade_level_id, 'name' => 'Gen Chem', 'minutes_per_week' => 240]);
    DB::table('section_subjects')->insert(['term_id' => $this->termId, 'section_id' => $this->stem->id, 'subject_id' => $subject, 'teacher_id' => $both]);
    // Adviser of a Grade 7 section, so Junior High too.
    $grade7 = DB::table('sections')->join('grade_levels', 'grade_levels.id', '=', 'sections.grade_level_id')
        ->where('sections.school_year_id', $this->yearId)->where('grade_levels.level', 'JHS')->value('sections.id');
    DB::table('sections')->where('id', $grade7)->update(['adviser_id' => $both]);

    $teachers = collect($this->actingAs($this->admin)->getJson("/api/terms/{$this->termId}/teachers")->assertOk()->json('data'))->keyBy('id');

    expect($teachers[$both]['levels'])->toBe(['JHS', 'SHS'])
        ->and($teachers[$none]['levels'])->toBe([]);
});
