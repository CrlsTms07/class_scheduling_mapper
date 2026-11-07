<?php

use App\Models\User;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Support\Facades\DB;

function subjectGrade(int $grade): int
{
    return DB::table('grade_levels')->where('grade', $grade)->value('id');
}

beforeEach(function () {
    $this->withHeader('Referer', 'http://localhost:5173');
    $this->seed(ReferenceDataSeeder::class);

    // A Chairperson of Grades 7 and 8 only, to prove the scope.
    $this->glc = User::factory()->create()->assignRole('glc');
    $this->glc->gradeLevels()->sync([subjectGrade(7), subjectGrade(8)]);
    $this->actingAs($this->glc);

    $this->yearId = DB::table('school_years')->insertGetId([
        'name' => '2026-2027', 'term_count' => 2, 'start_date' => '2026-06-01', 'end_date' => '2027-03-31',
    ]);
    foreach ([1, 2] as $termNo) {
        DB::table('school_terms')->insert([
            'school_year_id' => $this->yearId, 'term_no' => $termNo, 'name' => "Part {$termNo}",
            'start_date' => "2026-0{$termNo}-01", 'end_date' => "2026-0{$termNo}-20",
        ]);
    }
    $this->trackId = DB::table('tracks')->insertGetId(['name' => 'Academic']);
});

function subjectBody(array $overrides = []): array
{
    return [
        'grade_level_id' => subjectGrade(7),
        'track_id' => null,
        'term_no' => null,
        'code' => null,
        'name' => 'Mathematics 7',
        'subject_type' => 'core',
        'minutes_per_week' => 225,
        'is_priority' => false,
        'is_active' => true,
        ...$overrides,
    ];
}

function insertSubject(object $test, array $overrides = []): int
{
    return DB::table('subjects')->insertGetId([
        'school_year_id' => $test->yearId, 'grade_level_id' => subjectGrade(7), 'name' => 'Existing', 'minutes_per_week' => 225, ...$overrides,
    ]);
}

function loadSubject(object $test, int $subjectId): void
{
    $termId = DB::table('school_terms')->where('school_year_id', $test->yearId)->where('term_no', 1)->value('id');
    $sectionId = DB::table('sections')->insertGetId([
        'school_year_id' => $test->yearId, 'grade_level_id' => subjectGrade(7), 'name' => 'Honesty',
    ]);
    $teacherId = DB::table('teachers')->insertGetId(['first_name' => 'A', 'last_name' => 'B']);
    DB::table('section_subjects')->insert([
        'term_id' => $termId, 'section_id' => $sectionId, 'subject_id' => $subjectId, 'teacher_id' => $teacherId,
    ]);
}

it('adds a subject to the school year and writes an audit log', function () {
    $this->postJson("/api/school-years/{$this->yearId}/subjects", subjectBody(['code' => 'MATH7']))->assertCreated();

    $this->getJson("/api/school-years/{$this->yearId}/subjects")
        ->assertOk()
        ->assertJsonPath('data.0.name', 'Mathematics 7')
        ->assertJsonPath('data.0.grade', 7)
        ->assertJsonPath('data.0.level', 'JHS')
        ->assertJsonPath('data.0.code', 'MATH7')
        ->assertJsonPath('data.0.minutes_per_week', 225)
        ->assertJsonPath('data.0.locked_reason', null);

    expect(DB::table('audit_logs')->where('table_name', 'subjects')->where('action', 'create')->exists())->toBeTrue();
});

it('keeps Homeroom Guidance as 60 minutes and priority', function () {
    $this->postJson("/api/school-years/{$this->yearId}/subjects", subjectBody([
        'name' => 'Homeroom Guidance', 'minutes_per_week' => 60, 'is_priority' => true, 'subject_type' => 'other',
    ]))->assertCreated();

    $this->getJson("/api/school-years/{$this->yearId}/subjects")
        ->assertJsonPath('data.0.minutes_per_week', 60)
        ->assertJsonPath('data.0.is_priority', true);
});

describe('grade-level scope', function () {
    it('shows a Chairperson only their own grade levels', function () {
        insertSubject($this, ['name' => 'Mine']);
        insertSubject($this, ['name' => 'Not mine', 'grade_level_id' => subjectGrade(9)]);

        $this->getJson("/api/school-years/{$this->yearId}/subjects")
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Mine');
    });

    it('offers only their own grade levels in the form', function () {
        $this->getJson("/api/school-years/{$this->yearId}/subject-options")
            ->assertOk()
            ->assertJsonCount(2, 'data.grade_levels')
            ->assertJsonPath('data.terms.1.name', 'Part 2')
            ->assertJsonPath('data.tracks.0.name', 'Academic');
    });

    it('refuses to add a subject outside their grade levels', function () {
        $this->postJson("/api/school-years/{$this->yearId}/subjects", subjectBody(['grade_level_id' => subjectGrade(9)]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['grade_level_id' => 'not assigned']);
    });

    it('refuses to change or delete a subject outside their grade levels', function () {
        $other = insertSubject($this, ['grade_level_id' => subjectGrade(9)]);

        $this->putJson("/api/subjects/{$other}", subjectBody())->assertForbidden();
        $this->deleteJson("/api/subjects/{$other}")->assertForbidden();

        expect(DB::table('subjects')->where('id', $other)->exists())->toBeTrue();
    });

    it('refuses to move their subject into a grade outside their scope', function () {
        $mine = insertSubject($this);

        $this->putJson("/api/subjects/{$mine}", subjectBody(['grade_level_id' => subjectGrade(9)]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('grade_level_id');
    });
});

describe('other roles', function () {
    it('shows the Admin everything but lets them change nothing', function () {
        $subject = insertSubject($this);
        insertSubject($this, ['name' => 'Grade 9', 'grade_level_id' => subjectGrade(9)]);
        $this->actingAs(User::factory()->create()->assignRole('super_admin'));

        $this->getJson("/api/school-years/{$this->yearId}/subjects")->assertOk()->assertJsonCount(2, 'data');
        $this->postJson("/api/school-years/{$this->yearId}/subjects", subjectBody())->assertForbidden();
        $this->putJson("/api/subjects/{$subject}", subjectBody())->assertForbidden();
        $this->deleteJson("/api/subjects/{$subject}")->assertForbidden();
    });

    it('keeps people who only teach out', function () {
        $this->actingAs(User::factory()->create()->assignRole('teacher'));

        $this->getJson("/api/school-years/{$this->yearId}/subjects")->assertForbidden();
        $this->getJson("/api/school-years/{$this->yearId}/subject-options")->assertForbidden();
        $this->postJson("/api/school-years/{$this->yearId}/subjects", subjectBody())->assertForbidden();
    });
});

describe('Senior High', function () {
    beforeEach(function () {
        $this->masterTeacher = User::factory()->create()->assignRole('master_teacher');
        $this->masterTeacher->gradeLevels()->sync([subjectGrade(11)]);
        $this->actingAs($this->masterTeacher);
    });

    it('saves a subject per term and track', function () {
        $this->postJson("/api/school-years/{$this->yearId}/subjects", subjectBody([
            'grade_level_id' => subjectGrade(11), 'term_no' => 2, 'track_id' => $this->trackId, 'subject_type' => 'elective',
        ]))->assertCreated();

        $this->getJson("/api/school-years/{$this->yearId}/subjects")
            ->assertJsonPath('data.0.term_no', 2)
            ->assertJsonPath('data.0.track', 'Academic')
            ->assertJsonPath('data.0.subject_type', 'elective');
    });

    it('allows the same name in another term or track', function () {
        $body = subjectBody(['grade_level_id' => subjectGrade(11), 'name' => 'Filipino', 'term_no' => 1]);

        $this->postJson("/api/school-years/{$this->yearId}/subjects", $body)->assertCreated();
        $this->postJson("/api/school-years/{$this->yearId}/subjects", [...$body, 'term_no' => 2])->assertCreated();
        $this->postJson("/api/school-years/{$this->yearId}/subjects", [...$body, 'track_id' => $this->trackId])->assertCreated();
    });

    it('refuses a term the school year does not have', function () {
        $this->postJson("/api/school-years/{$this->yearId}/subjects", subjectBody([
            'grade_level_id' => subjectGrade(11), 'term_no' => 3,
        ]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['term_no' => 'no such term']);
    });
});

it('rejects bad subjects', function (callable $change, string $field) {
    insertSubject($this, ['name' => 'Taken']);

    $this->postJson("/api/school-years/{$this->yearId}/subjects", subjectBody($change($this)))
        ->assertUnprocessable()
        ->assertJsonValidationErrors($field);
})->with([
    'no name' => [fn ($test) => ['name' => ''], 'name'],
    'name taken' => [fn ($test) => ['name' => 'taken'], 'name'],
    'no minutes' => [fn ($test) => ['minutes_per_week' => 0], 'minutes_per_week'],
    'too many minutes' => [fn ($test) => ['minutes_per_week' => 5000], 'minutes_per_week'],
    'unknown type' => [fn ($test) => ['subject_type' => 'fun'], 'subject_type'],
    'track on JHS' => [fn ($test) => ['track_id' => $test->trackId], 'track_id'],
]);

it('allows the same name in another school year', function () {
    $otherYear = DB::table('school_years')->insertGetId([
        'name' => '2027-2028', 'start_date' => '2027-06-01', 'end_date' => '2028-03-31',
    ]);
    DB::table('subjects')->insert([
        'school_year_id' => $otherYear, 'grade_level_id' => subjectGrade(7), 'name' => 'Mathematics 7', 'minutes_per_week' => 225,
    ]);

    $this->postJson("/api/school-years/{$this->yearId}/subjects", subjectBody())->assertCreated();
});

it('saves a subject without tripping over its own name', function () {
    $id = insertSubject($this, ['name' => 'Mathematics 7']);

    $this->putJson("/api/subjects/{$id}", subjectBody(['minutes_per_week' => 200]))->assertOk();

    expect(DB::table('subjects')->where('id', $id)->value('minutes_per_week'))->toBe(200);
});

it('deletes a subject with no loading', function () {
    $id = insertSubject($this);

    $this->deleteJson("/api/subjects/{$id}")->assertOk();

    expect(DB::table('subjects')->count())->toBe(0);
});

describe('once a subject has teacher loading', function () {
    beforeEach(function () {
        $this->subjectId = insertSubject($this, ['name' => 'Mathematics 7']);
        loadSubject($this, $this->subjectId);
    });

    it('says so on the list', function () {
        $this->getJson("/api/school-years/{$this->yearId}/subjects")
            ->assertJsonPath('data.0.locked_reason', 'This subject already has teacher loading.');
    });

    it('cannot change grade or term', function () {
        $this->putJson("/api/subjects/{$this->subjectId}", subjectBody(['grade_level_id' => subjectGrade(8)]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('grade_level_id');
        $this->putJson("/api/subjects/{$this->subjectId}", subjectBody(['term_no' => 1]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('term_no');
    });

    it('can still change name, minutes and whether it is offered', function () {
        $this->putJson("/api/subjects/{$this->subjectId}", subjectBody([
            'name' => 'Math', 'minutes_per_week' => 200, 'is_active' => false,
        ]))->assertOk();

        expect(DB::table('subjects')->where('id', $this->subjectId)->value('name'))->toBe('Math');
    });

    it('cannot be deleted', function () {
        $this->deleteJson("/api/subjects/{$this->subjectId}")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['subject' => 'not offered']);
    });
});

it('lets a scheduler add a track for their subjects', function () {
    $this->postJson('/api/tracks', ['name' => 'TechPro'])->assertCreated();
});
