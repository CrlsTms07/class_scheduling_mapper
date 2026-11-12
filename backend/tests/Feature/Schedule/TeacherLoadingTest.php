<?php

use App\Models\User;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Support\Facades\DB;

function loadingGrade(int $grade): int
{
    return DB::table('grade_levels')->where('grade', $grade)->value('id');
}

beforeEach(function () {
    $this->withHeader('Referer', 'http://localhost:5173');
    $this->seed(ReferenceDataSeeder::class);

    $this->glc = User::factory()->create()->assignRole('glc');
    $this->glc->gradeLevels()->sync([loadingGrade(7)]);
    $this->actingAs($this->glc);

    $this->yearId = DB::table('school_years')->insertGetId([
        'name' => '2026-2027', 'start_date' => '2026-06-01', 'end_date' => '2027-03-31',
    ]);
    $this->termId = DB::table('school_terms')->insertGetId([
        'school_year_id' => $this->yearId, 'term_no' => 1, 'name' => 'First',
        'start_date' => '2026-06-01', 'end_date' => '2026-09-30', 'is_active' => true,
    ]);
    $this->secondTermId = DB::table('school_terms')->insertGetId([
        'school_year_id' => $this->yearId, 'term_no' => 2, 'name' => 'Second',
        'start_date' => '2026-10-01', 'end_date' => '2026-12-15',
    ]);
    $this->sectionId = DB::table('sections')->insertGetId([
        'school_year_id' => $this->yearId, 'grade_level_id' => loadingGrade(7), 'name' => 'Honesty',
    ]);
    $this->otherSectionId = DB::table('sections')->insertGetId([
        'school_year_id' => $this->yearId, 'grade_level_id' => loadingGrade(7), 'name' => 'Hope',
    ]);
    $this->anaId = DB::table('teachers')->insertGetId(['first_name' => 'Ana', 'last_name' => 'Reyes', 'max_subjects' => 1]);
    $this->benId = DB::table('teachers')->insertGetId(['first_name' => 'Ben', 'last_name' => 'Cruz']);
    $this->mathId = loadingSubject($this, 'Math 7');
    $buildingId = DB::table('buildings')->insertGetId(['name' => 'Main']);
    $this->roomId = DB::table('rooms')->insertGetId(['building_id' => $buildingId, 'room_number' => '101']);
    $this->otherRoomId = DB::table('rooms')->insertGetId(['building_id' => $buildingId, 'room_number' => '102']);
    $this->url = "/api/terms/{$this->termId}/sections/{$this->sectionId}/loading";
});

function loadingSubject(object $test, string $name, array $overrides = []): int
{
    return DB::table('subjects')->insertGetId([
        'school_year_id' => $test->yearId, 'grade_level_id' => loadingGrade(7), 'name' => $name, 'minutes_per_week' => 225, ...$overrides,
    ]);
}

function loadingRow(object $test, ?int $sectionId = null, ?int $subjectId = null, ?int $teacherId = null, ?int $termId = null): int
{
    return DB::table('section_subjects')->insertGetId([
        'term_id' => $termId ?? $test->termId,
        'section_id' => $sectionId ?? $test->sectionId,
        'subject_id' => $subjectId ?? $test->mathId,
        'teacher_id' => $teacherId ?? $test->anaId,
    ]);
}

/** Puts a loaded subject on Monday at a time. */
function plotted(object $test, int $loadingId, string $status = 'draft', string $start = '07:00', ?int $sectionId = null, ?int $teacherId = null): void
{
    DB::table('schedule_entries')->insert([
        'term_id' => $test->termId,
        'section_id' => $sectionId ?? $test->sectionId,
        'section_subject_id' => $loadingId,
        'teacher_id' => $teacherId ?? $test->anaId,
        'room_id' => $sectionId === $test->otherSectionId ? $test->otherRoomId : $test->roomId,
        'created_by' => $test->glc->id,
        'status' => $status,
        'day_of_week' => 1,
        'start_time' => $start,
        'end_time' => date('H:i', strtotime($start) + 2700),
    ]);
}

describe('who can do it', function () {
    it('keeps it to schedulers within their grade levels', function () {
        $otherSection = DB::table('sections')->insertGetId([
            'school_year_id' => $this->yearId, 'grade_level_id' => loadingGrade(9), 'name' => 'Outside',
        ]);

        $this->getJson("/api/terms/{$this->termId}/sections/{$otherSection}/loading")->assertForbidden();
        $this->putJson("/api/terms/{$this->termId}/sections/{$otherSection}/loading/{$this->mathId}", ['teacher_id' => $this->anaId])->assertForbidden();
        $this->deleteJson("/api/terms/{$this->termId}/sections/{$otherSection}/loading/{$this->mathId}")->assertForbidden();
    });

    it('lets the Admin load subjects too, but not a teacher', function () {
        $this->actingAs(User::factory()->create()->assignRole('super_admin'));
        $this->getJson($this->url)->assertOk();
        $this->putJson("{$this->url}/{$this->mathId}", ['teacher_id' => $this->anaId])->assertOk();

        $this->actingAs(User::factory()->create()->assignRole('teacher'));
        $this->getJson($this->url)->assertForbidden();
        $this->putJson("{$this->url}/{$this->mathId}", ['teacher_id' => $this->anaId])->assertForbidden();
        $this->deleteJson("{$this->url}/{$this->mathId}")->assertForbidden();
    });

    it('answers 404 when the term is of another school year', function () {
        $otherYear = DB::table('school_years')->insertGetId([
            'name' => '2027-2028', 'start_date' => '2027-06-01', 'end_date' => '2028-03-31',
        ]);
        $otherTerm = DB::table('school_terms')->insertGetId([
            'school_year_id' => $otherYear, 'term_no' => 1, 'name' => 'Next',
            'start_date' => '2027-06-01', 'end_date' => '2027-09-30',
        ]);

        $this->getJson("/api/terms/{$otherTerm}/sections/{$this->sectionId}/loading")->assertNotFound();
    });
});

describe('the list', function () {
    it('shows the section, its subjects and the teachers with their load', function () {
        loadingRow($this, $this->otherSectionId);

        $this->getJson($this->url)
            ->assertOk()
            ->assertJsonPath('data.section.label', 'Grade 7 – Honesty')
            ->assertJsonPath('data.rows.0.subject', 'Math 7')
            ->assertJsonPath('data.rows.0.teacher_id', null)
            ->assertJsonPath('data.rows.0.minutes_per_week', 225)
            ->assertJsonPath('data.teachers.1.name', 'Ana Reyes')
            ->assertJsonPath('data.teachers.1.assigned', 1)
            ->assertJsonPath('data.teachers.1.limit', 1);
    });

    it('puts priority subjects first', function () {
        loadingSubject($this, 'Homeroom', ['is_priority' => true]);

        $this->getJson($this->url)->assertJsonPath('data.rows.0.subject', 'Homeroom');
    });

    it('only offers subjects of the section\'s grade, term and track', function () {
        $trackId = DB::table('tracks')->insertGetId(['name' => 'Academic']);
        loadingSubject($this, 'Other grade', ['grade_level_id' => loadingGrade(8)]);
        loadingSubject($this, 'Other term', ['term_no' => 2]);
        loadingSubject($this, 'This term', ['term_no' => 1]);
        loadingSubject($this, 'Other track', ['track_id' => $trackId]);
        loadingSubject($this, 'Withdrawn', ['is_active' => false]);

        $names = collect($this->getJson($this->url)->json('data.rows'))->pluck('subject')->all();

        expect($names)->toBe(['Math 7', 'This term']);
    });

    it('still shows a withdrawn subject that was already loaded', function () {
        $withdrawn = loadingSubject($this, 'Withdrawn', ['is_active' => false]);
        loadingRow($this, subjectId: $withdrawn);

        $names = collect($this->getJson($this->url)->json('data.rows'))->pluck('subject')->all();

        expect($names)->toContain('Withdrawn');
    });

    it('offers only active teaching personnel', function () {
        DB::table('teachers')->insert(['first_name' => 'Staff', 'last_name' => 'Only', 'personnel_type' => 'non_teaching']);
        DB::table('teachers')->insert(['first_name' => 'Gone', 'last_name' => 'Away', 'is_active' => false]);

        $names = collect($this->getJson($this->url)->json('data.teachers'))->pluck('name')->all();

        expect($names)->toBe(['Ben Cruz', 'Ana Reyes']);
    });

    it('keeps the load per term', function () {
        loadingRow($this, termId: $this->secondTermId);

        $this->getJson($this->url)->assertJsonPath('data.rows.0.teacher_id', null);
    });
});

describe('assigning', function () {
    it('gives a subject to a teacher and writes an audit log', function () {
        $this->putJson("{$this->url}/{$this->mathId}", ['teacher_id' => $this->anaId])
            ->assertOk()
            ->assertJsonPath('data.rows.0.teacher', 'Ana Reyes')
            ->assertJsonPath('data.rows.0.teacher_id', $this->anaId);

        expect(DB::table('section_subjects')->count())->toBe(1)
            ->and(DB::table('audit_logs')->where('table_name', 'section_subjects')->where('action', 'create')->exists())->toBeTrue();
    });

    it('does nothing when the teacher stays the same', function () {
        loadingRow($this);

        $this->putJson("{$this->url}/{$this->mathId}", ['teacher_id' => $this->anaId])->assertOk();

        expect(DB::table('audit_logs')->count())->toBe(0);
    });

    it('allows going over the limit, since that is only a flag', function () {
        loadingRow($this, $this->otherSectionId);

        $this->putJson("{$this->url}/{$this->mathId}", ['teacher_id' => $this->anaId])
            ->assertOk()
            ->assertJsonPath('data.teachers.1.assigned', 2);
    });

    it('refuses non-teaching or inactive personnel', function (array $teacher) {
        $id = DB::table('teachers')->insertGetId(['first_name' => 'X', 'last_name' => 'Y', ...$teacher]);

        $this->putJson("{$this->url}/{$this->mathId}", ['teacher_id' => $id])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['teacher_id' => 'active teaching']);
    })->with([
        'non-teaching' => [['personnel_type' => 'non_teaching']],
        'inactive' => [['is_active' => false]],
    ]);

    it('lets a teacher who has since become inactive keep their subject', function () {
        loadingRow($this);
        DB::table('teachers')->where('id', $this->anaId)->update(['is_active' => false]);

        $this->putJson("{$this->url}/{$this->mathId}", ['teacher_id' => $this->anaId])->assertOk();
    });

    it('refuses a subject not offered to this section', function (string $kind) {
        $changes = [
            'another grade' => ['grade_level_id' => loadingGrade(8)],
            'another term' => ['term_no' => 2],
            'withdrawn' => ['is_active' => false],
        ];
        $id = loadingSubject($this, 'Not offered', $changes[$kind]);

        $this->putJson("{$this->url}/{$id}", ['teacher_id' => $this->anaId])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['teacher_id' => 'not offered']);
    })->with(['another grade', 'another term', 'withdrawn']);

    it('needs a real teacher', function () {
        $this->putJson("{$this->url}/{$this->mathId}", ['teacher_id' => 999])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('teacher_id');
    });
});

describe('changing the teacher of a plotted subject', function () {
    it('carries the change into the draft entries', function () {
        plotted($this, loadingRow($this));

        $this->putJson("{$this->url}/{$this->mathId}", ['teacher_id' => $this->benId])
            ->assertOk()
            ->assertJsonPath('data.rows.0.teacher', 'Ben Cruz')
            ->assertJsonPath('data.rows.0.placed_entries', 1);

        expect(DB::table('schedule_entries')->value('teacher_id'))->toBe($this->benId);
    });

    it('refuses when the new teacher is busy at that time, and says where', function () {
        plotted($this, loadingRow($this));

        $otherSubject = loadingSubject($this, 'Science 7');
        plotted($this, loadingRow($this, $this->otherSectionId, $otherSubject, $this->benId), 'draft', '07:00', $this->otherSectionId, $this->benId);

        $this->putJson("{$this->url}/{$this->mathId}", ['teacher_id' => $this->benId])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['teacher_id' => 'Ben Cruz is teaching Grade 7 – Hope on Monday at 7:00 AM']);

        expect(DB::table('section_subjects')->where('subject_id', $this->mathId)->value('teacher_id'))->toBe($this->anaId);
    });

    it('allows it when the times are only back to back', function () {
        plotted($this, loadingRow($this));

        $otherSubject = loadingSubject($this, 'Science 7');
        plotted($this, loadingRow($this, $this->otherSectionId, $otherSubject, $this->benId), 'draft', '07:45', $this->otherSectionId, $this->benId);

        $this->putJson("{$this->url}/{$this->mathId}", ['teacher_id' => $this->benId])->assertOk();
    });

    it('ignores the new teacher\'s rejected entries', function () {
        plotted($this, loadingRow($this));

        $otherSubject = loadingSubject($this, 'Science 7');
        plotted($this, loadingRow($this, $this->otherSectionId, $otherSubject, $this->benId), 'rejected', '07:00', $this->otherSectionId, $this->benId);

        $this->putJson("{$this->url}/{$this->mathId}", ['teacher_id' => $this->benId])->assertOk();
    });

    it('is blocked on a schedule waiting for approval or approved', function (string $status, string $reason) {
        plotted($this, loadingRow($this), $status);

        $this->getJson($this->url)->assertJsonPath('data.rows.0.locked_reason', fn ($text) => str_contains($text, $reason));

        $this->putJson("{$this->url}/{$this->mathId}", ['teacher_id' => $this->benId])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['teacher_id' => $reason]);

        expect(DB::table('schedule_entries')->value('teacher_id'))->toBe($this->anaId);
    })->with([
        'pending' => ['pending', 'waiting for approval'],
        'approved' => ['approved', 'reopen'],
    ]);
});

describe('removing', function () {
    it('removes a subject from its teacher and writes an audit log', function () {
        loadingRow($this);

        $this->deleteJson("{$this->url}/{$this->mathId}")
            ->assertOk()
            ->assertJsonPath('data.rows.0.teacher_id', null);

        expect(DB::table('section_subjects')->count())->toBe(0)
            ->and(DB::table('audit_logs')->where('table_name', 'section_subjects')->where('action', 'delete')->exists())->toBeTrue();
    });

    it('does nothing when there is no loading', function () {
        $this->deleteJson("{$this->url}/{$this->mathId}")->assertOk();
    });

    it('asks to clear the plotter first when it is plotted', function () {
        plotted($this, loadingRow($this));

        $this->deleteJson("{$this->url}/{$this->mathId}")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['teacher_id' => 'Clear it in the plotter']);

        expect(DB::table('section_subjects')->count())->toBe(1);
    });

    it('says the schedule is locked when it is approved', function () {
        plotted($this, loadingRow($this), 'approved');

        $this->deleteJson("{$this->url}/{$this->mathId}")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['teacher_id' => 'reopen']);
    });
});

describe('quick-add', function () {
    it('makes a real record with a name only, offered right away', function () {
        $id = $this->postJson('/api/teachers/quick-add', ['first_name' => ' Carla ', 'last_name' => 'Lim'])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Carla Lim')
            ->json('data.id');

        $teacher = DB::table('teachers')->where('id', $id)->first();

        expect($teacher->personnel_type)->toBe('teaching')
            ->and($teacher->first_name)->toBe('Carla')
            ->and($teacher->max_subjects)->toBe(5);

        $this->putJson("{$this->url}/{$this->mathId}", ['teacher_id' => $id])->assertOk();
    });

    it('refuses someone already on the list', function () {
        $this->postJson('/api/teachers/quick-add', ['first_name' => 'ana', 'last_name' => 'reyes'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['first_name' => 'already in the list']);
    });

    it('needs both names, and stays away from people who only teach', function () {
        $this->postJson('/api/teachers/quick-add', ['first_name' => '', 'last_name' => 'Lim'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('first_name');

        $this->actingAs(User::factory()->create()->assignRole('teacher'));

        $this->postJson('/api/teachers/quick-add', ['first_name' => 'A', 'last_name' => 'B'])->assertForbidden();
    });
});

it('feeds the plotter, so a new loading can be placed', function () {
    $this->putJson("{$this->url}/{$this->mathId}", ['teacher_id' => $this->anaId])->assertOk();

    $this->getJson("/api/terms/{$this->termId}/sections/{$this->sectionId}/plotter")
        ->assertOk()
        ->assertJsonPath('data.loading.0.subject', 'Math 7');
});
