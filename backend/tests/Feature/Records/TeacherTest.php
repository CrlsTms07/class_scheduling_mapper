<?php

use App\Models\User;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    $this->withHeader('Referer', 'http://localhost:5173');
    $this->seed(ReferenceDataSeeder::class);

    $this->actingAs(User::factory()->create()->assignRole('glc'));

    $this->yearId = DB::table('school_years')->insertGetId([
        'name' => '2026-2027', 'start_date' => '2026-06-01', 'end_date' => '2027-03-31',
    ]);
    $this->termId = DB::table('school_terms')->insertGetId([
        'school_year_id' => $this->yearId, 'term_no' => 1, 'name' => 'First',
        'start_date' => '2026-06-01', 'end_date' => '2026-09-30', 'is_active' => true,
    ]);
    $this->otherTermId = DB::table('school_terms')->insertGetId([
        'school_year_id' => $this->yearId, 'term_no' => 2, 'name' => 'Second',
        'start_date' => '2026-10-01', 'end_date' => '2026-12-15',
    ]);
    $this->teacherId = DB::table('teachers')->insertGetId(['first_name' => 'Ana', 'last_name' => 'Reyes']);
    $this->taskId = DB::table('teaching_tasks')->insertGetId(['name' => 'ICT Coordinator']);
});

function teacherBody(array $overrides = []): array
{
    return [
        'personnel_type' => 'teaching',
        'first_name' => 'Ben',
        'middle_name' => null,
        'last_name' => 'Cruz',
        'suffix' => null,
        'display_name' => null,
        'department_id' => null,
        'designation_id' => null,
        'shift' => 'WHOLE_DAY',
        'max_subjects' => 5,
        'is_active' => true,
        'qualifications' => [],
        'task_ids' => [],
        ...$overrides,
    ];
}

function teacherSection(object $test, array $overrides = []): int
{
    return DB::table('sections')->insertGetId([
        'school_year_id' => $test->yearId,
        'grade_level_id' => DB::table('grade_levels')->where('grade', 7)->value('id'),
        'name' => 'Honesty',
        ...$overrides,
    ]);
}

function teacherLoading(object $test): void
{
    $gradeId = DB::table('grade_levels')->where('grade', 7)->value('id');
    $subjectId = DB::table('subjects')->insertGetId([
        'school_year_id' => $test->yearId, 'grade_level_id' => $gradeId, 'name' => 'Math 7', 'minutes_per_week' => 225,
    ]);
    DB::table('section_subjects')->insert([
        'term_id' => $test->termId, 'section_id' => teacherSection($test, ['name' => 'Loaded']),
        'subject_id' => $subjectId, 'teacher_id' => $test->teacherId,
    ]);
}

it('lets the Admin manage too, since sections need advisers', function () {
    $this->actingAs(User::factory()->create()->assignRole('super_admin'));

    $this->getJson("/api/terms/{$this->termId}/teachers")->assertOk();
    $this->postJson("/api/terms/{$this->termId}/teachers", teacherBody())->assertCreated();
    $this->postJson('/api/personnel-options/departments', ['name' => 'Math'])->assertCreated();
});

it('keeps people with only a teacher role out completely', function () {
    $this->actingAs(User::factory()->create()->assignRole('teacher'));

    $this->getJson("/api/terms/{$this->termId}/teachers")->assertForbidden();
    $this->getJson('/api/personnel-options')->assertForbidden();
    $this->postJson("/api/terms/{$this->termId}/teachers", teacherBody())->assertForbidden();
    $this->putJson("/api/terms/{$this->termId}/teachers/{$this->teacherId}", teacherBody())->assertForbidden();
    $this->deleteJson("/api/teachers/{$this->teacherId}")->assertForbidden();
    $this->postJson('/api/personnel-options/departments', ['name' => 'Math'])->assertForbidden();
});

it('adds a record with no login account, and writes an audit log', function () {
    $this->postJson("/api/terms/{$this->termId}/teachers", teacherBody())->assertCreated();

    $this->getJson("/api/terms/{$this->termId}/teachers")
        ->assertJsonPath('data.0.last_name', 'Cruz')
        ->assertJsonPath('data.0.printed_name', 'Ben Cruz')
        ->assertJsonPath('data.0.account_email', null)
        ->assertJsonPath('data.0.assigned', 0);

    expect(DB::table('audit_logs')->where('table_name', 'teachers')->where('action', 'create')->exists())->toBeTrue();
});

it('prints the display name, then first name, middle initial and last name', function () {
    DB::table('teachers')->where('id', $this->teacherId)->update(['display_name' => 'A. T. Reyes']);
    DB::table('teachers')->insert(['first_name' => 'Ben', 'middle_name' => 'Santos', 'last_name' => 'Cruz']);

    $this->getJson("/api/terms/{$this->termId}/teachers")
        ->assertJsonPath('data.0.printed_name', 'Ben S. Cruz')
        ->assertJsonPath('data.1.printed_name', 'A. T. Reyes');
});

it('saves department, designation and qualifications', function () {
    $departmentId = $this->postJson('/api/personnel-options/departments', ['name' => 'Math'])->assertCreated()->json('data.id');
    $designationId = $this->postJson('/api/personnel-options/designations', ['name' => 'Teacher I'])->assertCreated()->json('data.id');

    $this->postJson("/api/terms/{$this->termId}/teachers", teacherBody([
        'department_id' => $departmentId,
        'designation_id' => $designationId,
        'qualifications' => [
            ['degree_level' => 'Bachelor', 'degree' => 'BSEd', 'major' => 'Math', 'school' => 'CvSU', 'year_completed' => 2015],
            ['degree_level' => 'Master', 'degree' => 'MAEd'],
        ],
    ]))->assertCreated();

    $this->getJson("/api/terms/{$this->termId}/teachers")
        ->assertJsonPath('data.0.department', 'Math')
        ->assertJsonPath('data.0.designation', 'Teacher I')
        ->assertJsonCount(2, 'data.0.qualifications')
        ->assertJsonPath('data.0.qualifications.0.major', 'Math')
        ->assertJsonPath('data.0.qualifications.1.degree', 'MAEd');
});

it('replaces qualifications when saved again', function () {
    $body = teacherBody(['first_name' => 'Ana', 'last_name' => 'Reyes']);
    $url = "/api/terms/{$this->termId}/teachers/{$this->teacherId}";

    $this->putJson($url, [...$body, 'qualifications' => [['degree_level' => 'Bachelor', 'degree' => 'BSEd']]])->assertOk();
    $this->putJson($url, [...$body, 'qualifications' => [['degree_level' => 'Master', 'degree' => 'MAEd']]])->assertOk();

    expect(DB::table('teacher_qualifications')->where('teacher_id', $this->teacherId)->pluck('degree')->all())->toBe(['MAEd']);
});

it('keeps teaching tasks per term', function () {
    $body = teacherBody(['first_name' => 'Ana', 'last_name' => 'Reyes', 'task_ids' => [$this->taskId]]);

    $this->putJson("/api/terms/{$this->termId}/teachers/{$this->teacherId}", $body)->assertOk();

    $this->getJson("/api/terms/{$this->termId}/teachers")->assertJsonPath('data.0.task_ids', [$this->taskId]);
    $this->getJson("/api/terms/{$this->otherTermId}/teachers")->assertJsonPath('data.0.task_ids', []);

    // Saving in the other term leaves this term's tasks as they are.
    $this->putJson("/api/terms/{$this->otherTermId}/teachers/{$this->teacherId}", [...$body, 'task_ids' => []])->assertOk();
    $this->getJson("/api/terms/{$this->termId}/teachers")->assertJsonPath('data.0.task_ids', [$this->taskId]);
});

it('rejects bad records', function (array $overrides, string $field) {
    $this->postJson("/api/terms/{$this->termId}/teachers", teacherBody($overrides))
        ->assertUnprocessable()
        ->assertJsonValidationErrors($field);
})->with([
    'no first name' => [['first_name' => ''], 'first_name'],
    'no last name' => [['last_name' => ''], 'last_name'],
    'unknown type' => [['personnel_type' => 'guest'], 'personnel_type'],
    'unknown shift' => [['shift' => 'NIGHT'], 'shift'],
    'limit above the maximum' => [['max_subjects' => 9], 'max_subjects'],
    'unknown department' => [['department_id' => 999], 'department_id'],
    'unknown task' => [['task_ids' => [999]], 'task_ids.0'],
    'qualification without a degree' => [['qualifications' => [['degree_level' => 'Bachelor', 'degree' => '']]], 'qualifications.0.degree'],
    'impossible year' => [['qualifications' => [['degree_level' => 'Bachelor', 'degree' => 'BSEd', 'year_completed' => 1800]]], 'qualifications.0.year_completed'],
]);

it('refuses a repeated option', function () {
    $this->postJson('/api/personnel-options/teaching-tasks', ['name' => 'ICT Coordinator'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('name');
});

it('answers 404 for an unknown kind of option', function () {
    $this->postJson('/api/personnel-options/secrets', ['name' => 'X'])->assertNotFound();
});

it('shows the load and advisory of the chosen term', function () {
    teacherLoading($this);
    teacherSection($this, ['adviser_id' => $this->teacherId]);

    $this->getJson("/api/terms/{$this->termId}/teachers")
        ->assertJsonPath('data.0.assigned', 1)
        ->assertJsonPath('data.0.advisory', 'Grade 7 – Honesty');
    $this->getJson("/api/terms/{$this->otherTermId}/teachers")->assertJsonPath('data.0.assigned', 0);
});

it('shows the linked account', function () {
    $user = User::factory()->create();
    DB::table('teachers')->where('id', $this->teacherId)->update(['user_id' => $user->id]);

    $this->getJson("/api/terms/{$this->termId}/teachers")->assertJsonPath('data.0.account_email', $user->email);
});

it('deletes a record with no work, along with its qualifications', function () {
    DB::table('teacher_qualifications')->insert(['teacher_id' => $this->teacherId, 'degree_level' => 'Bachelor', 'degree' => 'BSEd']);

    $this->deleteJson("/api/teachers/{$this->teacherId}")->assertOk();

    expect(DB::table('teachers')->count())->toBe(0)
        ->and(DB::table('teacher_qualifications')->count())->toBe(0);
});

it('refuses to delete a record in use, and says why', function (callable $setUp, string $reason) {
    $setUp($this);

    $this->deleteJson("/api/teachers/{$this->teacherId}")
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['teacher' => $reason]);
})->with([
    'linked account' => [fn ($test) => DB::table('teachers')->where('id', $test->teacherId)->update(['user_id' => User::factory()->create()->id]), 'user account'],
    'advisory' => [fn ($test) => teacherSection($test, ['adviser_id' => $test->teacherId]), 'adviser'],
    'loading' => [fn ($test) => teacherLoading($test), 'teacher loading'],
]);

it('keeps someone with an advisory or loading as teaching personnel', function () {
    teacherLoading($this);

    $this->putJson("/api/terms/{$this->termId}/teachers/{$this->teacherId}", teacherBody([
        'first_name' => 'Ana', 'last_name' => 'Reyes', 'personnel_type' => 'non_teaching',
    ]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['personnel_type' => 'must stay']);
});

it('lets someone with no work become non-teaching', function () {
    $this->putJson("/api/terms/{$this->termId}/teachers/{$this->teacherId}", teacherBody([
        'first_name' => 'Ana', 'last_name' => 'Reyes', 'personnel_type' => 'non_teaching',
    ]))->assertOk();
});

it('offers only teaching, active people as advisers on the Sections form', function () {
    $this->actingAs(User::factory()->create()->assignRole('super_admin'));
    DB::table('teachers')->insert(['first_name' => 'Staff', 'last_name' => 'Only', 'personnel_type' => 'non_teaching']);

    $this->getJson("/api/school-years/{$this->yearId}/section-options")
        ->assertJsonCount(1, 'data.teachers')
        ->assertJsonPath('data.teachers.0.name', 'Ana Reyes');
});
