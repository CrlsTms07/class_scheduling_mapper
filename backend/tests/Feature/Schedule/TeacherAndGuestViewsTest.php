<?php

use App\Models\User;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Support\Facades\DB;

function viewsGrade(int $grade): int
{
    return DB::table('grade_levels')->where('grade', $grade)->value('id');
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
    $this->secondTerm = DB::table('school_terms')->insertGetId([
        'school_year_id' => $this->yearId, 'term_no' => 2, 'name' => 'Second',
        'start_date' => '2026-10-01', 'end_date' => '2026-12-15',
    ]);
    $patternId = DB::table('day_patterns')->insertGetId([
        'school_year_id' => $this->yearId, 'level' => 'JHS', 'shift' => 'WHOLE_DAY', 'name' => 'Monday – Friday', 'days' => '{1,2,3,4,5}',
    ]);
    DB::table('time_slots')->insert([
        ['day_pattern_id' => $patternId, 'period_no' => 1, 'label' => null, 'start_time' => '07:00', 'end_time' => '07:45', 'is_break' => false],
        ['day_pattern_id' => $patternId, 'period_no' => 2, 'label' => null, 'start_time' => '07:45', 'end_time' => '08:30', 'is_break' => false],
    ]);

    $this->account = User::factory()->create()->assignRole('teacher');
    $this->teacherId = DB::table('teachers')->insertGetId([
        'first_name' => 'Ana', 'last_name' => 'Reyes', 'user_id' => $this->account->id,
    ]);
    $this->sectionId = DB::table('sections')->insertGetId([
        'school_year_id' => $this->yearId, 'grade_level_id' => viewsGrade(7), 'name' => 'Honesty', 'adviser_id' => $this->teacherId,
    ]);
    $buildingId = DB::table('buildings')->insertGetId(['name' => 'Main']);
    $this->roomId = DB::table('rooms')->insertGetId(['building_id' => $buildingId, 'room_number' => '101']);
    $this->loadingId = viewsLoading($this, 'Math 7');
});

function viewsLoading(object $test, string $subject, ?int $sectionId = null, ?int $termId = null): int
{
    $subjectId = DB::table('subjects')->insertGetId([
        'school_year_id' => $test->yearId, 'grade_level_id' => viewsGrade(7), 'name' => $subject, 'minutes_per_week' => 225,
    ]);

    return DB::table('section_subjects')->insertGetId([
        'term_id' => $termId ?? $test->termId, 'section_id' => $sectionId ?? $test->sectionId,
        'subject_id' => $subjectId, 'teacher_id' => $test->teacherId,
    ]);
}

function viewsEntry(object $test, string $status, int $day = 1, string $start = '07:00', string $end = '07:45', ?int $loadingId = null): void
{
    DB::table('schedule_entries')->insert([
        'term_id' => $test->termId, 'section_id' => $test->sectionId, 'section_subject_id' => $loadingId ?? $test->loadingId,
        'teacher_id' => $test->teacherId, 'room_id' => $test->roomId, 'created_by' => $test->account->id,
        'status' => $status, 'day_of_week' => $day, 'start_time' => $start, 'end_time' => $end,
    ]);
}

describe('My Schedule', function () {
    beforeEach(function () {
        $this->actingAs($this->account);
        $this->url = "/api/terms/{$this->termId}/my-schedule";
    });

    it('shows approved classes only, and says how many are not final', function () {
        viewsEntry($this, 'approved', 1);
        viewsEntry($this, 'draft', 2);
        viewsEntry($this, 'pending', 3);
        viewsEntry($this, 'rejected', 4);

        $this->getJson($this->url)
            ->assertOk()
            ->assertJsonPath('data.heading', 'ANA REYES')
            ->assertJsonPath('data.rows.0.cells.1.0.1', 'Math 7')
            ->assertJsonPath('data.rows.0.cells.2', [])
            ->assertJsonPath('data.totals.week', 45)
            ->assertJsonPath('data.not_final_count', 2);
    });

    it('follows the term asked for', function () {
        viewsEntry($this, 'approved');

        $this->getJson("/api/terms/{$this->secondTerm}/my-schedule")->assertJsonPath('data.rows', []);
    });

    it('never shows someone else\'s classes', function () {
        viewsEntry($this, 'approved');
        $other = User::factory()->create()->assignRole('teacher');
        DB::table('teachers')->insert(['first_name' => 'Ben', 'last_name' => 'Cruz', 'user_id' => $other->id]);

        $this->actingAs($other);

        $this->getJson($this->url)
            ->assertJsonPath('data.heading', 'BEN CRUZ')
            ->assertJsonPath('data.rows', []);
    });

    it('says nothing is linked when the account has no personnel record', function () {
        $this->actingAs(User::factory()->create()->assignRole('teacher'));

        $this->getJson($this->url)->assertOk()->assertJsonPath('data', null);
        $this->getJson("{$this->url}/program.pdf")->assertNotFound();
        $this->getJson("{$this->url}/program.xlsx")->assertNotFound();
    });

    it('downloads as PDF and XLSX', function () {
        viewsEntry($this, 'approved');

        $pdf = $this->get("{$this->url}/program.pdf")->assertOk();
        $xlsx = $this->get("{$this->url}/program.xlsx")->assertOk();

        expect(substr($pdf->getContent(), 0, 4))->toBe('%PDF')
            ->and($pdf->headers->get('Content-Disposition'))->toContain('my-schedule-ana-reyes-first.pdf')
            ->and(substr($xlsx->getContent(), 0, 2))->toBe('PK');
    });

    it('needs a sign-in', function () {
        auth()->logout();
        $this->app['auth']->forgetGuards();

        $this->getJson($this->url)->assertUnauthorized();
    });
});

describe('My Profile', function () {
    it('shows the person\'s own record, with tasks of the term', function () {
        $this->actingAs($this->account);
        $departmentId = DB::table('departments')->insertGetId(['name' => 'Mathematics']);
        $designationId = DB::table('designations')->insertGetId(['name' => 'Teacher I']);
        DB::table('teachers')->where('id', $this->teacherId)->update(['department_id' => $departmentId, 'designation_id' => $designationId]);
        DB::table('teacher_qualifications')->insert(['teacher_id' => $this->teacherId, 'degree_level' => 'Bachelor', 'degree' => 'BSEd']);
        $taskId = DB::table('teaching_tasks')->insertGetId(['name' => 'ICT Coordinator']);
        DB::table('teacher_tasks')->insert(['teacher_id' => $this->teacherId, 'task_id' => $taskId, 'term_id' => $this->termId]);

        $this->getJson("/api/terms/{$this->termId}/my-profile")
            ->assertOk()
            ->assertJsonPath('data.printed_name', 'Ana Reyes')
            ->assertJsonPath('data.email', $this->account->email)
            ->assertJsonPath('data.department', 'Mathematics')
            ->assertJsonPath('data.designation', 'Teacher I')
            ->assertJsonPath('data.advisory', 'Grade 7 – Honesty')
            ->assertJsonPath('data.assigned', 1)
            ->assertJsonPath('data.tasks', ['ICT Coordinator'])
            ->assertJsonPath('data.qualifications.0.degree', 'BSEd');

        $this->getJson("/api/terms/{$this->secondTerm}/my-profile")->assertJsonPath('data.tasks', []);
    });

    it('has nothing to show without a personnel record', function () {
        $this->actingAs(User::factory()->create()->assignRole('teacher'));

        $this->getJson("/api/terms/{$this->termId}/my-profile")->assertOk()->assertJsonPath('data', null);
    });
});

describe('Guest view, with no sign-in', function () {
    it('lists the sections of the active year and which are ready', function () {
        viewsEntry($this, 'approved');
        DB::table('sections')->insert(['school_year_id' => $this->yearId, 'grade_level_id' => viewsGrade(8), 'name' => 'Hope']);

        $this->getJson('/api/guest/sections')
            ->assertOk()
            ->assertJsonPath('data.term.name', 'First')
            ->assertJsonPath('data.sections.0.name', 'Honesty')
            ->assertJsonPath('data.sections.0.level', 'JHS')
            ->assertJsonPath('data.sections.0.is_ready', true)
            ->assertJsonPath('data.sections.1.name', 'Hope')
            ->assertJsonPath('data.sections.1.is_ready', false);
    });

    it('has nothing when no term is active', function () {
        DB::table('school_terms')->update(['is_active' => false]);

        $this->getJson('/api/guest/sections')->assertJsonPath('data.term', null)->assertJsonPath('data.sections', []);
    });

    it('shows a fully approved schedule', function () {
        viewsEntry($this, 'approved');

        $this->getJson("/api/guest/sections/{$this->sectionId}")
            ->assertOk()
            ->assertJsonPath('data.state', 'ready')
            ->assertJsonPath('data.label', 'Grade 7 – Honesty')
            ->assertJsonPath('data.adviser', 'Ana Reyes')
            ->assertJsonPath('data.week.rows.0.cells.1.subject', 'Math 7');
    });

    it('keeps two bell schedules apart, even when a period starts at the same time', function () {
        $yearPattern = DB::table('day_patterns')->where('school_year_id', $this->yearId)->first();
        DB::table('day_patterns')->where('id', $yearPattern->id)->update(['name' => 'Monday – Thursday', 'days' => '{1,2,3,4}']);
        $friday = DB::table('day_patterns')->insertGetId([
            'school_year_id' => $this->yearId, 'level' => 'JHS', 'shift' => 'WHOLE_DAY', 'name' => 'Friday', 'days' => '{5}',
        ]);
        DB::table('time_slots')->insert([
            'day_pattern_id' => $friday, 'period_no' => 1, 'label' => null, 'start_time' => '07:00', 'end_time' => '07:40', 'is_break' => false,
        ]);
        viewsEntry($this, 'approved', 1);

        $week = $this->getJson("/api/guest/sections/{$this->sectionId}")->assertOk()->json('data.week');

        expect($week['patterns'])->toBe([
            ['name' => 'Monday – Thursday', 'days' => [1, 2, 3, 4]],
            ['name' => 'Friday', 'days' => [5]],
        ]);

        $friday40 = collect($week['rows'])->firstWhere('minutes', 40);
        $monday45 = collect($week['rows'])->first(fn ($row) => $row['minutes'] === 45 && str_starts_with($row['start_time'], '07:00'));

        expect($friday40['days'])->toBe([5])
            ->and($friday40['cells']['1'])->toBeNull()
            ->and($monday45['days'])->toBe([1, 2, 3, 4])
            ->and($monday45['cells']['1']['subject'])->toBe('Math 7');
    });

    it('says it is being updated unless every entry is approved, showing nothing else', function (string $other) {
        viewsEntry($this, 'approved');
        viewsEntry($this, $other, 2);

        $response = $this->getJson("/api/guest/sections/{$this->sectionId}")
            ->assertOk()
            ->assertJsonPath('data.state', 'updating');

        expect($response->json('data'))->not->toHaveKeys(['week', 'adviser']);
        $this->get("/api/guest/sections/{$this->sectionId}/class-program.pdf")->assertNotFound();
    })->with(['draft', 'pending', 'rejected']);

    it('says not ready for a section with nothing on it', function () {
        $this->getJson("/api/guest/sections/{$this->sectionId}")->assertJsonPath('data.state', 'not_ready');
    });

    it('only looks at the active term', function () {
        viewsEntry($this, 'approved');
        DB::table('school_terms')->update(['is_active' => false]);
        DB::table('school_terms')->where('id', $this->secondTerm)->update(['is_active' => true]);

        $this->getJson("/api/guest/sections/{$this->sectionId}")->assertJsonPath('data.state', 'not_ready');
    });

    it('does not find a section of another school year', function () {
        $otherYear = DB::table('school_years')->insertGetId([
            'name' => '2025-2026', 'start_date' => '2025-06-01', 'end_date' => '2026-03-31',
        ]);
        $old = DB::table('sections')->insertGetId([
            'school_year_id' => $otherYear, 'grade_level_id' => viewsGrade(7), 'name' => 'Old',
        ]);

        $this->getJson("/api/guest/sections/{$old}")->assertNotFound();
        $this->get("/api/guest/sections/{$old}/class-program.pdf")->assertNotFound();
    });

    it('offers the PDF once approved', function () {
        viewsEntry($this, 'approved');

        $response = $this->get("/api/guest/sections/{$this->sectionId}/class-program.pdf")->assertOk();

        expect(substr($response->getContent(), 0, 4))->toBe('%PDF');
    });

    it('never gives out the private parts of the system', function () {
        $this->getJson('/api/users')->assertUnauthorized();
        $this->getJson("/api/terms/{$this->termId}/teachers")->assertUnauthorized();
        $this->getJson("/api/terms/{$this->termId}/sections/{$this->sectionId}/plotter")->assertUnauthorized();
    });
});
