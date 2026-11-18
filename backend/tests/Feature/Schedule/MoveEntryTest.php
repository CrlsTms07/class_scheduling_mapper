<?php

use App\Models\User;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Support\Facades\DB;

function moveGrade(int $grade): int
{
    return DB::table('grade_levels')->where('grade', $grade)->value('id');
}

function moveLoading(object $test, int $sectionId, int $teacherId, string $subject): int
{
    $subjectId = DB::table('subjects')->insertGetId([
        'school_year_id' => $test->yearId, 'grade_level_id' => moveGrade(7), 'name' => $subject, 'minutes_per_week' => 180,
    ]);

    return DB::table('section_subjects')->insertGetId([
        'term_id' => $test->termId, 'section_id' => $sectionId, 'subject_id' => $subjectId, 'teacher_id' => $teacherId,
    ]);
}

function moveEntry(object $test, ?int $loadingId, ?int $teacherId, int $day, string $start, string $end, array $overrides = []): int
{
    return DB::table('schedule_entries')->insertGetId([
        'term_id' => $test->termId, 'section_id' => $test->sectionId, 'section_subject_id' => $loadingId, 'teacher_id' => $teacherId,
        'room_id' => $test->roomId, 'created_by' => $test->glc->id, 'status' => 'draft',
        'day_of_week' => $day, 'start_time' => $start, 'end_time' => $end, ...$overrides,
    ]);
}

function moveBody(object $test, array $overrides = []): array
{
    return ['from_slot_id' => $test->first, 'from_days' => [1, 2], 'days' => [1, 2], ...$overrides];
}

beforeEach(function () {
    $this->withHeader('Referer', 'http://localhost:5173');
    $this->seed(ReferenceDataSeeder::class);

    $this->yearId = DB::table('school_years')->insertGetId([
        'name' => '2026-2027', 'start_date' => '2026-06-01', 'end_date' => '2027-03-31',
    ]);
    $this->termId = DB::table('school_terms')->insertGetId([
        'school_year_id' => $this->yearId, 'term_no' => 1, 'name' => 'First',
        'start_date' => '2026-06-01', 'end_date' => '2026-09-30', 'is_active' => true,
    ]);
    $patternId = DB::table('day_patterns')->insertGetId([
        'school_year_id' => $this->yearId, 'level' => 'JHS', 'shift' => 'WHOLE_DAY', 'name' => 'Monday – Thursday', 'days' => '{1,2,3,4}',
    ]);
    $slot = fn (int $no, string $start, string $end, bool $break = false) => DB::table('time_slots')->insertGetId([
        'day_pattern_id' => $patternId, 'period_no' => $break ? null : $no, 'label' => $break ? 'Recess' : null,
        'start_time' => $start, 'end_time' => $end, 'is_break' => $break,
    ]);
    $this->first = $slot(1, '07:00', '07:45');
    $this->second = $slot(2, '07:45', '08:30');
    $this->recess = $slot(3, '08:30', '08:50', true);

    $this->teacherId = DB::table('teachers')->insertGetId(['first_name' => 'Ana', 'last_name' => 'Reyes']);
    $buildingId = DB::table('buildings')->insertGetId(['name' => 'Main']);
    $this->roomId = DB::table('rooms')->insertGetId(['building_id' => $buildingId, 'room_number' => '101']);
    $this->otherRoom = DB::table('rooms')->insertGetId(['building_id' => $buildingId, 'room_number' => '102']);

    $this->glc = User::factory()->create()->assignRole('glc');
    $this->glc->gradeLevels()->attach(moveGrade(7));

    $this->sectionId = DB::table('sections')->insertGetId([
        'school_year_id' => $this->yearId, 'grade_level_id' => moveGrade(7), 'name' => 'Honesty',
    ]);
    $this->loadingId = moveLoading($this, $this->sectionId, $this->teacherId, 'Math 7');
    $this->monday = moveEntry($this, $this->loadingId, $this->teacherId, 1, '07:00', '07:45');
    $this->tuesday = moveEntry($this, $this->loadingId, $this->teacherId, 2, '07:00', '07:45');

    $this->url = "/api/terms/{$this->termId}/sections/{$this->sectionId}/slots/{$this->second}/move";
    $this->actingAs($this->glc);
});

it('moves a class to another period, keeping its teacher and room', function () {
    $this->postJson($this->url, moveBody($this))->assertOk();

    $monday = DB::table('schedule_entries')->find($this->monday);

    expect($monday->start_time)->toBe('07:45:00')
        ->and($monday->end_time)->toBe('08:30:00')
        ->and($monday->day_of_week)->toBe(1)
        ->and($monday->section_subject_id)->toBe($this->loadingId)
        ->and($monday->teacher_id)->toBe($this->teacherId)
        ->and($monday->room_id)->toBe($this->roomId);
    expect(DB::table('schedule_entries')->find($this->tuesday)->start_time)->toBe('07:45:00');
    expect(DB::table('schedule_entries')->count())->toBe(2);
});

it('moves one class to another day', function () {
    $this->postJson($this->url, moveBody($this, ['from_days' => [1], 'days' => [4]]))->assertOk();

    $moved = DB::table('schedule_entries')->find($this->monday);

    expect($moved->day_of_week)->toBe(4)->and($moved->start_time)->toBe('07:45:00');
    expect(DB::table('schedule_entries')->find($this->tuesday)->day_of_week)->toBe(2);
});

it('takes the place of an open slot', function () {
    $open = moveEntry($this, null, null, 1, '07:45', '08:30', ['room_id' => null]);

    $this->postJson($this->url, moveBody($this, ['from_days' => [1], 'days' => [1]]))->assertOk();

    expect(DB::table('schedule_entries')->find($open))->toBeNull();
    expect(DB::table('schedule_entries')->find($this->monday)->start_time)->toBe('07:45:00');
});

it('refuses a period that already has a subject, and moves nothing', function () {
    $other = moveLoading($this, $this->sectionId, DB::table('teachers')->insertGetId(['first_name' => 'Ben', 'last_name' => 'Cruz']), 'Science 7');
    moveEntry($this, $other, DB::table('section_subjects')->find($other)->teacher_id, 2, '07:45', '08:30', ['room_id' => $this->otherRoom]);

    $this->postJson($this->url, moveBody($this))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('days');

    expect(DB::table('schedule_entries')->find($this->monday)->start_time)->toBe('07:00:00');
});

it('stops on a teacher conflict with another section, and moves nothing', function () {
    $otherSection = DB::table('sections')->insertGetId(['school_year_id' => $this->yearId, 'grade_level_id' => moveGrade(7), 'name' => 'Hope']);
    $loading = moveLoading($this, $otherSection, $this->teacherId, 'Math Hope');
    DB::table('schedule_entries')->insert([
        'term_id' => $this->termId, 'section_id' => $otherSection, 'section_subject_id' => $loading, 'teacher_id' => $this->teacherId,
        'room_id' => $this->otherRoom, 'created_by' => $this->glc->id, 'status' => 'draft',
        'day_of_week' => 2, 'start_time' => '07:45', 'end_time' => '08:30',
    ]);

    $this->postJson($this->url, moveBody($this))
        ->assertUnprocessable()
        ->assertJsonPath('code', 'schedule_conflict')
        ->assertJsonPath('conflicts.0.type', 'teacher');

    expect(DB::table('schedule_entries')->find($this->monday)->start_time)->toBe('07:00:00');
    expect(DB::table('schedule_entries')->find($this->tuesday)->start_time)->toBe('07:00:00');
});

it('stops on a room conflict with another section', function () {
    $otherSection = DB::table('sections')->insertGetId(['school_year_id' => $this->yearId, 'grade_level_id' => moveGrade(7), 'name' => 'Hope']);
    DB::table('schedule_entries')->insert([
        'term_id' => $this->termId, 'section_id' => $otherSection, 'room_id' => $this->roomId, 'created_by' => $this->glc->id,
        'status' => 'draft', 'day_of_week' => 1, 'start_time' => '07:45', 'end_time' => '08:30',
    ]);

    $this->postJson($this->url, moveBody($this))
        ->assertUnprocessable()
        ->assertJsonPath('conflicts.0.type', 'room');
});

it('refuses when there is nothing at the source', function () {
    $this->postJson($this->url, moveBody($this, ['from_days' => [3], 'days' => [3]]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('from_days');
});

it('does not move an open slot', function () {
    moveEntry($this, null, null, 3, '07:00', '07:45', ['room_id' => null]);

    $this->postJson($this->url, moveBody($this, ['from_days' => [3], 'days' => [3]]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('from_days');
});

it('refuses a break, or days outside the bell schedule', function () {
    $this->postJson("/api/terms/{$this->termId}/sections/{$this->sectionId}/slots/{$this->recess}/move", moveBody($this))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('time_slot');

    $this->postJson($this->url, moveBody($this, ['from_days' => [1], 'days' => [5]]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('days');
});

it('refuses uneven days', function () {
    $this->postJson($this->url, moveBody($this, ['from_days' => [1, 2], 'days' => [1]]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('days');
});

it('is locked once submitted', function (string $status) {
    DB::table('schedule_entries')->update(['status' => $status]);

    $this->postJson($this->url, moveBody($this))->assertUnprocessable();

    expect(DB::table('schedule_entries')->find($this->monday)->start_time)->toBe('07:00:00');
})->with(['pending', 'approved', 'rejected']);

it('is not for another grade level', function () {
    $other = User::factory()->create()->assignRole('glc');
    $other->gradeLevels()->attach(moveGrade(8));
    $this->actingAs($other);
    $this->postJson($this->url, moveBody($this))->assertForbidden();
});
