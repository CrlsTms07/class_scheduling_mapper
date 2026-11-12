<?php

use App\Models\User;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Support\Facades\DB;

function clearGrade(int $grade): int
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
    $patternId = DB::table('day_patterns')->insertGetId([
        'school_year_id' => $this->yearId, 'level' => 'JHS', 'shift' => 'WHOLE_DAY', 'name' => 'Monday – Friday', 'days' => '{1,2,3,4,5}',
    ]);
    DB::table('time_slots')->insert([
        'day_pattern_id' => $patternId, 'period_no' => 1, 'label' => null, 'start_time' => '07:00', 'end_time' => '07:45', 'is_break' => false,
    ]);
    $this->teacherId = DB::table('teachers')->insertGetId(['first_name' => 'Ana', 'last_name' => 'Reyes']);
    $buildingId = DB::table('buildings')->insertGetId(['name' => 'Main']);
    $this->roomId = DB::table('rooms')->insertGetId(['building_id' => $buildingId, 'room_number' => '101']);

    $this->glc = User::factory()->create()->assignRole('glc');
    $this->glc->gradeLevels()->attach(clearGrade(7));

    $this->sectionId = DB::table('sections')->insertGetId([
        'school_year_id' => $this->yearId, 'grade_level_id' => clearGrade(7), 'name' => 'Honesty', 'adviser_id' => $this->teacherId,
    ]);
    $subjectId = DB::table('subjects')->insertGetId([
        'school_year_id' => $this->yearId, 'grade_level_id' => clearGrade(7), 'name' => 'Math 7', 'minutes_per_week' => 225,
    ]);
    $this->loadingId = DB::table('section_subjects')->insertGetId([
        'term_id' => $this->termId, 'section_id' => $this->sectionId, 'subject_id' => $subjectId, 'teacher_id' => $this->teacherId,
    ]);
    $this->url = "/api/terms/{$this->termId}/sections/{$this->sectionId}/schedule";
    $this->actingAs($this->glc);
});

function clearEntry(object $test, string $status): void
{
    DB::table('schedule_entries')->insert([
        'term_id' => $test->termId, 'section_id' => $test->sectionId, 'section_subject_id' => $test->loadingId, 'teacher_id' => $test->teacherId,
        'room_id' => $test->roomId, 'created_by' => $test->glc->id, 'status' => $status,
        'day_of_week' => 1, 'start_time' => '07:00', 'end_time' => '07:45',
    ]);
}

describe('clearing a whole schedule', function () {
    it('removes the entries and acknowledgements, and keeps the loading', function (string $status) {
        clearEntry($this, $status);
        DB::table('schedule_flag_acknowledgements')->insert([
            'term_id' => $this->termId, 'section_id' => $this->sectionId, 'flag_key' => 'no_adviser', 'acknowledged_by' => $this->glc->id,
        ]);

        $this->deleteJson($this->url)->assertOk()->assertJsonPath('data.status', 'not_started');

        expect(DB::table('schedule_entries')->count())->toBe(0)
            ->and(DB::table('schedule_flag_acknowledgements')->count())->toBe(0)
            ->and(DB::table('section_subjects')->count())->toBe(1)
            ->and(DB::table('audit_logs')->where('action', 'clear')->exists())->toBeTrue();
    })->with(['draft', 'rejected']);

    it('never clears a schedule waiting for approval or already approved', function (string $status) {
        clearEntry($this, $status);

        $this->deleteJson($this->url)->assertUnprocessable();

        expect(DB::table('schedule_entries')->count())->toBe(1);
    })->with(['pending', 'approved']);

    it('is only for those who plot this grade', function () {
        clearEntry($this, 'draft');

        $other = User::factory()->create()->assignRole('glc');
        $other->gradeLevels()->attach(clearGrade(8));
        $this->actingAs($other);
        $this->deleteJson($this->url)->assertForbidden();

        expect(DB::table('schedule_entries')->count())->toBe(1);
    });
});

describe('flags of a section not started', function () {
    it('does not count unplaced subjects as problems before anything is placed', function () {
        $flags = $this->getJson("/api/terms/{$this->termId}/sections/{$this->sectionId}/plotter")->json('data.flags');

        expect($flags)->toBe([]);
    });

    it('does once something is placed', function () {
        clearEntry($this, 'draft');

        $flags = $this->getJson("/api/terms/{$this->termId}/sections/{$this->sectionId}/plotter")->json('data.flags');

        expect(collect($flags)->pluck('type'))->toContain('minutes_under');
    });

    it('still says when there is no adviser', function () {
        DB::table('sections')->where('id', $this->sectionId)->update(['adviser_id' => null]);

        $flags = $this->getJson("/api/terms/{$this->termId}/sections/{$this->sectionId}/plotter")->json('data.flags');

        expect(collect($flags)->pluck('type')->all())->toBe(['no_adviser']);
    });
});

describe('deleting a track', function () {
    beforeEach(function () {
        $this->trackId = DB::table('tracks')->insertGetId(['name' => 'Typo Track']);
        $this->actingAs(User::factory()->create()->assignRole('super_admin'));
    });

    it('removes one nobody uses', function () {
        $this->deleteJson("/api/tracks/{$this->trackId}")->assertOk();

        expect(DB::table('tracks')->where('id', $this->trackId)->exists())->toBeFalse();
    });

    it('keeps one in use, and says why', function () {
        DB::table('sections')->insert([
            'school_year_id' => $this->yearId, 'grade_level_id' => clearGrade(11), 'name' => 'STEM', 'track_id' => $this->trackId,
        ]);

        $this->deleteJson("/api/tracks/{$this->trackId}")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['track' => 'stays']);
    });

    it('is not for a Chairperson', function () {
        $this->actingAs($this->glc);

        $this->deleteJson("/api/tracks/{$this->trackId}")->assertForbidden();
    });

    it('says not found when it is already gone', function () {
        $this->deleteJson('/api/tracks/999999')->assertNotFound();
    });
});

describe('deleting a personnel option', function () {
    it('removes one nobody uses', function (string $type, string $table) {
        $id = DB::table($table)->insertGetId(['name' => 'Typo']);

        $this->deleteJson("/api/personnel-options/{$type}/{$id}")->assertOk();

        expect(DB::table($table)->where('id', $id)->exists())->toBeFalse();
    })->with([
        ['departments', 'departments'],
        ['designations', 'designations'],
        ['teaching-tasks', 'teaching_tasks'],
    ]);

    it('keeps a department or designation in use', function () {
        $department = DB::table('departments')->insertGetId(['name' => 'Math']);
        $designation = DB::table('designations')->insertGetId(['name' => 'Teacher I']);
        DB::table('teachers')->where('id', $this->teacherId)->update(['department_id' => $department, 'designation_id' => $designation]);

        $this->deleteJson("/api/personnel-options/departments/{$department}")->assertUnprocessable()->assertJsonValidationErrors('option');
        $this->deleteJson("/api/personnel-options/designations/{$designation}")->assertUnprocessable()->assertJsonValidationErrors('option');
    });

    it('keeps a task in use', function () {
        $task = DB::table('teaching_tasks')->insertGetId(['name' => 'ICT Coordinator']);
        DB::table('teacher_tasks')->insert(['teacher_id' => $this->teacherId, 'task_id' => $task, 'term_id' => $this->termId]);

        $this->deleteJson("/api/personnel-options/teaching-tasks/{$task}")->assertUnprocessable();
    });

    it('is not for a teacher', function () {
        $id = DB::table('departments')->insertGetId(['name' => 'Typo']);
        $this->actingAs(User::factory()->create()->assignRole('teacher'));

        $this->deleteJson("/api/personnel-options/departments/{$id}")->assertForbidden();
    });

    it('refuses an unknown kind of option', function () {
        $this->deleteJson('/api/personnel-options/users/1')->assertNotFound();
    });
});
