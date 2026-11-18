<?php

use App\Models\User;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Support\Facades\DB;

/*
 * The plotter offers only periods that are free for the section, its teacher and its room
 * (UI requirement 6). This endpoint only reads: it never saves anything.
 */

function freeGrade(int $grade): int
{
    return DB::table('grade_levels')->where('grade', $grade)->value('id');
}

function freeSection(object $test, string $name, int $grade = 7): int
{
    return DB::table('sections')->insertGetId(['school_year_id' => $test->yearId, 'grade_level_id' => freeGrade($grade), 'name' => $name]);
}

function freeEntry(object $test, int $sectionId, array $values): void
{
    DB::table('schedule_entries')->insert([
        'term_id' => $test->termId, 'section_id' => $sectionId, 'created_by' => $test->glc->id,
        'status' => 'draft', 'day_of_week' => 1, 'start_time' => '07:00', 'end_time' => '07:45',
        ...$values,
    ]);
}

function freeLoading(object $test, int $sectionId, int $teacherId): int
{
    $subjectId = DB::table('subjects')->insertGetId([
        'school_year_id' => $test->yearId, 'grade_level_id' => freeGrade(7), 'name' => 'Math '.$sectionId, 'minutes_per_week' => 225,
    ]);

    return DB::table('section_subjects')->insertGetId(['term_id' => $test->termId, 'section_id' => $sectionId, 'subject_id' => $subjectId, 'teacher_id' => $teacherId]);
}

beforeEach(function () {
    $this->withHeader('Referer', 'http://localhost:5173');
    $this->seed(ReferenceDataSeeder::class);

    $this->yearId = DB::table('school_years')->insertGetId(['name' => '2026-2027', 'start_date' => '2026-06-01', 'end_date' => '2027-03-31']);
    $this->termId = DB::table('school_terms')->insertGetId([
        'school_year_id' => $this->yearId, 'term_no' => 1, 'name' => 'First',
        'start_date' => '2026-06-01', 'end_date' => '2026-09-30', 'is_active' => true,
    ]);
    $patternId = DB::table('day_patterns')->insertGetId([
        'school_year_id' => $this->yearId, 'level' => 'JHS', 'shift' => 'WHOLE_DAY', 'name' => 'Monday – Tuesday', 'days' => '{1,2}',
    ]);
    $this->slotId = DB::table('time_slots')->insertGetId(['day_pattern_id' => $patternId, 'period_no' => 1, 'label' => null, 'start_time' => '07:00', 'end_time' => '07:45', 'is_break' => false]);
    DB::table('time_slots')->insert(['day_pattern_id' => $patternId, 'period_no' => null, 'label' => 'Recess', 'start_time' => '07:45', 'end_time' => '08:05', 'is_break' => true]);

    $this->ana = DB::table('teachers')->insertGetId(['first_name' => 'Ana', 'last_name' => 'Reyes']);
    $buildingId = DB::table('buildings')->insertGetId(['name' => 'Main']);
    $this->room = DB::table('rooms')->insertGetId(['building_id' => $buildingId, 'room_number' => '101']);
    $this->otherRoom = DB::table('rooms')->insertGetId(['building_id' => $buildingId, 'room_number' => '102']);

    $this->glc = User::factory()->create()->assignRole('glc');
    $this->glc->gradeLevels()->attach(freeGrade(7));
    $this->actingAs($this->glc);

    $this->mine = freeSection($this, 'Honesty');
    $this->other = freeSection($this, 'Hope');
    $this->url = "/api/terms/{$this->termId}/sections/{$this->mine}/free-periods";
});

it('lists every period with its free days, and leaves breaks out', function () {
    $this->getJson("{$this->url}?teacher_id={$this->ana}&room_id={$this->room}")
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.slot_id', $this->slotId)
        ->assertJsonPath('data.0.minutes', 45)
        ->assertJsonPath('data.0.free_days', [1, 2])
        ->assertJsonPath('data.0.busy', []);
});

it('says when the teacher is teaching another section', function () {
    freeEntry($this, $this->other, ['section_subject_id' => freeLoading($this, $this->other, $this->ana), 'teacher_id' => $this->ana, 'room_id' => $this->otherRoom]);

    $this->getJson("{$this->url}?teacher_id={$this->ana}&room_id={$this->room}")
        ->assertJsonPath('data.0.free_days', [2])
        ->assertJsonPath('data.0.busy.0.day', 1)
        ->assertJsonPath('data.0.busy.0.reason', fn (string $reason) => str_starts_with($reason, 'Ana Reyes is teaching') && str_contains($reason, 'Hope'));
});

it('says when the room is used by another section', function () {
    $ben = DB::table('teachers')->insertGetId(['first_name' => 'Ben', 'last_name' => 'Cruz']);
    freeEntry($this, $this->other, ['section_subject_id' => freeLoading($this, $this->other, $ben), 'teacher_id' => $ben, 'room_id' => $this->room, 'day_of_week' => 2]);

    $this->getJson("{$this->url}?teacher_id={$this->ana}&room_id={$this->room}")
        ->assertJsonPath('data.0.free_days', [1])
        ->assertJsonPath('data.0.busy.0.reason', fn (string $reason) => str_contains($reason, '101 is used by') && str_contains($reason, 'Hope'));
});

it('counts a class of the section itself as busy, but an open slot as free', function () {
    freeEntry($this, $this->mine, ['section_subject_id' => freeLoading($this, $this->mine, $this->ana), 'teacher_id' => $this->ana, 'room_id' => $this->room]);
    freeEntry($this, $this->mine, ['room_id' => $this->room, 'day_of_week' => 2]);

    $this->getJson($this->url)
        ->assertJsonPath('data.0.free_days', [2])
        ->assertJsonPath('data.0.busy.0.reason', 'This section already has a class then.');
});

it('ignores rejected entries and other terms', function () {
    $loading = freeLoading($this, $this->other, $this->ana);
    freeEntry($this, $this->other, ['section_subject_id' => $loading, 'teacher_id' => $this->ana, 'room_id' => $this->room, 'status' => 'rejected']);
    $otherTerm = DB::table('school_terms')->insertGetId([
        'school_year_id' => $this->yearId, 'term_no' => 2, 'name' => 'Second', 'start_date' => '2026-10-01', 'end_date' => '2026-12-31', 'is_active' => false,
    ]);
    $otherLoading = DB::table('section_subjects')->insertGetId([
        'term_id' => $otherTerm, 'section_id' => $this->other, 'teacher_id' => $this->ana,
        'subject_id' => DB::table('section_subjects')->where('id', $loading)->value('subject_id'),
    ]);
    freeEntry($this, $this->other, ['term_id' => $otherTerm, 'section_subject_id' => $otherLoading, 'teacher_id' => $this->ana, 'room_id' => $this->room, 'day_of_week' => 2]);

    $this->getJson("{$this->url}?teacher_id={$this->ana}&room_id={$this->room}")->assertJsonPath('data.0.free_days', [1, 2]);
});

it('keeps a chairperson to their grade levels, and saves nothing', function () {
    $eight = freeSection($this, 'Faith', 8);

    $this->getJson("/api/terms/{$this->termId}/sections/{$eight}/free-periods")->assertForbidden();
    expect(DB::table('schedule_entries')->count())->toBe(0);
});

it('refuses a teacher or room that does not exist', function () {
    $this->getJson("{$this->url}?teacher_id=99999&room_id=99999")->assertUnprocessable()->assertJsonValidationErrors(['teacher_id', 'room_id']);
});
