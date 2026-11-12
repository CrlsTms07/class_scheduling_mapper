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
    $this->teacherId = DB::table('teachers')->insertGetId(['first_name' => 'Ana', 'last_name' => 'Reyes']);
    $buildingId = DB::table('buildings')->insertGetId(['name' => 'Main']);
    $this->roomId = DB::table('rooms')->insertGetId(['building_id' => $buildingId, 'room_number' => '101']);
    $this->trackId = DB::table('tracks')->insertGetId(['name' => 'Academic']);
});

function sectionGradeId(int $grade): int
{
    return DB::table('grade_levels')->where('grade', $grade)->value('id');
}

function sectionBody(array $overrides = []): array
{
    return [
        'grade_level_id' => sectionGradeId(7),
        'name' => 'Honesty',
        'shift' => 'WHOLE_DAY',
        'track_id' => null,
        'adviser_id' => null,
        'home_room_id' => null,
        'class_size' => null,
        ...$overrides,
    ];
}

function insertSection(object $test, array $overrides = []): int
{
    return DB::table('sections')->insertGetId([
        'school_year_id' => $test->yearId, 'grade_level_id' => sectionGradeId(7), 'name' => 'Existing', ...$overrides,
    ]);
}

function addLoadingTo(object $test, int $sectionId): array
{
    $subjectId = DB::table('subjects')->insertGetId([
        'school_year_id' => $test->yearId, 'grade_level_id' => sectionGradeId(7), 'name' => 'Math 7', 'minutes_per_week' => 225,
    ]);
    $loadingId = DB::table('section_subjects')->insertGetId([
        'term_id' => $test->termId, 'section_id' => $sectionId, 'subject_id' => $subjectId, 'teacher_id' => $test->teacherId,
    ]);

    return [$subjectId, $loadingId];
}

it('lets a Chairperson manage the sections of their own grade levels only', function () {
    $own = insertSection($this);
    $other = insertSection($this, ['grade_level_id' => sectionGradeId(8), 'name' => 'Other']);
    $glc = User::factory()->create()->assignRole('glc');
    $glc->gradeLevels()->sync([sectionGradeId(7)]);
    $this->actingAs($glc);

    $this->getJson("/api/school-years/{$this->yearId}/sections")->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $own);
    $this->getJson("/api/school-years/{$this->yearId}/section-options")->assertOk()->assertJsonCount(1, 'data.grade_levels');
    $this->postJson("/api/school-years/{$this->yearId}/sections", sectionBody())->assertCreated();
    $this->postJson("/api/school-years/{$this->yearId}/sections", sectionBody(['grade_level_id' => sectionGradeId(8), 'name' => 'Faith']))->assertForbidden();
    $this->putJson("/api/sections/{$own}", sectionBody(['name' => 'Renamed']))->assertOk();
    $this->putJson("/api/sections/{$own}", sectionBody(['grade_level_id' => sectionGradeId(8)]))->assertForbidden();
    $this->putJson("/api/sections/{$other}", sectionBody(['grade_level_id' => sectionGradeId(8)]))->assertForbidden();
    $this->deleteJson("/api/sections/{$other}")->assertForbidden();
    $this->deleteJson("/api/sections/{$own}")->assertOk();
});

it('keeps teachers out of section management', function () {
    $this->actingAs(User::factory()->create()->assignRole('teacher'));

    $this->getJson("/api/school-years/{$this->yearId}/sections")->assertForbidden();
    $this->postJson("/api/school-years/{$this->yearId}/sections", sectionBody())->assertForbidden();
});

it('creates a JHS section with adviser, room and class size, and writes an audit log', function () {
    $this->postJson("/api/school-years/{$this->yearId}/sections", sectionBody([
        'adviser_id' => $this->teacherId, 'home_room_id' => $this->roomId, 'class_size' => 40,
    ]))
        ->assertCreated()
        ->assertJsonPath('data.label', 'Grade 7 – Honesty')
        ->assertJsonPath('data.adviser', 'Ana Reyes')
        ->assertJsonPath('data.home_room', 'Main – 101')
        ->assertJsonPath('data.class_size', 40)
        ->assertJsonPath('data.locked_reason', null);

    expect(DB::table('audit_logs')->where('table_name', 'sections')->where('action', 'create')->exists())->toBeTrue();
});

it('creates an SHS section with a track and no home room', function () {
    $this->postJson("/api/school-years/{$this->yearId}/sections", sectionBody([
        'grade_level_id' => sectionGradeId(11), 'track_id' => $this->trackId, 'shift' => 'AM',
    ]))
        ->assertCreated()
        ->assertJsonPath('data.level', 'SHS')
        ->assertJsonPath('data.track', 'Academic');
});

it('takes a co-adviser, who may advise another section', function () {
    DB::table('sections')->insert([
        'school_year_id' => $this->yearId, 'grade_level_id' => sectionGradeId(8), 'name' => 'Other', 'adviser_id' => $this->teacherId,
    ]);
    $adviser = DB::table('teachers')->insertGetId(['first_name' => 'Ben', 'last_name' => 'Cruz']);

    $this->postJson("/api/school-years/{$this->yearId}/sections", sectionBody(['adviser_id' => $adviser, 'co_adviser_id' => $this->teacherId]))
        ->assertCreated()
        ->assertJsonPath('data.co_adviser_id', $this->teacherId);
});

it('refuses a co-adviser who is also the adviser, or is not teaching', function () {
    $this->postJson("/api/school-years/{$this->yearId}/sections", sectionBody(['adviser_id' => $this->teacherId, 'co_adviser_id' => $this->teacherId]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['co_adviser_id' => 'other than the adviser']);

    $staff = DB::table('teachers')->insertGetId(['first_name' => 'Cy', 'last_name' => 'Staff', 'personnel_type' => 'non_teaching']);

    $this->postJson("/api/school-years/{$this->yearId}/sections", sectionBody(['co_adviser_id' => $staff]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['co_adviser_id' => 'teaching personnel']);
});

it('keeps a teacher who is a co-adviser from being deleted', function () {
    $coAdviser = DB::table('teachers')->insertGetId(['first_name' => 'Dee', 'last_name' => 'Santos']);
    DB::table('sections')->insert([
        'school_year_id' => $this->yearId, 'grade_level_id' => sectionGradeId(8), 'name' => 'Other', 'co_adviser_id' => $coAdviser,
    ]);

    $this->deleteJson("/api/teachers/{$coAdviser}")
        ->assertUnprocessable();

    expect(DB::table('teachers')->where('id', $coAdviser)->exists())->toBeTrue();
});

it('lets an SHS section have a usual room', function () {
    $this->postJson("/api/school-years/{$this->yearId}/sections", sectionBody([
        'grade_level_id' => sectionGradeId(11), 'track_id' => $this->trackId, 'shift' => 'AM', 'home_room_id' => $this->roomId,
    ]))
        ->assertCreated()
        ->assertJsonPath('data.home_room', 'Main – 101');
});

it('lists only the sections of that year, by grade and then name', function () {
    insertSection($this, ['grade_level_id' => sectionGradeId(8), 'name' => 'Alpha']);
    insertSection($this, ['name' => 'Zeta']);
    insertSection($this, ['name' => 'Beta']);
    $otherYear = DB::table('school_years')->insertGetId([
        'name' => '2025-2026', 'start_date' => '2025-06-01', 'end_date' => '2026-03-31',
    ]);
    DB::table('sections')->insert(['school_year_id' => $otherYear, 'grade_level_id' => sectionGradeId(7), 'name' => 'Old']);

    $this->getJson("/api/school-years/{$this->yearId}/sections")
        ->assertOk()
        ->assertJsonCount(3, 'data')
        ->assertJsonPath('data.0.name', 'Beta')
        ->assertJsonPath('data.1.name', 'Zeta')
        ->assertJsonPath('data.2.name', 'Alpha');
});

it('rejects bad sections', function (callable $change, string $field) {
    insertSection($this, ['name' => 'Taken']);

    $this->postJson("/api/school-years/{$this->yearId}/sections", sectionBody($change($this)))
        ->assertUnprocessable()
        ->assertJsonValidationErrors($field);
})->with([
    'no name' => [fn ($test) => ['name' => ''], 'name'],
    'name taken in the grade' => [fn ($test) => ['name' => 'taken'], 'name'],
    'unknown grade' => [fn ($test) => ['grade_level_id' => 999], 'grade_level_id'],
    'unknown shift' => [fn ($test) => ['shift' => 'NIGHT'], 'shift'],
    'negative class size' => [fn ($test) => ['class_size' => -1], 'class_size'],
    'track on a JHS section' => [fn ($test) => ['track_id' => $test->trackId], 'track_id'],
]);

it('allows the same name in another grade or another school year', function () {
    insertSection($this, ['name' => 'Honesty']);

    $this->postJson("/api/school-years/{$this->yearId}/sections", sectionBody(['grade_level_id' => sectionGradeId(8)]))
        ->assertCreated();
});

it('allows one advisory per teacher per year and names the other section', function () {
    insertSection($this, ['name' => 'Taken', 'adviser_id' => $this->teacherId]);

    $this->postJson("/api/school-years/{$this->yearId}/sections", sectionBody(['adviser_id' => $this->teacherId]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['adviser_id' => 'already advises Grade 7 – Taken']);
});

it('refuses non-teaching or inactive personnel as adviser', function (array $teacher) {
    $staffId = DB::table('teachers')->insertGetId(['first_name' => 'X', 'last_name' => 'Y', ...$teacher]);

    $this->postJson("/api/school-years/{$this->yearId}/sections", sectionBody(['adviser_id' => $staffId]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['adviser_id' => 'active teaching personnel']);
})->with([
    'non-teaching' => [['personnel_type' => 'non_teaching']],
    'inactive' => [['is_active' => false]],
]);

it('saves a section without tripping over its own name or adviser', function () {
    $sectionId = insertSection($this, ['name' => 'Honesty', 'adviser_id' => $this->teacherId]);

    $this->putJson("/api/sections/{$sectionId}", sectionBody(['adviser_id' => $this->teacherId, 'class_size' => 35]))
        ->assertOk()
        ->assertJsonPath('data.class_size', 35);
});

it('deletes a section with no work on it', function () {
    $sectionId = insertSection($this);

    $this->deleteJson("/api/sections/{$sectionId}")->assertOk();

    expect(DB::table('sections')->count())->toBe(0);
});

describe('once a section has teacher loading', function () {
    beforeEach(function () {
        $this->sectionId = insertSection($this);
        addLoadingTo($this, $this->sectionId);
    });

    it('says so on the list', function () {
        $this->getJson("/api/school-years/{$this->yearId}/sections")
            ->assertJsonPath('data.0.locked_reason', 'This section already has teacher loading.');
    });

    it('cannot change grade or shift', function () {
        $this->putJson("/api/sections/{$this->sectionId}", sectionBody(['grade_level_id' => sectionGradeId(8), 'name' => 'Existing']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('grade_level_id');
        $this->putJson("/api/sections/{$this->sectionId}", sectionBody(['shift' => 'AM', 'name' => 'Existing']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('shift');
    });

    it('can still change name, adviser, room and class size', function () {
        $this->putJson("/api/sections/{$this->sectionId}", sectionBody([
            'name' => 'Renamed', 'adviser_id' => $this->teacherId, 'home_room_id' => $this->roomId, 'class_size' => 30,
        ]))->assertOk()->assertJsonPath('data.name', 'Renamed');
    });

    it('cannot be deleted', function () {
        $this->deleteJson("/api/sections/{$this->sectionId}")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['section' => 'teacher loading']);
    });
});

it('locks a section that has schedules, even open slots', function () {
    $sectionId = insertSection($this);
    DB::table('schedule_entries')->insert([
        'term_id' => $this->termId, 'section_id' => $sectionId, 'created_by' => $this->admin->id,
        'day_of_week' => 1, 'start_time' => '07:00', 'end_time' => '07:45',
    ]);

    $this->deleteJson("/api/sections/{$sectionId}")
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['section' => 'already has schedules']);
});

it('gives the form its choices, leaving out non-teaching and inactive personnel', function () {
    DB::table('teachers')->insert(['first_name' => 'Staff', 'last_name' => 'Only', 'personnel_type' => 'non_teaching']);
    DB::table('teachers')->insert(['first_name' => 'Gone', 'last_name' => 'Away', 'is_active' => false]);
    $sectionId = insertSection($this, ['name' => 'Taken', 'adviser_id' => $this->teacherId]);

    $this->getJson("/api/school-years/{$this->yearId}/section-options")
        ->assertOk()
        ->assertJsonCount(6, 'data.grade_levels')
        ->assertJsonCount(1, 'data.teachers')
        ->assertJsonPath('data.teachers.0.name', 'Ana Reyes')
        ->assertJsonPath('data.teachers.0.advises_section_id', $sectionId)
        ->assertJsonPath('data.teachers.0.advises', 'Grade 7 – Taken')
        ->assertJsonPath('data.rooms.0.label', 'Main – 101')
        ->assertJsonPath('data.tracks.0.name', 'Academic');
});

it('counts an advisory only in its own school year', function () {
    $otherYear = DB::table('school_years')->insertGetId([
        'name' => '2025-2026', 'start_date' => '2025-06-01', 'end_date' => '2026-03-31',
    ]);
    DB::table('sections')->insert([
        'school_year_id' => $otherYear, 'grade_level_id' => sectionGradeId(7), 'name' => 'Old', 'adviser_id' => $this->teacherId,
    ]);

    $this->postJson("/api/school-years/{$this->yearId}/sections", sectionBody(['adviser_id' => $this->teacherId]))
        ->assertCreated();
});

it('keeps adding tracks away from people who only teach', function () {
    $this->actingAs(User::factory()->create()->assignRole('teacher'));

    $this->postJson('/api/tracks', ['name' => 'TechPro'])->assertForbidden();
});

it('adds a track once', function () {
    $this->postJson('/api/tracks', ['name' => 'TechPro'])
        ->assertCreated()
        ->assertJsonPath('data.name', 'TechPro');

    $this->postJson('/api/tracks', ['name' => 'TechPro'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('name');
});
