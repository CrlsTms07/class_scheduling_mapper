<?php

use App\Models\User;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Support\Facades\DB;

function copyGrade(int $grade): int
{
    return DB::table('grade_levels')->where('grade', $grade)->value('id');
}

function copySection(object $test, string $name, int $grade = 7): int
{
    return DB::table('sections')->insertGetId([
        'school_year_id' => $test->yearId, 'grade_level_id' => copyGrade($grade), 'name' => $name,
    ]);
}

function copySubject(object $test, string $name, ?int $termNo = null, int $grade = 7): int
{
    return DB::table('subjects')->insertGetId([
        'school_year_id' => $test->yearId, 'grade_level_id' => copyGrade($grade), 'name' => $name,
        'minutes_per_week' => 225, 'term_no' => $termNo,
    ]);
}

function copyLoading(object $test, int $termId, int $sectionId, int $subjectId, ?int $teacherId = null): int
{
    return DB::table('section_subjects')->insertGetId([
        'term_id' => $termId, 'section_id' => $sectionId, 'subject_id' => $subjectId, 'teacher_id' => $teacherId ?? $test->teacherId,
    ]);
}

function copyEntry(object $test, int $termId, int $sectionId, ?int $loadingId, ?int $teacherId, array $overrides = []): int
{
    return DB::table('schedule_entries')->insertGetId([
        'term_id' => $termId, 'section_id' => $sectionId, 'section_subject_id' => $loadingId, 'teacher_id' => $teacherId,
        'room_id' => $test->roomId, 'created_by' => $test->glc->id, 'status' => 'approved',
        'day_of_week' => 1, 'start_time' => '07:00', 'end_time' => '07:45', ...$overrides,
    ]);
}

beforeEach(function () {
    $this->withHeader('Referer', 'http://localhost:5173');
    $this->seed(ReferenceDataSeeder::class);

    $this->yearId = DB::table('school_years')->insertGetId([
        'name' => '2026-2027', 'start_date' => '2026-06-01', 'end_date' => '2027-03-31',
    ]);
    $this->firstTerm = DB::table('school_terms')->insertGetId([
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

    $this->teacherId = DB::table('teachers')->insertGetId(['first_name' => 'Ana', 'last_name' => 'Reyes']);
    $buildingId = DB::table('buildings')->insertGetId(['name' => 'Main']);
    $this->roomId = DB::table('rooms')->insertGetId(['building_id' => $buildingId, 'room_number' => '101']);
    $this->otherRoom = DB::table('rooms')->insertGetId(['building_id' => $buildingId, 'room_number' => '102']);

    $this->glc = User::factory()->create()->assignRole('glc');
    $this->glc->gradeLevels()->attach(copyGrade(7));
    $this->url = "/api/terms/{$this->secondTerm}/schedule-copy";

    $this->sectionId = copySection($this, 'Honesty');
    $this->subjectId = copySubject($this, 'Math 7');
    $this->sourceLoading = copyLoading($this, $this->firstTerm, $this->sectionId, $this->subjectId);
    $this->sourceEntry = copyEntry($this, $this->firstTerm, $this->sectionId, $this->sourceLoading, $this->teacherId);
    $this->body = ['from_term_id' => $this->firstTerm, 'section_id' => null, 'grade' => null, 'fill_subjects' => false, 'preview' => false];
    $this->actingAs($this->glc);
});

function copiedEntries(object $test)
{
    return DB::table('schedule_entries')->where('term_id', $test->secondTerm)->get();
}

it('copies periods as draft open slots, with the same day, time and room', function () {
    $this->postJson($this->url, $this->body)
        ->assertOk()
        ->assertJsonPath('data.sections_copied', 1)
        ->assertJsonPath('data.entries', 1)
        ->assertJsonPath('data.open_slots', 1)
        ->assertJsonPath('data.filled', 0);

    $copy = copiedEntries($this)->sole();

    expect($copy->status)->toBe('draft')
        ->and($copy->section_subject_id)->toBeNull()
        ->and($copy->teacher_id)->toBeNull()
        ->and($copy->room_id)->toBe($this->roomId)
        ->and($copy->day_of_week)->toBe(1)
        ->and($copy->start_time)->toBe('07:00:00')
        ->and($copy->copied_from_id)->toBe($this->sourceEntry);

    expect(DB::table('section_subjects')->where('term_id', $this->secondTerm)->count())->toBe(0);
    expect(DB::table('audit_logs')->where('action', 'copy')->where('table_name', 'schedule_entries')->exists())->toBeTrue();
});

it('leaves the source term alone', function () {
    $this->postJson($this->url, $this->body)->assertOk();

    expect(DB::table('schedule_entries')->where('id', $this->sourceEntry)->value('status'))->toBe('approved');
});

it('copies nothing on a preview, with the same numbers', function () {
    $preview = $this->postJson($this->url, [...$this->body, 'preview' => true, 'fill_subjects' => true])->assertOk()->json('data');

    expect(copiedEntries($this))->toHaveCount(0)
        ->and(DB::table('section_subjects')->where('term_id', $this->secondTerm)->count())->toBe(0)
        ->and(DB::table('audit_logs')->where('action', 'copy')->exists())->toBeFalse();

    $real = $this->postJson($this->url, [...$this->body, 'fill_subjects' => true])->assertOk()->json('data');

    expect($real)->toBe($preview)
        ->and($real['filled'])->toBe(1);
});

it('fills in the subjects that continue, with their teacher', function () {
    $this->postJson($this->url, [...$this->body, 'fill_subjects' => true])
        ->assertOk()
        ->assertJsonPath('data.loading_copied', 1)
        ->assertJsonPath('data.filled', 1)
        ->assertJsonPath('data.open_slots', 0);

    $copy = copiedEntries($this)->sole();
    $loading = DB::table('section_subjects')->where('term_id', $this->secondTerm)->sole();

    expect($copy->section_subject_id)->toBe($loading->id)
        ->and($copy->teacher_id)->toBe($this->teacherId)
        ->and($loading->subject_id)->toBe($this->subjectId)
        ->and($copy->status)->toBe('draft');
});

it('leaves a slot open when its subject does not continue to this term', function () {
    $onlyFirst = copySubject($this, 'Only First', 1);
    $loading = copyLoading($this, $this->firstTerm, $this->sectionId, $onlyFirst);
    copyEntry($this, $this->firstTerm, $this->sectionId, $loading, $this->teacherId, ['day_of_week' => 2]);

    $this->postJson($this->url, [...$this->body, 'fill_subjects' => true])
        ->assertJsonPath('data.entries', 2)
        ->assertJsonPath('data.filled', 1)
        ->assertJsonPath('data.open_slots', 1);

    expect(copiedEntries($this)->where('day_of_week', 2)->sole()->section_subject_id)->toBeNull();
});

it('uses the teacher already set in this term', function () {
    $other = DB::table('teachers')->insertGetId(['first_name' => 'Ben', 'last_name' => 'Cruz']);
    $mine = copyLoading($this, $this->secondTerm, $this->sectionId, $this->subjectId, $other);

    $this->postJson($this->url, [...$this->body, 'fill_subjects' => true])
        ->assertJsonPath('data.loading_copied', 0)
        ->assertJsonPath('data.filled', 1);

    $copy = copiedEntries($this)->sole();

    expect($copy->section_subject_id)->toBe($mine)->and($copy->teacher_id)->toBe($other);
});

it('never touches a section that already has a schedule in this term', function () {
    $loading = copyLoading($this, $this->secondTerm, $this->sectionId, $this->subjectId);
    $existing = copyEntry($this, $this->secondTerm, $this->sectionId, $loading, $this->teacherId, ['status' => 'draft', 'day_of_week' => 3]);

    $this->postJson($this->url, [...$this->body, 'fill_subjects' => true])
        ->assertOk()
        ->assertJsonPath('data.sections_copied', 0)
        ->assertJsonPath('data.sections_with_schedule', ['Grade 7 – Honesty'])
        ->assertJsonPath('data.entries', 0);

    expect(copiedEntries($this)->pluck('id')->all())->toBe([$existing]);
});

it('leaves a slot open when its teacher is taken in this term, and keeps the room', function () {
    $other = copySection($this, 'Other');
    $otherSubject = copySubject($this, 'Science 7');
    $busy = copyLoading($this, $this->secondTerm, $other, $otherSubject);
    copyEntry($this, $this->secondTerm, $other, $busy, $this->teacherId, ['status' => 'draft', 'room_id' => $this->otherRoom]);

    $this->postJson($this->url, [...$this->body, 'fill_subjects' => true])
        ->assertOk()
        ->assertJsonPath('data.filled', 0)
        ->assertJsonPath('data.left_open', 1);

    $copy = copiedEntries($this)->firstWhere('section_id', $this->sectionId);

    expect($copy->section_subject_id)->toBeNull()->and($copy->room_id)->toBe($this->roomId);
});

it('leaves a slot open with no room when its room is taken in this term', function () {
    $other = copySection($this, 'Other');
    copyEntry($this, $this->secondTerm, $other, null, null, ['status' => 'draft']);

    $this->postJson($this->url, [...$this->body, 'fill_subjects' => true])
        ->assertOk()
        ->assertJsonPath('data.left_open', 1);

    $copy = copiedEntries($this)->firstWhere('section_id', $this->sectionId);

    expect($copy->room_id)->toBeNull()->and($copy->section_subject_id)->toBeNull();
});

it('does not bring back a room that is no longer in use', function () {
    DB::table('rooms')->where('id', $this->roomId)->update(['is_active' => false]);

    $this->postJson($this->url, $this->body)->assertOk();

    expect(copiedEntries($this)->sole()->room_id)->toBeNull();
});

it('ignores rejected entries, and leaves out periods no longer in the bell schedule', function () {
    copyEntry($this, $this->firstTerm, $this->sectionId, $this->sourceLoading, $this->teacherId, ['day_of_week' => 2, 'status' => 'rejected']);
    copyEntry($this, $this->firstTerm, $this->sectionId, $this->sourceLoading, $this->teacherId, ['day_of_week' => 3, 'start_time' => '09:00', 'end_time' => '09:45']);

    $this->postJson($this->url, $this->body)
        ->assertJsonPath('data.entries', 1)
        ->assertJsonPath('data.not_fitting', 1);

    expect(copiedEntries($this)->pluck('day_of_week')->all())->toBe([1]);
});

it('says when a section has nothing to copy', function () {
    copySection($this, 'Empty');

    $this->postJson($this->url, $this->body)->assertJsonPath('data.sections_with_nothing', 1);
});

describe('scope', function () {
    beforeEach(function () {
        $this->secondSection = copySection($this, 'Hope');
        copyEntry($this, $this->firstTerm, $this->secondSection, null, null, ['room_id' => $this->otherRoom, 'status' => 'draft']);
    });

    it('copies one section', function () {
        $this->postJson($this->url, [...$this->body, 'section_id' => $this->secondSection])
            ->assertJsonPath('data.sections_copied', 1);

        expect(copiedEntries($this)->sole()->section_id)->toBe($this->secondSection);
    });

    it('copies one grade level', function () {
        $this->glc->gradeLevels()->attach(copyGrade(8));
        $eight = copySection($this, 'Faith', 8);
        copyEntry($this, $this->firstTerm, $eight, null, null, ['day_of_week' => 2, 'status' => 'draft']);

        $this->postJson($this->url, [...$this->body, 'grade' => 8])->assertJsonPath('data.sections_copied', 1);

        expect(copiedEntries($this)->sole()->section_id)->toBe($eight);
    });

    it('copies only the grade levels of the user', function () {
        $eight = copySection($this, 'Faith', 8);
        copyEntry($this, $this->firstTerm, $eight, null, null, ['day_of_week' => 2, 'status' => 'draft']);

        $this->postJson($this->url, $this->body)->assertJsonPath('data.sections_copied', 2);

        expect(copiedEntries($this)->pluck('section_id'))->not->toContain($eight);
    });

    it('refuses a section outside the grade levels of the user', function () {
        $eight = copySection($this, 'Faith', 8);

        $this->postJson($this->url, [...$this->body, 'section_id' => $eight])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('section_id');
    });
});

it('allows the Admin, for every grade level', function () {
    $this->actingAs(User::factory()->create()->assignRole('super_admin'));

    $this->postJson($this->url, $this->body)->assertOk()->assertJsonPath('data.sections_copied', 1);
});

it('refuses a teacher', function () {
    $this->actingAs(User::factory()->create()->assignRole('teacher'));

    $this->postJson($this->url, $this->body)->assertForbidden();
});

it('refuses the same term, or a term of another school year', function () {
    $this->postJson($this->url, [...$this->body, 'from_term_id' => $this->secondTerm])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('from_term_id');

    $otherYear = DB::table('school_years')->insertGetId(['name' => '2025-2026', 'start_date' => '2025-06-01', 'end_date' => '2026-03-31']);
    $otherTerm = DB::table('school_terms')->insertGetId([
        'school_year_id' => $otherYear, 'term_no' => 1, 'name' => 'Old', 'start_date' => '2025-06-01', 'end_date' => '2025-09-30',
    ]);

    $this->postJson($this->url, [...$this->body, 'from_term_id' => $otherTerm])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('from_term_id');
});

it('cannot submit a schedule with open slots', function () {
    $this->postJson($this->url, $this->body)->assertOk();

    $this->postJson("/api/terms/{$this->secondTerm}/sections/{$this->sectionId}/submit", ['acknowledged' => []])
        ->assertUnprocessable();
});

it('lets a subject take an open slot', function () {
    $this->postJson($this->url, $this->body)->assertOk();
    $slot = DB::table('time_slots')->where('start_time', '07:00')->value('id');
    $loading = copyLoading($this, $this->secondTerm, $this->sectionId, $this->subjectId);

    $this->putJson("/api/terms/{$this->secondTerm}/sections/{$this->sectionId}/slots/{$slot}", [
        'section_subject_id' => $loading, 'room_id' => $this->roomId, 'days' => [1],
    ])->assertOk();

    expect(copiedEntries($this)->sole()->section_subject_id)->toBe($loading);
});
