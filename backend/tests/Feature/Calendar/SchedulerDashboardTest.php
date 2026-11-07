<?php

use App\Models\User;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Support\Facades\DB;

function schedulerGrade(int $grade): int
{
    return DB::table('grade_levels')->where('grade', $grade)->value('id');
}

function schedulerSection(object $test, string $name, int $grade = 7): int
{
    return DB::table('sections')->insertGetId([
        'school_year_id' => $test->yearId, 'grade_level_id' => schedulerGrade($grade), 'name' => $name,
    ]);
}

function schedulerLoading(object $test, int $sectionId, string $subject = 'Math'): int
{
    $subjectId = DB::table('subjects')->insertGetId([
        'school_year_id' => $test->yearId, 'grade_level_id' => schedulerGrade(7),
        'name' => $subject.$sectionId, 'minutes_per_week' => 225,
    ]);

    return DB::table('section_subjects')->insertGetId([
        'term_id' => $test->termId, 'section_id' => $sectionId, 'subject_id' => $subjectId, 'teacher_id' => $test->teacherId,
    ]);
}

function schedulerEntry(object $test, int $sectionId, int $loadingId, string $status): void
{
    // The same teacher throughout, so each entry needs its own day and hour.
    $hour = 7 + DB::table('schedule_entries')->count();

    DB::table('schedule_entries')->insert([
        'term_id' => $test->termId, 'section_id' => $sectionId, 'section_subject_id' => $loadingId,
        'teacher_id' => $test->teacherId, 'room_id' => $test->roomId, 'created_by' => $test->glc->id,
        'status' => $status, 'day_of_week' => 1, 'start_time' => "{$hour}:00", 'end_time' => "{$hour}:45",
    ]);
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
        'school_year_id' => $this->yearId, 'level' => 'JHS', 'shift' => 'WHOLE_DAY', 'name' => 'Monday – Friday', 'days' => '{1,2,3,4,5}',
    ]);
    DB::table('time_slots')->insert([
        'day_pattern_id' => $patternId, 'period_no' => 1, 'label' => null, 'start_time' => '07:00', 'end_time' => '07:45', 'is_break' => false,
    ]);
    $this->teacherId = DB::table('teachers')->insertGetId(['first_name' => 'Ana', 'last_name' => 'Reyes', 'max_subjects' => 1]);
    $buildingId = DB::table('buildings')->insertGetId(['name' => 'Main']);
    $this->roomId = DB::table('rooms')->insertGetId(['building_id' => $buildingId, 'room_number' => '101']);

    $this->glc = User::factory()->create()->assignRole('glc');
    $this->glc->gradeLevels()->attach(schedulerGrade(7));
    $this->url = "/api/terms/{$this->termId}/my-dashboard";
});

it('puts each section at the first thing it needs', function () {
    $empty = schedulerSection($this, 'Empty');
    $loaded = schedulerSection($this, 'Loaded');
    schedulerLoading($this, $loaded);
    $draft = schedulerSection($this, 'Draft');
    schedulerEntry($this, $draft, schedulerLoading($this, $draft), 'draft');
    $rejected = schedulerSection($this, 'Rejected');
    schedulerEntry($this, $rejected, schedulerLoading($this, $rejected), 'rejected');
    $pending = schedulerSection($this, 'Pending');
    schedulerEntry($this, $pending, schedulerLoading($this, $pending), 'pending');
    $approved = schedulerSection($this, 'Approved');
    schedulerEntry($this, $approved, schedulerLoading($this, $approved), 'approved');

    $data = $this->actingAs($this->glc)->getJson($this->url)->assertOk()->json('data');

    expect($data['sections'])->toBe(6)
        ->and($data['pending_sections'])->toBe(1)
        ->and($data['approved_sections'])->toBe(1)
        ->and(collect($data['next_steps'])->pluck('key')->all())->toBe(['revise', 'add_loading', 'plot', 'submit'])
        ->and($data['next_steps'][0]['sections'])->toBe([['id' => $rejected, 'label' => 'Grade 7 – Rejected']])
        ->and($data['next_steps'][1]['sections'][0]['id'])->toBe($empty)
        ->and($data['next_steps'][2]['sections'][0]['id'])->toBe($loaded)
        ->and($data['next_steps'][3]['sections'][0]['id'])->toBe($draft);
});

it('says when the Admin still has to set the bell schedule', function () {
    DB::table('day_patterns')->delete();
    schedulerSection($this, 'Honesty');

    $this->actingAs($this->glc)->getJson($this->url)
        ->assertJsonPath('data.next_steps.0.key', 'no_bell_schedule')
        ->assertJsonPath('data.next_steps.0.sections.0.label', 'Grade 7 – Honesty');
});

it('counts only the grade levels of this user', function () {
    schedulerSection($this, 'Mine');
    $other = schedulerSection($this, 'Other', 8);
    schedulerEntry($this, $other, schedulerLoading($this, $other), 'pending');

    $this->actingAs($this->glc)->getJson($this->url)
        ->assertJsonPath('data.sections', 1)
        ->assertJsonPath('data.pending_sections', 0)
        ->assertJsonCount(1, 'data.progress')
        ->assertJsonPath('data.progress.0.grade', 7);
});

it('lists overloaded teachers only if they teach in these grade levels', function () {
    $mine = schedulerSection($this, 'Mine');
    schedulerLoading($this, $mine, 'One');
    schedulerLoading($this, $mine, 'Two');

    $this->actingAs($this->glc)->getJson($this->url)
        ->assertJsonPath('data.overloaded_teachers.0.name', 'Ana Reyes')
        ->assertJsonPath('data.overloaded_teachers.0.assigned', 2);

    $outsider = User::factory()->create()->assignRole('glc');
    $outsider->gradeLevels()->attach(schedulerGrade(9));

    $this->actingAs($outsider)->getJson($this->url)->assertJsonPath('data.overloaded_teachers', []);
});

it('says when no grade level is assigned yet', function () {
    $this->actingAs(User::factory()->create()->assignRole('master_teacher'))->getJson($this->url)
        ->assertOk()
        ->assertJsonPath('data.has_scope', false)
        ->assertJsonPath('data.sections', 0);
});

it('is only for Chairpersons and Master Teachers', function (string $role) {
    $this->actingAs(User::factory()->create()->assignRole($role))->getJson($this->url)->assertForbidden();
})->with(['super_admin', 'teacher']);

it('needs a sign-in', function () {
    $this->getJson($this->url)->assertUnauthorized();
});
