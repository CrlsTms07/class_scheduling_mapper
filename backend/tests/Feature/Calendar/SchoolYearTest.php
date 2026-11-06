<?php

use App\Models\User;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    $this->withHeader('Referer', 'http://localhost:5173');
    $this->seed(ReferenceDataSeeder::class);

    $this->admin = User::factory()->create()->assignRole('super_admin');
    $this->actingAs($this->admin);

    // The current year: three terms, the first is active.
    $this->yearId = DB::table('school_years')->insertGetId([
        'name' => '2026-2027', 'term_count' => 3, 'term_label' => 'Term',
        'start_date' => '2026-06-01', 'end_date' => '2027-03-31',
    ]);
    $this->termIds = [];
    foreach ([['First Term', '2026-06-01', '2026-09-15'], ['Second Term', '2026-09-16', '2026-12-15'], ['Third Term', '2027-01-04', '2027-03-31']] as $index => [$name, $start, $end]) {
        $this->termIds[$index + 1] = DB::table('school_terms')->insertGetId([
            'school_year_id' => $this->yearId, 'term_no' => $index + 1, 'name' => $name,
            'start_date' => $start, 'end_date' => $end, 'is_active' => $index === 0,
        ]);
    }
});

function gradeLevelId(int $grade): int
{
    return DB::table('grade_levels')->where('grade', $grade)->value('id');
}

function newYear(array $overrides = []): array
{
    return [
        'name' => '2027-2028',
        'start_date' => '2027-06-01',
        'end_date' => '2028-03-31',
        'term_label' => 'Semester',
        'terms' => [
            ['name' => 'First Semester', 'start_date' => '2027-06-01', 'end_date' => '2027-10-31'],
            ['name' => 'Second Semester', 'start_date' => '2027-11-01', 'end_date' => '2028-03-31'],
        ],
        ...$overrides,
    ];
}

function currentYearAsInput(object $test, array $terms): array
{
    return [
        'name' => '2026-2027',
        'start_date' => '2026-06-01',
        'end_date' => '2027-03-31',
        'term_label' => 'Term',
        'terms' => $terms,
    ];
}

function addSubject(int $yearId, string $name, ?int $termNo = null): int
{
    return DB::table('subjects')->insertGetId([
        'school_year_id' => $yearId, 'grade_level_id' => gradeLevelId(7), 'term_no' => $termNo,
        'name' => $name, 'minutes_per_week' => 225,
    ]);
}

const TWO_TERMS = [
    ['name' => 'First Term', 'start_date' => '2026-06-01', 'end_date' => '2026-09-15'],
    ['name' => 'Second Term', 'start_date' => '2026-09-16', 'end_date' => '2026-12-15'],
];

it('keeps school years to the Admin', function () {
    $glc = User::factory()->create()->assignRole('glc');
    $this->actingAs($glc);

    $this->getJson('/api/school-years')->assertForbidden();
    $this->postJson('/api/school-years', newYear())->assertForbidden();
    $this->putJson("/api/school-years/{$this->yearId}", newYear())->assertForbidden();
    $this->putJson("/api/terms/{$this->termIds[2]}/activate")->assertForbidden();
});

it('lists school years with their terms, newest first', function () {
    DB::table('school_years')->insert([
        'name' => '2025-2026', 'start_date' => '2025-06-01', 'end_date' => '2026-03-31',
    ]);

    $this->getJson('/api/school-years')
        ->assertOk()
        ->assertJsonPath('data.0.name', '2026-2027')
        ->assertJsonPath('data.1.name', '2025-2026')
        ->assertJsonCount(3, 'data.0.terms')
        ->assertJsonPath('data.0.terms.0.is_active', true);
});

it('starts a new year with its own term structure and label', function () {
    $this->postJson('/api/school-years', newYear())
        ->assertCreated()
        ->assertJsonPath('data.name', '2027-2028')
        ->assertJsonPath('data.term_count', 2)
        ->assertJsonPath('data.term_label', 'Semester')
        ->assertJsonPath('data.terms.1.term_no', 2)
        ->assertJsonPath('data.terms.1.name', 'Second Semester');
});

it('does not change the active term when a new year starts', function () {
    $this->postJson('/api/school-years', newYear())->assertCreated();

    expect(DB::table('school_terms')->where('is_active', true)->value('id'))->toBe($this->termIds[1]);
});

it('writes an audit log when a year starts', function () {
    $this->postJson('/api/school-years', newYear())->assertCreated();

    $log = DB::table('audit_logs')->where('table_name', 'school_years')->first();

    expect($log->action)->toBe('create')
        ->and($log->user_id)->toBe($this->admin->id)
        ->and(json_decode($log->new_data)->name)->toBe('2027-2028');
});

it('rejects bad years and term dates', function (array $overrides, string $field) {
    $this->postJson('/api/school-years', newYear($overrides))
        ->assertUnprocessable()
        ->assertJsonValidationErrors($field);
})->with([
    'wrong name format' => [['name' => '2027'], 'name'],
    'name not one year apart' => [['name' => '2027-2029'], 'name'],
    'name already used' => [['name' => '2026-2027'], 'name'],
    'ends before it starts' => [['end_date' => '2027-01-01'], 'end_date'],
    'overlaps another year' => [['start_date' => '2027-03-01'], 'start_date'],
    'no terms' => [['terms' => []], 'terms'],
    'five terms' => [['terms' => array_fill(0, 5, ['name' => 'X', 'start_date' => '2027-06-01', 'end_date' => '2027-06-02'])], 'terms'],
    'same term names' => [['terms' => [
        ['name' => 'Term', 'start_date' => '2027-06-01', 'end_date' => '2027-10-31'],
        ['name' => 'term', 'start_date' => '2027-11-01', 'end_date' => '2028-03-31'],
    ]], 'terms.1.name'],
    'term outside the year' => [['terms' => [
        ['name' => 'First', 'start_date' => '2027-05-01', 'end_date' => '2027-10-31'],
    ]], 'terms.0.start_date'],
    'term ends after the year' => [['terms' => [
        ['name' => 'First', 'start_date' => '2027-06-01', 'end_date' => '2028-04-30'],
    ]], 'terms.0.start_date'],
    'terms overlap' => [['terms' => [
        ['name' => 'First', 'start_date' => '2027-06-01', 'end_date' => '2027-10-31'],
        ['name' => 'Second', 'start_date' => '2027-10-31', 'end_date' => '2028-03-31'],
    ]], 'terms.1.start_date'],
    'term ends before it starts' => [['terms' => [
        ['name' => 'First', 'start_date' => '2027-08-01', 'end_date' => '2027-07-01'],
    ]], 'terms.0.start_date'],
]);

it('leaves nothing behind when validation fails', function () {
    $this->postJson('/api/school-years', newYear(['name' => '2027-2029']))->assertUnprocessable();

    expect(DB::table('school_years')->count())->toBe(1);
});

it('copies only what the Admin ticked', function () {
    addSubject($this->yearId, 'Math 7');
    DB::table('sections')->insert([
        'school_year_id' => $this->yearId, 'grade_level_id' => gradeLevelId(7), 'name' => 'Honesty',
    ]);

    $this->postJson('/api/school-years', newYear([
        'copy_from_id' => $this->yearId,
        'copy' => ['subjects' => true],
    ]))->assertCreated()->assertJsonPath('copied.subjects', 1);

    $newYearId = DB::table('school_years')->where('name', '2027-2028')->value('id');

    expect(DB::table('subjects')->where('school_year_id', $newYearId)->count())->toBe(1)
        ->and(DB::table('sections')->where('school_year_id', $newYearId)->count())->toBe(0);
});

it('copies subjects and counts those of a term the new year does not have', function () {
    addSubject($this->yearId, 'Whole year');
    addSubject($this->yearId, 'In second term', 2);
    addSubject($this->yearId, 'In third term', 3);
    DB::table('subjects')->where('name', 'Whole year')->update(['is_priority' => true]);

    $this->postJson('/api/school-years', newYear([
        'copy_from_id' => $this->yearId,
        'copy' => ['subjects' => true],
    ]))
        ->assertCreated()
        ->assertJsonPath('copied.subjects', 2)
        ->assertJsonPath('copied.subjects_skipped', 1);

    $newYearId = DB::table('school_years')->where('name', '2027-2028')->value('id');
    $copy = DB::table('subjects')->where('school_year_id', $newYearId)->where('name', 'Whole year')->first();

    // The old year keeps its own subjects: curriculum changes never alter past records.
    expect((bool) $copy->is_priority)->toBeTrue()
        ->and(DB::table('subjects')->where('school_year_id', $this->yearId)->count())->toBe(3);
});

it('copies day patterns with their time slots and breaks', function () {
    $patternId = DB::table('day_patterns')->insertGetId([
        'school_year_id' => $this->yearId, 'level' => 'JHS', 'shift' => 'WHOLE_DAY',
        'name' => 'Friday', 'days' => '{5}',
    ]);
    DB::table('time_slots')->insert([
        ['day_pattern_id' => $patternId, 'period_no' => 1, 'label' => null, 'start_time' => '07:00', 'end_time' => '07:40', 'is_break' => false],
        ['day_pattern_id' => $patternId, 'period_no' => null, 'label' => 'Break', 'start_time' => '07:40', 'end_time' => '08:00', 'is_break' => true],
    ]);

    $this->postJson('/api/school-years', newYear([
        'copy_from_id' => $this->yearId,
        'copy' => ['time_slots' => true],
    ]))
        ->assertCreated()
        ->assertJsonPath('copied.day_patterns', 1)
        ->assertJsonPath('copied.time_slots', 2);

    $newYearId = DB::table('school_years')->where('name', '2027-2028')->value('id');
    $pattern = DB::table('day_patterns')->where('school_year_id', $newYearId)->first();

    expect($pattern->days)->toBe('{5}')
        ->and(DB::table('time_slots')->where('day_pattern_id', $pattern->id)->where('is_break', true)->value('label'))->toBe('Break');
});

it('copies signatories to each new term', function () {
    DB::table('report_signatories')->insert([
        'term_id' => $this->termIds[1], 'label' => 'Prepared by', 'name' => 'Name One', 'position' => 'Head Teacher III',
    ]);
    DB::table('report_signatories')->insert([
        'term_id' => $this->termIds[2], 'label' => 'Prepared by', 'name' => 'Name Two', 'position' => 'Head Teacher III',
    ]);

    $this->postJson('/api/school-years', newYear([
        'copy_from_id' => $this->yearId,
        'copy' => ['signatories' => true],
    ]))->assertCreated()->assertJsonPath('copied.signatories', 2);

    $newTerms = DB::table('school_terms')
        ->join('school_years', 'school_years.id', '=', 'school_terms.school_year_id')
        ->where('school_years.name', '2027-2028')
        ->orderBy('term_no')
        ->pluck('school_terms.id');

    expect(DB::table('report_signatories')->where('term_id', $newTerms[0])->value('name'))->toBe('Name One')
        ->and(DB::table('report_signatories')->where('term_id', $newTerms[1])->value('name'))->toBe('Name Two');
});

it('uses the last term signatories when the new year has more terms', function () {
    $lastTerm = $this->termIds[3];
    DB::table('report_signatories')->insert([
        'term_id' => $lastTerm, 'label' => 'Prepared by', 'name' => 'Latest', 'position' => 'Head Teacher III',
    ]);

    $this->postJson('/api/school-years', newYear([
        'term_label' => 'Quarter',
        'terms' => [
            ['name' => 'Q1', 'start_date' => '2027-06-01', 'end_date' => '2027-07-31'],
            ['name' => 'Q2', 'start_date' => '2027-08-01', 'end_date' => '2027-09-30'],
            ['name' => 'Q3', 'start_date' => '2027-10-01', 'end_date' => '2027-12-31'],
            ['name' => 'Q4', 'start_date' => '2028-01-01', 'end_date' => '2028-03-31'],
        ],
        'copy_from_id' => $this->yearId,
        'copy' => ['signatories' => true],
    ]))->assertCreated();

    $fourth = DB::table('school_terms')->where('name', 'Q4')->value('id');

    expect(DB::table('report_signatories')->where('term_id', $fourth)->value('name'))->toBe('Latest');
});

it('copies section names one grade up, without adviser or room, and drops Grade 12', function () {
    $buildingId = DB::table('buildings')->insertGetId(['name' => 'Main']);
    $roomId = DB::table('rooms')->insertGetId(['building_id' => $buildingId, 'room_number' => '101']);
    $trackId = DB::table('tracks')->insertGetId(['name' => 'Academic']);
    $adviserId = DB::table('teachers')->insertGetId(['first_name' => 'A', 'last_name' => 'B']);

    DB::table('sections')->insert([
        ['school_year_id' => $this->yearId, 'grade_level_id' => gradeLevelId(7), 'track_id' => null, 'name' => 'Honesty', 'adviser_id' => $adviserId, 'home_room_id' => $roomId, 'class_size' => 40],
        ['school_year_id' => $this->yearId, 'grade_level_id' => gradeLevelId(11), 'track_id' => $trackId, 'name' => 'Rizal', 'adviser_id' => null, 'home_room_id' => null, 'class_size' => null],
        ['school_year_id' => $this->yearId, 'grade_level_id' => gradeLevelId(12), 'track_id' => $trackId, 'name' => 'Bonifacio', 'adviser_id' => null, 'home_room_id' => null, 'class_size' => null],
    ]);

    $this->postJson('/api/school-years', newYear([
        'copy_from_id' => $this->yearId,
        'copy' => ['section_names' => true],
    ]))->assertCreated()->assertJsonPath('copied.sections', 2);

    $newYearId = DB::table('school_years')->where('name', '2027-2028')->value('id');
    $copied = DB::table('sections')->where('school_year_id', $newYearId)->get()->keyBy('name');

    expect($copied)->toHaveCount(2)
        ->and($copied['Honesty']->grade_level_id)->toBe(gradeLevelId(8))
        ->and($copied['Honesty']->adviser_id)->toBeNull()
        ->and($copied['Honesty']->home_room_id)->toBeNull()
        ->and($copied['Honesty']->class_size)->toBeNull()
        ->and($copied['Rizal']->grade_level_id)->toBe(gradeLevelId(12))
        ->and($copied['Rizal']->track_id)->toBe($trackId);
});

it('renames and re-dates terms in calendar settings', function () {
    $this->putJson("/api/school-years/{$this->yearId}", currentYearAsInput($this, [
        ['name' => 'Term One', 'start_date' => '2026-06-15', 'end_date' => '2026-09-15'],
        ['name' => 'Second Term', 'start_date' => '2026-09-16', 'end_date' => '2026-12-15'],
        ['name' => 'Third Term', 'start_date' => '2027-01-04', 'end_date' => '2027-03-31'],
    ]))
        ->assertOk()
        ->assertJsonPath('data.terms.0.name', 'Term One')
        ->assertJsonPath('data.terms.0.id', $this->termIds[1])
        ->assertJsonPath('data.terms.0.is_active', true);
});

it('can save the same year without tripping over its own name and dates', function () {
    $this->putJson("/api/school-years/{$this->yearId}", [
        ...currentYearAsInput($this, TWO_TERMS),
        'term_label' => 'Semester',
    ])
        ->assertOk()
        ->assertJsonPath('data.term_count', 2)
        ->assertJsonPath('data.term_label', 'Semester');

    expect(DB::table('school_terms')->where('school_year_id', $this->yearId)->count())->toBe(2);
});

it('adds a term at the end', function () {
    $this->putJson("/api/school-years/{$this->yearId}", currentYearAsInput($this, [
        ['name' => 'First', 'start_date' => '2026-06-01', 'end_date' => '2026-08-15'],
        ['name' => 'Second', 'start_date' => '2026-08-16', 'end_date' => '2026-10-31'],
        ['name' => 'Third', 'start_date' => '2026-11-01', 'end_date' => '2027-01-15'],
        ['name' => 'Fourth', 'start_date' => '2027-01-16', 'end_date' => '2027-03-31'],
    ]))->assertOk()->assertJsonPath('data.term_count', 4)->assertJsonPath('data.terms.3.term_no', 4);
});

it('blocks removing the active term', function () {
    DB::table('school_terms')->update(['is_active' => false]);
    DB::table('school_terms')->where('id', $this->termIds[3])->update(['is_active' => true]);

    $this->putJson("/api/school-years/{$this->yearId}", currentYearAsInput($this, TWO_TERMS))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['terms' => 'active term']);
});

it('blocks removing a term that has schedules and names the sections', function () {
    $buildingId = DB::table('buildings')->insertGetId(['name' => 'Main']);
    $roomId = DB::table('rooms')->insertGetId(['building_id' => $buildingId, 'room_number' => '101']);
    $teacherId = DB::table('teachers')->insertGetId(['first_name' => 'A', 'last_name' => 'B']);
    $sectionId = DB::table('sections')->insertGetId([
        'school_year_id' => $this->yearId, 'grade_level_id' => gradeLevelId(7), 'name' => 'Honesty',
    ]);
    $loadingId = DB::table('section_subjects')->insertGetId([
        'term_id' => $this->termIds[3], 'section_id' => $sectionId,
        'subject_id' => addSubject($this->yearId, 'Math 7'), 'teacher_id' => $teacherId,
    ]);
    DB::table('schedule_entries')->insert([
        'term_id' => $this->termIds[3], 'section_id' => $sectionId, 'section_subject_id' => $loadingId,
        'teacher_id' => $teacherId, 'room_id' => $roomId, 'created_by' => $this->admin->id,
        'day_of_week' => 5, 'start_time' => '07:00', 'end_time' => '07:40',
    ]);

    $this->putJson("/api/school-years/{$this->yearId}", currentYearAsInput($this, TWO_TERMS))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['terms' => 'Grade 7 Honesty']);

    expect(DB::table('school_terms')->where('school_year_id', $this->yearId)->count())->toBe(3);
});

it('blocks removing a term that still has subjects', function () {
    addSubject($this->yearId, 'In third term', 3);

    $this->putJson("/api/school-years/{$this->yearId}", currentYearAsInput($this, TWO_TERMS))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['terms' => '1 subject']);
});

it('tells the screen ahead of time which terms cannot be removed', function () {
    $this->getJson('/api/school-years')
        ->assertJsonPath('data.0.terms.0.cannot_remove_reason', 'First Term is the active term. Set another term as active first.')
        ->assertJsonPath('data.0.terms.2.cannot_remove_reason', null);
});

it('switches the active term and writes an audit log', function () {
    $this->putJson("/api/terms/{$this->termIds[2]}/activate")->assertOk();

    expect(DB::table('school_terms')->where('is_active', true)->pluck('id')->all())->toBe([$this->termIds[2]]);

    $log = DB::table('audit_logs')->where('table_name', 'school_terms')->first();
    expect(json_decode($log->old_data)->active_term_id)->toBe($this->termIds[1])
        ->and(json_decode($log->new_data)->active_term_id)->toBe($this->termIds[2]);
});

it('can activate the term that is already active', function () {
    $this->putJson("/api/terms/{$this->termIds[1]}/activate")->assertOk();

    expect(DB::table('school_terms')->where('is_active', true)->value('id'))->toBe($this->termIds[1]);
});
