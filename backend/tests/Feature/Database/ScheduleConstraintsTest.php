<?php

use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/**
 * Builds one school year with two terms, two sections, two rooms and two teachers.
 * Section 1 is taught by teacher 1 and section 2 by teacher 2, in both terms.
 */
function scheduleWorld(): object
{
    $world = new stdClass;
    $world->userId = User::factory()->create()->id;

    $yearId = DB::table('school_years')->insertGetId([
        'name' => '2026-2027', 'start_date' => '2026-06-01', 'end_date' => '2027-03-31',
    ]);
    $world->termOne = DB::table('school_terms')->insertGetId([
        'school_year_id' => $yearId, 'term_no' => 1, 'name' => 'First Term',
        'start_date' => '2026-06-01', 'end_date' => '2026-09-30', 'is_active' => true,
    ]);
    $world->termTwo = DB::table('school_terms')->insertGetId([
        'school_year_id' => $yearId, 'term_no' => 2, 'name' => 'Second Term',
        'start_date' => '2026-10-01', 'end_date' => '2027-01-31',
    ]);

    $gradeId = DB::table('grade_levels')->insertGetId(['grade' => 7, 'level' => 'JHS']);
    $buildingId = DB::table('buildings')->insertGetId(['name' => 'Building']);
    $world->roomOne = DB::table('rooms')->insertGetId(['building_id' => $buildingId, 'room_number' => '101']);
    $world->roomTwo = DB::table('rooms')->insertGetId(['building_id' => $buildingId, 'room_number' => '102']);
    $world->teacherOne = DB::table('teachers')->insertGetId(['first_name' => 'Teacher', 'last_name' => 'One']);
    $world->teacherTwo = DB::table('teachers')->insertGetId(['first_name' => 'Teacher', 'last_name' => 'Two']);
    $world->sectionOne = DB::table('sections')->insertGetId(['school_year_id' => $yearId, 'grade_level_id' => $gradeId, 'name' => 'A']);
    $world->sectionTwo = DB::table('sections')->insertGetId(['school_year_id' => $yearId, 'grade_level_id' => $gradeId, 'name' => 'B']);
    $world->subjectId = DB::table('subjects')->insertGetId([
        'school_year_id' => $yearId, 'grade_level_id' => $gradeId, 'name' => 'Math', 'minutes_per_week' => 225,
    ]);

    $world->loading = [];
    foreach ([$world->termOne, $world->termTwo] as $termId) {
        foreach ([[$world->sectionOne, $world->teacherOne], [$world->sectionTwo, $world->teacherTwo]] as [$sectionId, $teacherId]) {
            $world->loading[$termId][$sectionId] = DB::table('section_subjects')->insertGetId([
                'term_id' => $termId, 'section_id' => $sectionId, 'subject_id' => $world->subjectId, 'teacher_id' => $teacherId,
            ]);
        }
    }

    return $world;
}

/**
 * Inserts a schedule entry for section 1 on Monday 7:00–7:45 unless overridden.
 * Runs in its own savepoint so a rejected insert does not abort the rest of the test.
 */
function addEntry(object $world, array $overrides = []): int
{
    $termId = $overrides['term_id'] ?? $world->termOne;
    $sectionId = $overrides['section_id'] ?? $world->sectionOne;
    $defaultTeacher = $sectionId === $world->sectionOne ? $world->teacherOne : $world->teacherTwo;

    return DB::transaction(fn () => DB::table('schedule_entries')->insertGetId(array_merge([
        'term_id' => $termId,
        'section_id' => $sectionId,
        'section_subject_id' => $world->loading[$termId][$sectionId],
        'teacher_id' => $defaultTeacher,
        'room_id' => $world->roomOne,
        'day_of_week' => 1,
        'start_time' => '07:00',
        'end_time' => '07:45',
        'created_by' => $world->userId,
    ], $overrides)));
}

/**
 * An entry with no subject and teacher yet, as created by "copy to next term".
 */
function openSlot(array $overrides = []): array
{
    return array_merge(['section_subject_id' => null, 'teacher_id' => null], $overrides);
}

beforeEach(function () {
    $this->world = scheduleWorld();
});

// ---- Hard conflicts -------------------------------------------------------

it('blocks a teacher teaching two sections at the same time', function () {
    // Teacher 1 now teaches both sections.
    DB::table('section_subjects')
        ->where('id', $this->world->loading[$this->world->termOne][$this->world->sectionTwo])
        ->update(['teacher_id' => $this->world->teacherOne]);

    addEntry($this->world);

    expect(fn () => addEntry($this->world, [
        'section_id' => $this->world->sectionTwo,
        'teacher_id' => $this->world->teacherOne,
        'room_id' => $this->world->roomTwo,
    ]))->toThrow(QueryException::class, 'no_teacher_conflict');
});

it('blocks two sections using one room at the same time', function () {
    addEntry($this->world);

    expect(fn () => addEntry($this->world, ['section_id' => $this->world->sectionTwo]))
        ->toThrow(QueryException::class, 'no_room_conflict');
});

it('blocks one section having two classes at the same time', function () {
    addEntry($this->world, openSlot(['room_id' => null]));

    expect(fn () => addEntry($this->world, openSlot(['room_id' => null])))
        ->toThrow(QueryException::class, 'no_section_conflict');
});

it('reports conflicts with SQLSTATE 23P01 so the API can translate them', function () {
    addEntry($this->world);

    try {
        addEntry($this->world, ['section_id' => $this->world->sectionTwo]);
        $this->fail('Expected the room conflict to be rejected.');
    } catch (QueryException $exception) {
        expect($exception->getCode())->toBe('23P01');
    }
});

it('blocks a partial overlap', function () {
    addEntry($this->world);

    expect(fn () => addEntry($this->world, [
        'section_id' => $this->world->sectionTwo,
        'start_time' => '07:30',
        'end_time' => '08:15',
    ]))->toThrow(QueryException::class, 'no_room_conflict');
});

// ---- Allowed cases --------------------------------------------------------

it('allows back-to-back classes', function () {
    addEntry($this->world);
    addEntry($this->world, ['start_time' => '07:45', 'end_time' => '08:30']);

    expect(DB::table('schedule_entries')->count())->toBe(2);
});

it('allows the same teacher, room and time on a different day', function () {
    addEntry($this->world);
    addEntry($this->world, ['day_of_week' => 2]);

    expect(DB::table('schedule_entries')->count())->toBe(2);
});

it('allows the same teacher, room and time in a different term', function () {
    addEntry($this->world);
    addEntry($this->world, ['term_id' => $this->world->termTwo]);

    expect(DB::table('schedule_entries')->count())->toBe(2);
});

it('ignores rejected entries', function () {
    addEntry($this->world, ['status' => 'rejected']);
    addEntry($this->world, ['section_id' => $this->world->sectionTwo]);

    expect(DB::table('schedule_entries')->count())->toBe(2);
});

// ---- Open slots -----------------------------------------------------------

it('does not treat open slots as teacher conflicts', function () {
    addEntry($this->world, openSlot(['room_id' => null]));
    addEntry($this->world, openSlot(['section_id' => $this->world->sectionTwo, 'room_id' => null]));

    expect(DB::table('schedule_entries')->count())->toBe(2);
});

it('still reserves the room of an open slot', function () {
    addEntry($this->world, openSlot());

    expect(fn () => addEntry($this->world, openSlot(['section_id' => $this->world->sectionTwo])))
        ->toThrow(QueryException::class, 'no_room_conflict');
});

it('does not allow an open slot to be submitted', function () {
    expect(fn () => addEntry($this->world, openSlot(['status' => 'pending'])))
        ->toThrow(QueryException::class, 'check');
});

// ---- Teacher loading ------------------------------------------------------

it('rejects an entry whose teacher does not match the teacher loading', function () {
    expect(fn () => addEntry($this->world, ['teacher_id' => $this->world->teacherTwo]))
        ->toThrow(QueryException::class, 'foreign key');
});

// ---- Soft flag data -------------------------------------------------------

it('shows Homeroom scheduled over 60 minutes in subject_minutes_check', function () {
    DB::table('subjects')->where('id', $this->world->subjectId)->update(['name' => 'Homeroom Guidance', 'minutes_per_week' => 60]);

    addEntry($this->world);
    addEntry($this->world, ['day_of_week' => 2]);

    $check = DB::table('subject_minutes_check')
        ->where('section_subject_id', $this->world->loading[$this->world->termOne][$this->world->sectionOne])
        ->first();

    expect($check->required_minutes)->toBe(60)
        ->and($check->scheduled_minutes)->toBe(90)
        ->and($check->scheduled_minutes > $check->required_minutes)->toBeTrue();
});

it('does not count rejected entries in subject_minutes_check', function () {
    addEntry($this->world);
    addEntry($this->world, ['day_of_week' => 2, 'status' => 'rejected']);

    $check = DB::table('subject_minutes_check')
        ->where('section_subject_id', $this->world->loading[$this->world->termOne][$this->world->sectionOne])
        ->first();

    expect($check->scheduled_minutes)->toBe(45);
});
