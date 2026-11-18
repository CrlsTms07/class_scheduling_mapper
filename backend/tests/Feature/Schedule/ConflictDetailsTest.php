<?php

use App\Models\ScheduleEntry;
use App\Models\Section;
use App\Models\SectionSubject;
use App\Models\TimeSlot;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Support\Facades\DB;

/*
 * What a conflict tells the user: who, which subject, which section and when, plus the
 * teachers who are free at that time. The server decides; the screen only shows it.
 */

beforeEach(function () {
    $this->withHeader('Referer', 'http://localhost:5173');
    $this->seed(DatabaseSeeder::class);

    $this->actingAs(User::where('email', 'glc@deped.gov.ph')->first());
    $this->termId = DB::table('school_terms')->where('is_active', true)->value('id');
    $this->sectionA = Section::where('name', 'Sample A')->first();
    $this->sectionB = Section::where('name', 'Sample B')->first();
    $this->slot = TimeSlot::whereHas('dayPattern', fn ($query) => $query->where('name', 'Monday – Thursday'))
        ->where('period_no', 3)
        ->first();
});

function loadingOf(Section $section, string $subject): SectionSubject
{
    return SectionSubject::where('section_id', $section->id)
        ->whereHas('subject', fn ($query) => $query->where('name', $subject))
        ->first();
}

function placeMath(object $test, Section $section, array $days = [1, 2, 3, 4])
{
    return $test->putJson("/api/terms/{$test->termId}/sections/{$section->id}/slots/{$test->slot->id}", [
        'section_subject_id' => loadingOf($section, 'Enhanced Mathematics')->id,
        'room_id' => $section->home_room_id,
        'days' => $days,
    ]);
}

/** A new teaching teacher, free unless given something to do. */
function newTeacher(string $lastName, string $shift = 'WHOLE_DAY'): int
{
    return DB::table('teachers')->insertGetId(['first_name' => 'New', 'last_name' => $lastName, 'shift' => $shift]);
}

function placeShs(object $test, string $shift, TimeSlot $slot)
{
    [$section, $loading] = $test->shs[$shift];

    return $test->putJson("/api/terms/{$test->termId}/sections/{$section->id}/slots/{$slot->id}", [
        'section_subject_id' => $loading->id, 'room_id' => $test->room, 'days' => [1],
    ]);
}

it('says which section, subject and time the teacher is already in', function () {
    placeMath($this, $this->sectionA)->assertOk();

    placeMath($this, $this->sectionB)
        ->assertUnprocessable()
        ->assertJsonPath('conflicts.0.type', 'teacher')
        ->assertJsonPath('conflicts.0.section', 'Grade 7 – Sample A')
        ->assertJsonPath('conflicts.0.subject', 'Enhanced Mathematics')
        ->assertJsonPath('conflicts.0.time', '8:00 AM – 9:20 AM');
});

it('lists free teachers, never the busy ones', function () {
    // Monday: Filipino in Sample A. Tuesday to Thursday: Math.
    $this->putJson("/api/terms/{$this->termId}/sections/{$this->sectionA->id}/slots/{$this->slot->id}", [
        'section_subject_id' => loadingOf($this->sectionA, 'Filipino')->id,
        'room_id' => $this->sectionA->home_room_id,
        'days' => [1],
    ])->assertOk();
    placeMath($this, $this->sectionA, [2, 3, 4])->assertOk();
    $filipinoTeacher = loadingOf($this->sectionA, 'Filipino')->teacher_id;

    // Sample B wants Filipino at the same time on Monday: its teacher is busy.
    $response = $this->putJson("/api/terms/{$this->termId}/sections/{$this->sectionB->id}/slots/{$this->slot->id}", [
        'section_subject_id' => loadingOf($this->sectionB, 'Filipino')->id,
        'room_id' => $this->sectionB->home_room_id,
        'days' => [1],
    ])->assertUnprocessable();
    $teachers = collect($response->json('suggestions.teachers'));

    expect($teachers)->not->toBeEmpty()
        ->and($teachers->count())->toBeLessThanOrEqual(5)
        ->and($teachers->pluck('id'))->not->toContain($filipinoTeacher);

    foreach ($teachers->pluck('id') as $id) {
        expect(ScheduleEntry::where('teacher_id', $id)
            ->where('term_id', $this->termId)
            ->where('day_of_week', 1)
            ->where('start_time', '<', $this->slot->end_time)
            ->where('end_time', '>', $this->slot->start_time)
            ->exists())->toBeFalse();
    }
});

it('puts teachers who already teach the subject first', function () {
    placeMath($this, $this->sectionA)->assertOk();

    // Another Grade 7 section, whose Math is taught by a new teacher.
    $other = Section::create([
        'school_year_id' => $this->sectionA->school_year_id,
        'grade_level_id' => $this->sectionA->grade_level_id,
        'name' => 'Sample C',
    ]);
    $mathTeacher = newTeacher('Zamora');
    SectionSubject::create([
        'term_id' => $this->termId,
        'section_id' => $other->id,
        'subject_id' => loadingOf($this->sectionA, 'Enhanced Mathematics')->subject_id,
        'teacher_id' => $mathTeacher,
    ]);

    $teachers = placeMath($this, $this->sectionB)->assertUnprocessable()->json('suggestions.teachers');

    expect($teachers[0]['id'])->toBe($mathTeacher)
        ->and($teachers[0]['teaches_subject'])->toBeTrue()
        ->and($teachers[1]['teaches_subject'])->toBeFalse();
});

it('leaves out non-teaching, inactive and other-shift personnel', function () {
    placeMath($this, $this->sectionA)->assertOk();
    $this->sectionB->update(['shift' => 'AM']);

    $staff = newTeacher('Staff');
    DB::table('teachers')->where('id', $staff)->update(['personnel_type' => 'non_teaching']);
    $inactive = newTeacher('Inactive');
    DB::table('teachers')->where('id', $inactive)->update(['is_active' => false]);
    $afternoon = newTeacher('Afternoon', 'PM');

    $ids = collect(placeMath($this, $this->sectionB)->assertUnprocessable()->json('suggestions.teachers'))->pluck('id');

    expect($ids)->not->toContain($staff)
        ->not->toContain($inactive)
        ->not->toContain($afternoon);

    expect(DB::table('teachers')->whereIn('id', $ids)->pluck('shift')->unique()->diff(['AM', 'WHOLE_DAY']))->toBeEmpty();
});

it('gives the same list every time', function () {
    placeMath($this, $this->sectionA)->assertOk();

    $first = placeMath($this, $this->sectionB)->json('suggestions.teachers');
    $second = placeMath($this, $this->sectionB)->json('suggestions.teachers');

    expect($first)->toBe($second);
});

describe('SHS rooms', function () {
    beforeEach(function () {
        $grade = DB::table('grade_levels')->where('grade', 11)->value('id');
        $yearId = $this->sectionA->school_year_id;
        // Each shift has its own bell schedule. 10:00–12:00 and 11:00–13:00 overlap.
        $slots = [];
        foreach (['AM' => [['06:00', '08:00'], ['10:00', '12:00']], 'PM' => [['13:00', '15:00'], ['11:00', '13:00']]] as $shift => $times) {
            $pattern = DB::table('day_patterns')->insertGetId([
                'school_year_id' => $yearId, 'level' => 'SHS', 'shift' => $shift, 'name' => 'Monday – Friday', 'days' => '{1,2,3,4,5}',
            ]);
            foreach ($times as $index => [$start, $end]) {
                $slots[$shift][] = TimeSlot::create([
                    'day_pattern_id' => $pattern, 'period_no' => $index + 1, 'start_time' => $start, 'end_time' => $end, 'is_break' => false,
                ]);
            }
        }
        $this->slots = $slots;
        $this->room = $this->sectionA->home_room_id;

        $subject = DB::table('subjects')->insertGetId([
            'school_year_id' => $yearId, 'grade_level_id' => $grade, 'name' => 'Gen Bio', 'minutes_per_week' => 240,
        ]);

        $master = User::factory()->create()->assignRole('master_teacher');
        $master->gradeLevels()->sync([$grade]);
        $this->actingAs($master);

        $this->shs = [];
        foreach (['STEM AM' => 'AM', 'STEM PM' => 'PM'] as $name => $shift) {
            $section = Section::create([
                'school_year_id' => $yearId, 'grade_level_id' => $grade, 'name' => $name, 'shift' => $shift,
            ]);
            $teacher = newTeacher($name, $shift);
            $loading = SectionSubject::create([
                'term_id' => $this->termId, 'section_id' => $section->id, 'subject_id' => $subject, 'teacher_id' => $teacher,
            ]);
            $this->shs[$shift] = [$section, $loading];
        }
    });

    it('lets the AM and PM shifts share a room at different times', function () {
        placeShs($this, 'AM', $this->slots['AM'][0])->assertOk();
        placeShs($this, 'PM', $this->slots['PM'][0])->assertOk();
    });

    it('blocks the same room at the same time, and says who has it', function () {
        placeShs($this, 'AM', $this->slots['AM'][1])->assertOk();

        placeShs($this, 'PM', $this->slots['PM'][1])
            ->assertUnprocessable()
            ->assertJsonPath('conflicts.0.type', 'room')
            ->assertJsonPath('conflicts.0.section', 'Grade 11 – STEM AM')
            ->assertJsonPath('conflicts.0.subject', 'Gen Bio');
    });
});
