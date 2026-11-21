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
    $this->departmentId = DB::table('departments')->insertGetId(['name' => 'Mathematics']);
});

function teacherBody(array $overrides = []): array
{
    return [
        'personnel_type' => 'teaching',
        'first_name' => 'Ben',
        'middle_name' => null,
        'last_name' => 'Cruz',
        'suffix' => null,
        'department_id' => DB::table('departments')->value('id'),
        'designation_id' => DB::table('designations')->value('id'),
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
    $this->postJson('/api/personnel-options/departments', ['name' => 'Math', 'level' => 'JHS'])->assertCreated();
});

it('keeps people with only a teacher role out completely', function () {
    $this->actingAs(User::factory()->create()->assignRole('teacher'));

    $this->getJson("/api/terms/{$this->termId}/teachers")->assertForbidden();
    $this->getJson('/api/personnel-options')->assertForbidden();
    $this->postJson("/api/terms/{$this->termId}/teachers", teacherBody())->assertForbidden();
    $this->putJson("/api/terms/{$this->termId}/teachers/{$this->teacherId}", teacherBody())->assertForbidden();
    $this->deleteJson("/api/teachers/{$this->teacherId}")->assertForbidden();
    $this->postJson('/api/personnel-options/departments', ['name' => 'Math', 'level' => 'JHS'])->assertForbidden();
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

it('prints first name, middle initial and last name, made by the code', function () {
    DB::table('teachers')->where('id', $this->teacherId)->update(['display_name' => 'A. T. Reyes']);
    DB::table('teachers')->insert(['first_name' => 'Ben', 'middle_name' => 'Santos', 'last_name' => 'Cruz']);

    $this->getJson("/api/terms/{$this->termId}/teachers")
        ->assertJsonPath('data.0.printed_name', 'Ben S. Cruz')
        ->assertJsonPath('data.1.printed_name', 'Ana Reyes');
});

it('needs the department of every teacher', function () {
    $this->postJson("/api/terms/{$this->termId}/teachers", teacherBody(['department_id' => null]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['department_id' => 'Choose the department. Every teacher belongs to one.']);
});

it('saves department and designation, which are required', function () {
    $departmentId = $this->postJson('/api/personnel-options/departments', ['name' => 'Math', 'level' => 'JHS'])->assertCreated()->json('data.id');
    $designationId = DB::table('designations')->where('name', 'Teacher I')->value('id');

    $this->postJson("/api/terms/{$this->termId}/teachers", teacherBody(['department_id' => $departmentId, 'designation_id' => $designationId]))->assertCreated();

    $this->getJson("/api/terms/{$this->termId}/teachers")
        ->assertJsonPath('data.0.department', 'Math')
        ->assertJsonPath('data.0.designation', 'Teacher I');

    $this->postJson("/api/terms/{$this->termId}/teachers", teacherBody(['designation_id' => null]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['designation_id' => 'Choose the designation']);
});

it('renames a department in place, and refuses a name already in the list', function () {
    $math = $this->postJson('/api/personnel-options/departments', ['name' => 'Filipno', 'level' => 'JHS'])->assertCreated()->json('data.id');
    $this->postJson('/api/personnel-options/departments', ['name' => 'Science', 'level' => 'JHS'])->assertCreated();

    $this->putJson("/api/personnel-options/departments/{$math}", ['name' => 'Filipino'])->assertOk()->assertJsonPath('data.name', 'Filipino');
    $this->putJson("/api/personnel-options/departments/{$math}", ['name' => 'filipino'])->assertOk();
    $this->putJson("/api/personnel-options/departments/{$math}", ['name' => 'science'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['name' => 'This already exists in the list.']);

    expect(DB::table('departments')->where('id', $math)->value('name'))->toBe('filipino');
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
    'no designation' => [['designation_id' => null], 'designation_id'],
    'unknown shift' => [['shift' => 'NIGHT'], 'shift'],
    'unknown department' => [['department_id' => 999], 'department_id'],
    'unknown task' => [['task_ids' => [999]], 'task_ids.0'],
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

it('keeps only teaching personnel: non-teaching staff are out of scope (Nov 21, 2026)', function () {
    $this->putJson("/api/terms/{$this->termId}/teachers/{$this->teacherId}", teacherBody([
        'first_name' => 'Ana', 'last_name' => 'Reyes', 'personnel_type' => 'non_teaching',
    ]))->assertOk();
    DB::table('teachers')->insert(['first_name' => 'Staff', 'last_name' => 'Only', 'personnel_type' => 'non_teaching']);

    expect(DB::table('teachers')->where('id', $this->teacherId)->value('personnel_type'))->toBe('teaching')
        ->and(collect($this->getJson("/api/terms/{$this->termId}/teachers")->json('data'))->pluck('last_name')->all())->toBe(['Reyes']);
});

it('offers only teaching, active people as advisers on the Sections form', function () {
    $this->actingAs(User::factory()->create()->assignRole('super_admin'));
    DB::table('teachers')->insert(['first_name' => 'Staff', 'last_name' => 'Only', 'personnel_type' => 'non_teaching']);

    $this->getJson("/api/school-years/{$this->yearId}/section-options")
        ->assertJsonCount(1, 'data.teachers')
        ->assertJsonPath('data.teachers.0.name', 'Ana Reyes');
});

it('gives every teacher the same load limit, whatever is sent (team decision, Nov 12, 2026)', function () {
    $this->postJson("/api/terms/{$this->termId}/teachers", teacherBody(['max_subjects' => 8]))->assertCreated();

    expect(DB::table('teachers')->orderByDesc('id')->value('max_subjects'))->toBe(5);
});

it('refuses list names that do not read like a name, or are already there in other letters', function () {
    $this->postJson('/api/personnel-options/departments', ['name' => 'vffxfszv', 'level' => 'JHS'])
        ->assertUnprocessable()->assertJsonPath('errors.name.0', 'This does not look like a name (it has no vowel). Check the spelling, or type a short form in capitals, like SSG.');
    $this->postJson('/api/personnel-options/teaching-tasks', ['name' => 'Saaaaa'])->assertUnprocessable();
    $this->postJson('/api/personnel-options/designations', ['name' => 'Teacher #1'])->assertUnprocessable();

    $this->postJson('/api/personnel-options/teaching-tasks', ['name' => 'SSG'])->assertCreated();
    $this->postJson('/api/personnel-options/teaching-tasks', ['name' => 'ict coordinator'])
        ->assertUnprocessable()->assertJsonPath('errors.name.0', 'This already exists in the list.');
});

it('refuses a track name typed at random or already there in other letters', function () {
    $this->actingAs(User::factory()->create()->assignRole('super_admin'));
    $this->postJson('/api/tracks', ['name' => 'vrtgbgvrv'])->assertUnprocessable();
    $this->postJson('/api/tracks', ['name' => 'TechPro'])->assertCreated();
    $this->postJson('/api/tracks', ['name' => 'techpro'])->assertUnprocessable()->assertJsonPath('errors.name.0', 'This track already exists.');
});

describe('departments of each level (Nov 21, 2026)', function () {
    beforeEach(function () {
        $this->mathJhs = DB::table('departments')->insertGetId(['name' => 'Department of Mathematics', 'level' => 'JHS']);
        $this->tvl = DB::table('departments')->insertGetId(['name' => 'TVL', 'level' => 'SHS']);
        DB::table('teachers')->insert([
            ['first_name' => 'Junior', 'last_name' => 'Teacher', 'department_id' => $this->mathJhs],
            ['first_name' => 'Senior', 'last_name' => 'Teacher', 'department_id' => $this->tvl],
        ]);
        $this->master = User::factory()->create()->assignRole('master_teacher');
        $this->master->gradeLevels()->sync([DB::table('grade_levels')->where('grade', 11)->value('id')]);
    });

    it('shows the Master Teacher only Senior High departments and teachers', function () {
        $this->actingAs($this->master);

        expect(collect($this->getJson('/api/personnel-options')->json('data.departments'))->pluck('name')->all())->not->toContain('Department of Mathematics')
            ->and(collect($this->getJson("/api/terms/{$this->termId}/teachers")->json('data'))->pluck('first_name')->all())->toContain('Senior')
            ->and(collect($this->getJson("/api/terms/{$this->termId}/teachers")->json('data'))->pluck('first_name')->all())->not->toContain('Junior');
    });

    it('adds a department to the own level of the Master Teacher, and lets the same name live in each level', function () {
        $this->actingAs($this->master);

        $this->postJson('/api/personnel-options/departments', ['name' => 'Department of Mathematics'])->assertCreated()->assertJsonPath('data.level', 'SHS');
        $this->putJson("/api/personnel-options/departments/{$this->mathJhs}", ['name' => 'Math'])->assertForbidden();
    });

    it('asks the Admin to choose the level of a new department', function () {
        $this->actingAs(User::factory()->create()->assignRole('super_admin'));

        $this->postJson('/api/personnel-options/departments', ['name' => 'Science'])
            ->assertUnprocessable()->assertJsonValidationErrors(['level' => 'Choose Junior High or Senior High first.']);
        $this->postJson('/api/personnel-options/departments', ['name' => 'Science', 'level' => 'SHS'])->assertCreated();
        $this->postJson('/api/personnel-options/departments', ['name' => 'science', 'level' => 'SHS'])->assertUnprocessable();
    });
});

