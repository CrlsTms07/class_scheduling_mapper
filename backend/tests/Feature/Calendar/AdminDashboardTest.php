<?php

use App\Models\User;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    $this->withHeader('Referer', 'http://localhost:5173');
    $this->seed(ReferenceDataSeeder::class);

    $this->admin = User::factory()->create()->assignRole('super_admin');
    $this->actingAs($this->admin);

    $this->yearId = DB::table('school_years')->insertGetId([
        'name' => '2026-2027', 'start_date' => '2026-06-01', 'end_date' => '2027-03-31',
    ]);
    $this->termId = DB::table('school_terms')->insertGetId([
        'school_year_id' => $this->yearId, 'term_no' => 1, 'name' => 'First Term',
        'start_date' => '2026-06-01', 'end_date' => '2026-09-30', 'is_active' => true,
    ]);
    $this->teacherId = DB::table('teachers')->insertGetId(['first_name' => 'Ana', 'last_name' => 'Reyes', 'max_subjects' => 1]);
    $buildingId = DB::table('buildings')->insertGetId(['name' => 'Main']);
    $this->roomId = DB::table('rooms')->insertGetId(['building_id' => $buildingId, 'room_number' => '101']);
});

function dashboardGradeId(int $grade): int
{
    return DB::table('grade_levels')->where('grade', $grade)->value('id');
}

function dashboardSection(object $test, string $name, int $grade = 7, array $overrides = []): int
{
    return DB::table('sections')->insertGetId([
        'school_year_id' => $test->yearId, 'grade_level_id' => dashboardGradeId($grade), 'name' => $name, ...$overrides,
    ]);
}

/** Loads a subject to a section, and optionally places it on Monday with a status. */
function dashboardLoad(object $test, int $sectionId, string $subject, ?string $status = null, string $start = '07:00'): void
{
    $subjectId = DB::table('subjects')->insertGetId([
        'school_year_id' => $test->yearId, 'grade_level_id' => dashboardGradeId(7), 'name' => $subject, 'minutes_per_week' => 45,
    ]);
    $loadingId = DB::table('section_subjects')->insertGetId([
        'term_id' => $test->termId, 'section_id' => $sectionId, 'subject_id' => $subjectId, 'teacher_id' => $test->teacherId,
    ]);

    if ($status) {
        DB::table('schedule_entries')->insert([
            'term_id' => $test->termId, 'section_id' => $sectionId, 'section_subject_id' => $loadingId,
            'teacher_id' => $test->teacherId, 'room_id' => $test->roomId, 'created_by' => $test->admin->id, 'status' => $status,
            'day_of_week' => 1, 'start_time' => $start, 'end_time' => date('H:i', strtotime($start) + 2700),
        ]);
    }
}

function checklistItem(object $test, string $key): array
{
    return collect($test->getJson("/api/terms/{$test->termId}/dashboard")->assertOk()->json('data.checklist'))
        ->firstWhere('key', $key);
}

it('keeps the Admin dashboard to the Admin', function (string $role) {
    $this->actingAs(User::factory()->create()->assignRole($role));

    $this->getJson("/api/terms/{$this->termId}/dashboard")->assertForbidden();
})->with(['glc', 'master_teacher', 'teacher']);

it('counts sections by grade and stage, in grade order', function () {
    dashboardSection($this, 'Untouched', 8);
    dashboardLoad($this, dashboardSection($this, 'Waiting'), 'Math', 'pending');
    dashboardLoad($this, dashboardSection($this, 'Working'), 'Science', 'draft', '08:00');
    dashboardLoad($this, dashboardSection($this, 'Done'), 'English', 'approved', '09:00');

    $this->getJson("/api/terms/{$this->termId}/dashboard")
        ->assertOk()
        ->assertJsonPath('data.pending_sections', 1)
        ->assertJsonPath('data.progress.0.grade', 7)
        ->assertJsonPath('data.progress.0.level', 'JHS')
        ->assertJsonPath('data.progress.0.sections', 3)
        ->assertJsonPath('data.progress.0.pending', 1)
        ->assertJsonPath('data.progress.0.draft', 1)
        ->assertJsonPath('data.progress.0.approved', 1)
        ->assertJsonPath('data.progress.1.grade', 8)
        ->assertJsonPath('data.progress.1.not_started', 1);
});

it('counts flags and the sections that have them', function () {
    dashboardSection($this, 'No Adviser');

    $flags = $this->getJson("/api/terms/{$this->termId}/dashboard")->json('data.flags');

    expect($flags['total'])->toBeGreaterThan(0)
        ->and($flags['sections'])->toBe(1);
});

it('counts accounts waiting for activation', function () {
    User::factory()->pending()->count(2)->create();

    $this->getJson("/api/terms/{$this->termId}/dashboard")->assertJsonPath('data.pending_accounts', 2);
});

it('lists overloaded teachers of this term only', function () {
    $sectionId = dashboardSection($this, 'Honesty');
    dashboardLoad($this, $sectionId, 'Math');
    dashboardLoad($this, $sectionId, 'Science');

    $this->getJson("/api/terms/{$this->termId}/dashboard")
        ->assertJsonPath('data.overloaded_teachers.0.name', 'Ana Reyes')
        ->assertJsonPath('data.overloaded_teachers.0.assigned', 2)
        ->assertJsonPath('data.overloaded_teachers.0.limit', 1);

    $otherTerm = DB::table('school_terms')->insertGetId([
        'school_year_id' => $this->yearId, 'term_no' => 2, 'name' => 'Second Term',
        'start_date' => '2026-10-01', 'end_date' => '2026-12-15',
    ]);

    $this->getJson("/api/terms/{$otherTerm}/dashboard")->assertJsonPath('data.overloaded_teachers', []);
});

it('shows a new year as not set up', function () {
    DB::table('school_terms')->update(['is_active' => false]);

    $items = collect($this->getJson("/api/terms/{$this->termId}/dashboard")->json('data.checklist'));

    expect($items->pluck('key')->all())->toBe(['calendar', 'school_profile', 'time_slots', 'sections', 'signatories', 'schedulers'])
        ->and($items->pluck('done')->unique()->all())->toBe([false]);
});

describe('checklist', function () {
    it('needs an active term', function () {
        expect(checklistItem($this, 'calendar'))
            ->toMatchArray(['done' => true, 'detail' => 'First Term, SY 2026-2027 is active.']);
    });

    it('needs the school profile', function () {
        DB::table('school_profile')->insert(['school_name' => 'My School']);

        expect(checklistItem($this, 'school_profile'))->toMatchArray(['done' => true, 'detail' => 'My School']);
    });

    it('needs advisers on all sections', function () {
        dashboardSection($this, 'Honesty');
        expect(checklistItem($this, 'sections'))
            ->toMatchArray(['done' => false, 'detail' => '1 encoded, 1 without an adviser.']);

        DB::table('sections')->update(['adviser_id' => $this->teacherId]);
        expect(checklistItem($this, 'sections'))
            ->toMatchArray(['done' => true, 'detail' => '1 encoded, all with advisers.']);
    });

    it('needs signatories for this term', function () {
        expect(checklistItem($this, 'signatories')['done'])->toBeFalse();

        DB::table('report_signatories')->insert(['term_id' => $this->termId, 'label' => 'Prepared by', 'name' => 'X']);

        expect(checklistItem($this, 'signatories')['done'])->toBeTrue();
    });

    it('needs an active scheduler, not a pending or deactivated one', function () {
        User::factory()->create(['status' => 'inactive'])->assignRole('glc');
        expect(checklistItem($this, 'schedulers')['done'])->toBeFalse();

        User::factory()->create()->assignRole('master_teacher');
        expect(checklistItem($this, 'schedulers'))
            ->toMatchArray(['done' => true, 'detail' => '1 active account can make schedules.']);
    });

    describe('time slots', function () {
        function addPattern(object $test, string $days, bool $withSlot = true, string $shift = 'WHOLE_DAY'): void
        {
            $patternId = DB::table('day_patterns')->insertGetId([
                'school_year_id' => $test->yearId, 'level' => 'JHS', 'shift' => $shift, 'name' => $days, 'days' => $days,
            ]);

            if ($withSlot) {
                DB::table('time_slots')->insert([
                    'day_pattern_id' => $patternId, 'period_no' => 1, 'start_time' => '07:00', 'end_time' => '07:45',
                ]);
            }
        }

        it('is not done with no bell schedule', function () {
            expect(checklistItem($this, 'time_slots'))
                ->toMatchArray(['done' => false, 'detail' => 'No bell schedule yet.']);
        });

        it('names the days a shift with sections is missing', function () {
            dashboardSection($this, 'Honesty');
            addPattern($this, '{1,2,3,4}');

            expect(checklistItem($this, 'time_slots'))
                ->toMatchArray(['done' => false, 'detail' => 'JHS WHOLE DAY: no periods on Friday']);
        });

        it('does not count a bell schedule with no periods', function () {
            dashboardSection($this, 'Honesty');
            addPattern($this, '{1,2,3,4}');
            addPattern($this, '{5}', withSlot: false);

            expect(checklistItem($this, 'time_slots')['done'])->toBeFalse();
        });

        it('is done when every shift with sections has all five days', function () {
            dashboardSection($this, 'Honesty');
            addPattern($this, '{1,2,3,4}');
            addPattern($this, '{5}');

            expect(checklistItem($this, 'time_slots'))
                ->toMatchArray(['done' => true, 'detail' => '2 bell schedules ready.']);
        });

        it('does not ask for a shift that has no sections', function () {
            addPattern($this, '{1,2,3,4,5}');

            expect(checklistItem($this, 'time_slots')['done'])->toBeTrue();
        });
    });
});
