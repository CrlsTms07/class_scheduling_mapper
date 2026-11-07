<?php

use App\Models\User;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Support\Facades\DB;

function mapGrade(int $grade): int
{
    return DB::table('grade_levels')->where('grade', $grade)->value('id');
}

beforeEach(function () {
    $this->withHeader('Referer', 'http://localhost:5173');
    $this->seed(ReferenceDataSeeder::class);

    $this->glc = User::factory()->create()->assignRole('glc');
    $this->glc->gradeLevels()->sync([mapGrade(7)]);
    $this->actingAs($this->glc);

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
    $this->mainId = DB::table('buildings')->insertGetId(['name' => 'Main']);
    $this->room101 = DB::table('rooms')->insertGetId(['building_id' => $this->mainId, 'room_number' => '101']);
    $this->room102 = DB::table('rooms')->insertGetId(['building_id' => $this->mainId, 'room_number' => '102']);
    $this->teacherId = DB::table('teachers')->insertGetId(['first_name' => 'Ana', 'last_name' => 'Reyes']);
    $this->sectionId = mapSection($this, 'Honesty', ['home_room_id' => $this->room101]);
    $this->subjectId = mapSubject($this, 'Math 7');
});

function mapSection(object $test, string $name, array $overrides = []): int
{
    return DB::table('sections')->insertGetId([
        'school_year_id' => $test->yearId, 'grade_level_id' => mapGrade(7), 'name' => $name, ...$overrides,
    ]);
}

function mapSubject(object $test, string $name, array $overrides = []): int
{
    return DB::table('subjects')->insertGetId([
        'school_year_id' => $test->yearId, 'grade_level_id' => mapGrade(7), 'name' => $name, 'minutes_per_week' => 225, ...$overrides,
    ]);
}

function mapLoading(object $test, int $termId, ?int $sectionId = null, ?int $subjectId = null, ?int $teacherId = null): int
{
    return DB::table('section_subjects')->insertGetId([
        'term_id' => $termId,
        'section_id' => $sectionId ?? $test->sectionId,
        'subject_id' => $subjectId ?? $test->subjectId,
        'teacher_id' => $teacherId ?? $test->teacherId,
    ]);
}

function mapEntry(object $test, int $roomId, string $status = 'draft', ?int $sectionId = null, ?int $loadingId = null): void
{
    DB::table('schedule_entries')->insert([
        'term_id' => $test->firstTerm,
        'section_id' => $sectionId ?? $test->sectionId,
        'section_subject_id' => $loadingId ?? mapLoading($test, $test->firstTerm, $sectionId),
        'teacher_id' => $test->teacherId,
        'room_id' => $roomId,
        'created_by' => $test->glc->id,
        'status' => $status,
        'day_of_week' => 1,
        'start_time' => '07:00',
        'end_time' => '07:45',
    ]);
}

describe('schedule map', function () {
    beforeEach(function () {
        $this->url = "/api/terms/{$this->firstTerm}/schedule-map";
    });

    it('lists buildings, rooms and the sections in them', function () {
        $this->getJson($this->url)
            ->assertOk()
            ->assertJsonPath('data.buildings.0.name', 'Main')
            ->assertJsonPath('data.buildings.0.rooms.0.room_number', '101')
            ->assertJsonPath('data.buildings.0.rooms.0.sections.0.name', 'Honesty')
            ->assertJsonPath('data.buildings.0.rooms.0.sections.0.status', 'not_started')
            ->assertJsonPath('data.buildings.0.rooms.1.sections', []);
    });

    it('puts a section with no room in its own list', function () {
        mapSection($this, 'Roomless');

        $this->getJson($this->url)->assertJsonPath('data.unassigned.0.name', 'Roomless');
    });

    it('also lists a section in the rooms where it has classes', function () {
        mapEntry($this, $this->room102);

        $this->getJson($this->url)->assertJsonPath('data.buildings.0.rooms.1.sections.0.name', 'Honesty');
    });

    it('ignores rejected entries and other terms', function () {
        mapEntry($this, $this->room102, 'rejected');

        $this->getJson($this->url)->assertJsonPath('data.buildings.0.rooms.1.sections', []);
    });

    it('keeps a Chairperson to their grade levels', function () {
        mapSection($this, 'Other grade', ['grade_level_id' => mapGrade(9), 'home_room_id' => $this->room102]);

        $this->getJson($this->url)->assertJsonPath('data.buildings.0.rooms.1.sections', []);
    });

    it('shows the Admin everything, and keeps those who only teach out', function () {
        mapSection($this, 'Other grade', ['grade_level_id' => mapGrade(9), 'home_room_id' => $this->room102]);
        $this->actingAs(User::factory()->create()->assignRole('super_admin'));

        $this->getJson($this->url)->assertJsonPath('data.buildings.0.rooms.1.sections.0.name', 'Other grade');
    });

    it('keeps people who only teach out', function () {
        $this->actingAs(User::factory()->create()->assignRole('teacher'));

        $this->getJson($this->url)->assertForbidden();
        $this->getJson("/api/terms/{$this->firstTerm}/rooms/{$this->room101}/schedule")->assertForbidden();
    });

    it('hides rooms not in use unless a section is there', function () {
        DB::table('rooms')->where('id', $this->room102)->update(['is_active' => false]);

        $this->getJson($this->url)->assertJsonCount(1, 'data.buildings.0.rooms');

        mapEntry($this, $this->room102);

        $this->getJson($this->url)->assertJsonCount(2, 'data.buildings.0.rooms');
    });

    it('leaves out a building with no rooms', function () {
        DB::table('buildings')->insert(['name' => 'Empty']);

        $this->getJson($this->url)->assertJsonCount(1, 'data.buildings');
    });
});

describe('room schedule', function () {
    it('lists the classes in a room, with who is there', function () {
        mapEntry($this, $this->room101);

        $this->getJson("/api/terms/{$this->firstTerm}/rooms/{$this->room101}/schedule")
            ->assertOk()
            ->assertJsonPath('data.room.label', 'Main – 101')
            ->assertJsonPath('data.sections', ['Grade 7 – Honesty'])
            ->assertJsonPath('data.entries.0.subject', 'Math 7')
            ->assertJsonPath('data.entries.0.teacher', 'Ana Reyes')
            ->assertJsonPath('data.entries.0.start_time', '07:00')
            ->assertJsonPath('data.entries.0.minutes', 45)
            ->assertJsonPath('data.entries.0.can_open', true);
    });

    it('shows classes of other grades, without letting a Chairperson open them', function () {
        $other = mapSection($this, 'Other grade', ['grade_level_id' => mapGrade(9)]);
        mapEntry($this, $this->room101, 'draft', $other);

        $this->getJson("/api/terms/{$this->firstTerm}/rooms/{$this->room101}/schedule")
            ->assertJsonPath('data.entries.0.section', 'Grade 9 – Other grade')
            ->assertJsonPath('data.entries.0.can_open', false);
    });

    it('leaves out rejected entries', function () {
        mapEntry($this, $this->room101, 'rejected');

        $this->getJson("/api/terms/{$this->firstTerm}/rooms/{$this->room101}/schedule")
            ->assertJsonPath('data.entries', []);
    });
});

describe('copy loading from another term', function () {
    beforeEach(function () {
        $this->url = "/api/terms/{$this->secondTerm}/loading/copy";
    });

    it('copies teachers for this section only, and writes an audit log', function () {
        $other = mapSection($this, 'Hope');
        mapLoading($this, $this->firstTerm);
        mapLoading($this, $this->firstTerm, $other);

        $this->postJson($this->url, ['from_term_id' => $this->firstTerm, 'section_id' => $this->sectionId])
            ->assertOk()
            ->assertJsonPath('data.copied', 1);

        expect(DB::table('section_subjects')->where('term_id', $this->secondTerm)->pluck('section_id')->all())->toBe([$this->sectionId])
            ->and(DB::table('audit_logs')->where('action', 'copy')->where('table_name', 'section_subjects')->exists())->toBeTrue();
    });

    it('copies for all the sections in their grade levels', function () {
        $other = mapSection($this, 'Hope');
        $outside = mapSection($this, 'Outside', ['grade_level_id' => mapGrade(9)]);
        mapLoading($this, $this->firstTerm);
        mapLoading($this, $this->firstTerm, $other);
        mapLoading($this, $this->firstTerm, $outside, mapSubject($this, 'Math 9', ['grade_level_id' => mapGrade(9)]));

        $this->postJson($this->url, ['from_term_id' => $this->firstTerm])
            ->assertOk()
            ->assertJsonPath('data.copied', 2);

        expect(DB::table('section_subjects')->where('term_id', $this->secondTerm)->where('section_id', $outside)->exists())->toBeFalse();
    });

    it('never overwrites what the term already has', function () {
        $benId = DB::table('teachers')->insertGetId(['first_name' => 'Ben', 'last_name' => 'Cruz']);
        mapLoading($this, $this->firstTerm);
        mapLoading($this, $this->secondTerm, teacherId: $benId);

        $this->postJson($this->url, ['from_term_id' => $this->firstTerm])
            ->assertOk()
            ->assertJsonPath('data.copied', 0)
            ->assertJsonPath('data.already_set', 1);

        expect(DB::table('section_subjects')->where('term_id', $this->secondTerm)->value('teacher_id'))->toBe($benId);
    });

    it('skips a subject not taught in this term', function () {
        $onlyFirst = mapSubject($this, 'First only', ['term_no' => 1]);
        mapLoading($this, $this->firstTerm, subjectId: $onlyFirst);

        $this->postJson($this->url, ['from_term_id' => $this->firstTerm])
            ->assertJsonPath('data.copied', 0)
            ->assertJsonPath('data.not_offered', 1);
    });

    it('skips a teacher who is no longer available', function () {
        mapLoading($this, $this->firstTerm);
        DB::table('teachers')->where('id', $this->teacherId)->update(['is_active' => false]);

        $this->postJson($this->url, ['from_term_id' => $this->firstTerm])
            ->assertJsonPath('data.copied', 0)
            ->assertJsonPath('data.teacher_unavailable', 1);
    });

    it('does not copy the schedule itself', function () {
        mapEntry($this, $this->room101);

        $this->postJson($this->url, ['from_term_id' => $this->firstTerm])->assertJsonPath('data.copied', 1);

        expect(DB::table('schedule_entries')->where('term_id', $this->secondTerm)->count())->toBe(0);
    });

    it('needs another term of the same school year', function () {
        $otherYear = DB::table('school_years')->insertGetId([
            'name' => '2027-2028', 'start_date' => '2027-06-01', 'end_date' => '2028-03-31',
        ]);
        $otherTerm = DB::table('school_terms')->insertGetId([
            'school_year_id' => $otherYear, 'term_no' => 1, 'name' => 'Next',
            'start_date' => '2027-06-01', 'end_date' => '2027-09-30',
        ]);

        $this->postJson($this->url, ['from_term_id' => $this->secondTerm])->assertUnprocessable()->assertJsonValidationErrors('from_term_id');
        $this->postJson($this->url, ['from_term_id' => $otherTerm])->assertUnprocessable()->assertJsonValidationErrors('from_term_id');
    });

    it('refuses a section outside their grade levels', function () {
        $outside = mapSection($this, 'Outside', ['grade_level_id' => mapGrade(9)]);

        $this->postJson($this->url, ['from_term_id' => $this->firstTerm, 'section_id' => $outside])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('section_id');
    });

    it('is not for the Admin or teachers', function (string $role) {
        $this->actingAs(User::factory()->create()->assignRole($role));

        $this->postJson($this->url, ['from_term_id' => $this->firstTerm])->assertForbidden();
    })->with(['super_admin', 'teacher']);
});
