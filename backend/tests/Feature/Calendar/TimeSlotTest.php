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
    $this->patternId = DB::table('day_patterns')->insertGetId([
        'school_year_id' => $this->yearId, 'level' => 'JHS', 'shift' => 'WHOLE_DAY',
        'name' => 'Monday – Thursday', 'days' => '{1,2,3,4}',
    ]);
    $this->firstSlotId = DB::table('time_slots')->insertGetId([
        'day_pattern_id' => $this->patternId, 'period_no' => 1, 'start_time' => '07:00', 'end_time' => '07:45',
    ]);
});

function period(array $overrides = []): array
{
    return ['is_break' => false, 'label' => null, 'start_time' => '08:00', 'end_time' => '08:45', ...$overrides];
}

function pattern(array $overrides = []): array
{
    return ['level' => 'JHS', 'shift' => 'WHOLE_DAY', 'name' => 'Friday', 'days' => [5], ...$overrides];
}

/** Puts one schedule entry of Grade 7 Honesty on Monday 7:00–7:45, the first slot. */
function plotFirstSlot(object $test): void
{
    $gradeId = DB::table('grade_levels')->where('grade', 7)->value('id');
    $teacherId = DB::table('teachers')->insertGetId(['first_name' => 'A', 'last_name' => 'B']);
    $sectionId = DB::table('sections')->insertGetId([
        'school_year_id' => $test->yearId, 'grade_level_id' => $gradeId, 'name' => 'Honesty',
    ]);
    $subjectId = DB::table('subjects')->insertGetId([
        'school_year_id' => $test->yearId, 'grade_level_id' => $gradeId, 'name' => 'Math 7', 'minutes_per_week' => 225,
    ]);
    $loadingId = DB::table('section_subjects')->insertGetId([
        'term_id' => $test->termId, 'section_id' => $sectionId, 'subject_id' => $subjectId, 'teacher_id' => $teacherId,
    ]);
    DB::table('schedule_entries')->insert([
        'term_id' => $test->termId, 'section_id' => $sectionId, 'section_subject_id' => $loadingId,
        'teacher_id' => $teacherId, 'created_by' => $test->admin->id,
        'day_of_week' => 1, 'start_time' => '07:00', 'end_time' => '07:45',
    ]);
}

it('keeps bell schedules to the Admin', function () {
    $this->actingAs(User::factory()->create()->assignRole('glc'));

    $this->getJson("/api/school-years/{$this->yearId}/day-patterns")->assertForbidden();
    $this->postJson("/api/school-years/{$this->yearId}/day-patterns", pattern())->assertForbidden();
    $this->putJson("/api/day-patterns/{$this->patternId}", pattern())->assertForbidden();
    $this->deleteJson("/api/day-patterns/{$this->patternId}")->assertForbidden();
    $this->postJson("/api/day-patterns/{$this->patternId}/copy", pattern())->assertForbidden();
    $this->postJson("/api/day-patterns/{$this->patternId}/slots", period())->assertForbidden();
    $this->putJson("/api/time-slots/{$this->firstSlotId}", period())->assertForbidden();
    $this->deleteJson("/api/time-slots/{$this->firstSlotId}")->assertForbidden();
});

it('lists bell schedules with their periods, minutes and days', function () {
    $this->getJson("/api/school-years/{$this->yearId}/day-patterns")
        ->assertOk()
        ->assertJsonPath('data.0.name', 'Monday – Thursday')
        ->assertJsonPath('data.0.days', [1, 2, 3, 4])
        ->assertJsonPath('data.0.locked_reason', null)
        ->assertJsonPath('data.0.slots.0.start_time', '07:00')
        ->assertJsonPath('data.0.slots.0.minutes', 45);
});

it('creates a bell schedule and sorts its days', function () {
    $this->postJson("/api/school-years/{$this->yearId}/day-patterns", pattern(['shift' => 'AM', 'days' => [3, 1]]))
        ->assertCreated()
        ->assertJsonPath('data.days', [1, 3]);

    expect(DB::table('audit_logs')->where('table_name', 'day_patterns')->where('action', 'create')->exists())->toBeTrue();
});

it('rejects bad bell schedules', function (array $overrides, string $field) {
    $this->postJson("/api/school-years/{$this->yearId}/day-patterns", pattern($overrides))
        ->assertUnprocessable()
        ->assertJsonValidationErrors($field);
})->with([
    'no days' => [['days' => []], 'days'],
    'day outside Monday to Friday' => [['days' => [6]], 'days.0'],
    'day repeated' => [['days' => [5, 5]], 'days.0'],
    'day already taken' => [['days' => [4, 5]], 'days'],
    'name already taken' => [['name' => 'monday – thursday'], 'name'],
    'no name' => [['name' => ''], 'name'],
    'unknown level' => [['level' => 'College'], 'level'],
    'unknown shift' => [['shift' => 'NIGHT'], 'shift'],
]);

it('allows the same day on another level or shift', function () {
    $this->postJson("/api/school-years/{$this->yearId}/day-patterns", pattern(['days' => [1], 'shift' => 'AM']))->assertCreated();
    $this->postJson("/api/school-years/{$this->yearId}/day-patterns", pattern(['days' => [1], 'level' => 'SHS']))->assertCreated();
});

it('renames and changes days without tripping over its own days', function () {
    $this->putJson("/api/day-patterns/{$this->patternId}", ['name' => 'Mon to Fri', 'days' => [1, 2, 3, 4, 5]])
        ->assertOk()
        ->assertJsonPath('data.name', 'Mon to Fri')
        ->assertJsonPath('data.days', [1, 2, 3, 4, 5]);
});

it('copies a bell schedule with its periods and breaks to another shift', function () {
    DB::table('time_slots')->insert([
        'day_pattern_id' => $this->patternId, 'label' => 'Recess', 'start_time' => '07:45', 'end_time' => '08:05', 'is_break' => true,
    ]);

    $this->postJson("/api/day-patterns/{$this->patternId}/copy", pattern(['shift' => 'AM', 'name' => 'Monday – Thursday', 'days' => [1, 2, 3, 4]]))
        ->assertCreated()
        ->assertJsonPath('data.shift', 'AM')
        ->assertJsonCount(2, 'data.slots')
        ->assertJsonPath('data.slots.1.label', 'Recess');

    expect(DB::table('time_slots')->where('day_pattern_id', $this->patternId)->count())->toBe(2);
});

it('blocks a copy onto days already taken in that level and shift', function () {
    $this->postJson("/api/day-patterns/{$this->patternId}/copy", pattern(['name' => 'Copy', 'days' => [1]]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('days');
});

it('deletes an unused bell schedule with its slots', function () {
    $this->deleteJson("/api/day-patterns/{$this->patternId}")->assertOk();

    expect(DB::table('day_patterns')->count())->toBe(0)
        ->and(DB::table('time_slots')->count())->toBe(0);
});

it('adds a period back-to-back and numbers periods by the order of the day', function () {
    $this->postJson("/api/day-patterns/{$this->patternId}/slots", period(['start_time' => '07:45', 'end_time' => '08:30']))
        ->assertCreated()
        ->assertJsonPath('data.slots.1.period_no', 2);

    // An earlier period pushes the others down.
    $this->postJson("/api/day-patterns/{$this->patternId}/slots", period(['start_time' => '06:15', 'end_time' => '07:00']))
        ->assertCreated()
        ->assertJsonPath('data.slots.0.period_no', 1)
        ->assertJsonPath('data.slots.0.start_time', '06:15')
        ->assertJsonPath('data.slots.1.period_no', 2)
        ->assertJsonPath('data.slots.2.period_no', 3);
});

it('keeps breaks out of the numbering', function () {
    $this->postJson("/api/day-patterns/{$this->patternId}/slots", period(['is_break' => true, 'label' => 'Recess', 'start_time' => '07:45', 'end_time' => '08:05']))
        ->assertCreated()
        ->assertJsonPath('data.slots.1.period_no', null);

    $this->postJson("/api/day-patterns/{$this->patternId}/slots", period(['start_time' => '08:05', 'end_time' => '08:50']))
        ->assertCreated()
        ->assertJsonPath('data.slots.2.period_no', 2);
});

it('rejects bad time slots', function (array $overrides, string $field) {
    $this->postJson("/api/day-patterns/{$this->patternId}/slots", period($overrides))
        ->assertUnprocessable()
        ->assertJsonValidationErrors($field);
})->with([
    'overlaps another slot' => [['start_time' => '07:30', 'end_time' => '08:15'], 'start_time'],
    'ends before it starts' => [['start_time' => '09:00', 'end_time' => '08:00'], 'end_time'],
    'zero minutes' => [['start_time' => '09:00', 'end_time' => '09:00'], 'end_time'],
    'wrong time format' => [['start_time' => '8 AM'], 'start_time'],
    'break without a name' => [['is_break' => true, 'label' => ''], 'label'],
]);

it('names the slot it overlaps', function () {
    $this->postJson("/api/day-patterns/{$this->patternId}/slots", period(['start_time' => '07:30', 'end_time' => '08:15']))
        ->assertJsonValidationErrors(['start_time' => 'Period 1 (7:00 AM – 7:45 AM)']);
});

it('updates a slot without tripping over itself', function () {
    $this->putJson("/api/time-slots/{$this->firstSlotId}", period(['start_time' => '07:10', 'end_time' => '07:50']))
        ->assertOk()
        ->assertJsonPath('data.slots.0.start_time', '07:10')
        ->assertJsonPath('data.slots.0.minutes', 40);
});

it('renumbers after a period becomes a break or is deleted', function () {
    $second = DB::table('time_slots')->insertGetId([
        'day_pattern_id' => $this->patternId, 'period_no' => 2, 'start_time' => '08:00', 'end_time' => '08:45',
    ]);

    $this->putJson("/api/time-slots/{$this->firstSlotId}", period(['is_break' => true, 'label' => 'Flag ceremony', 'start_time' => '07:00', 'end_time' => '07:45']))
        ->assertOk()
        ->assertJsonPath('data.slots.0.period_no', null)
        ->assertJsonPath('data.slots.1.period_no', 1);

    $this->deleteJson("/api/time-slots/{$this->firstSlotId}")->assertOk();

    expect(DB::table('time_slots')->where('id', $second)->value('period_no'))->toBe(1);
});

describe('once a section has schedules on it', function () {
    beforeEach(fn () => plotFirstSlot($this));

    it('tells the screen what is locked and why', function () {
        DB::table('time_slots')->insert([
            'day_pattern_id' => $this->patternId, 'period_no' => 2, 'start_time' => '08:00', 'end_time' => '08:45',
        ]);

        $this->getJson("/api/school-years/{$this->yearId}/day-patterns")
            ->assertJsonPath('data.0.locked_reason', 'These sections have schedules on it: Grade 7 Honesty.')
            ->assertJsonPath('data.0.slots.0.locked_reason', 'These sections have schedules on it: Grade 7 Honesty.')
            ->assertJsonPath('data.0.slots.1.locked_reason', null);
    });

    it('blocks deleting the bell schedule or slot', function () {
        $this->deleteJson("/api/day-patterns/{$this->patternId}")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['pattern' => 'Grade 7 Honesty']);
        $this->deleteJson("/api/time-slots/{$this->firstSlotId}")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['slot' => 'Grade 7 Honesty']);

        expect(DB::table('time_slots')->count())->toBe(1);
    });

    it('blocks changing the times or type of the slot', function () {
        $this->putJson("/api/time-slots/{$this->firstSlotId}", period(['start_time' => '07:10', 'end_time' => '07:45']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['start_time' => 'Grade 7 Honesty']);
        $this->putJson("/api/time-slots/{$this->firstSlotId}", period(['is_break' => true, 'label' => 'Recess', 'start_time' => '07:00', 'end_time' => '07:45']))
            ->assertUnprocessable();
    });

    it('still allows renaming the slot', function () {
        $this->putJson("/api/time-slots/{$this->firstSlotId}", period(['label' => 'HGP', 'start_time' => '07:00', 'end_time' => '07:45']))
            ->assertOk()
            ->assertJsonPath('data.slots.0.label', 'HGP');
    });

    it('blocks removing a day that has schedules but allows the other days', function () {
        $this->putJson("/api/day-patterns/{$this->patternId}", ['name' => 'Tue to Thu', 'days' => [2, 3, 4]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['days' => 'Grade 7 Honesty']);

        $this->putJson("/api/day-patterns/{$this->patternId}", ['name' => 'Mon to Wed', 'days' => [1, 2, 3]])
            ->assertOk();
    });

    it('still allows adding a new slot', function () {
        $this->postJson("/api/day-patterns/{$this->patternId}/slots", period())->assertCreated();
    });

    it('does not lock a bell schedule of another shift', function () {
        $otherPattern = DB::table('day_patterns')->insertGetId([
            'school_year_id' => $this->yearId, 'level' => 'JHS', 'shift' => 'AM', 'name' => 'Monday', 'days' => '{1}',
        ]);

        $this->deleteJson("/api/day-patterns/{$otherPattern}")->assertOk();
    });
});
