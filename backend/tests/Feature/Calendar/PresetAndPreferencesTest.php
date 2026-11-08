<?php

use App\Models\TimeSlot;
use App\Models\User;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    $this->withHeader('Referer', 'http://localhost:5173');
    $this->seed(ReferenceDataSeeder::class);

    $this->yearId = DB::table('school_years')->insertGetId([
        'name' => '2026-2027', 'start_date' => '2026-06-01', 'end_date' => '2027-03-31',
    ]);
    $this->patternId = DB::table('day_patterns')->insertGetId([
        'school_year_id' => $this->yearId, 'level' => 'JHS', 'shift' => 'WHOLE_DAY',
        'name' => 'Monday – Thursday', 'days' => '{1,2,3,4}',
    ]);
});

/** Ten rows, as the preset makes them: eight 45-minute periods, a recess and a lunch. */
function tenRows(): array
{
    $rows = [];
    $time = strtotime('07:30');
    foreach ([['p'], ['p'], ['p'], ['b', 'Recess', 15], ['p'], ['p'], ['b', 'Lunch', 90], ['p'], ['p'], ['p']] as $row) {
        $minutes = $row[0] === 'p' ? 45 : $row[2];
        $rows[] = [
            'is_break' => $row[0] === 'b',
            'label' => $row[1] ?? null,
            'start_time' => date('H:i', $time),
            'end_time' => date('H:i', $time + $minutes * 60),
        ];
        $time += $minutes * 60;
    }

    return $rows;
}

describe('bell schedule presets', function () {
    beforeEach(function () {
        $this->actingAs(User::factory()->create()->assignRole('super_admin'));
    });

    it('fills an empty bell schedule at once, numbering the periods', function () {
        $this->postJson("/api/day-patterns/{$this->patternId}/slots/preset", ['slots' => tenRows()])->assertCreated();

        $slots = TimeSlot::where('day_pattern_id', $this->patternId)->orderBy('start_time')->get();

        expect($slots)->toHaveCount(10)
            ->and($slots->whereNotNull('period_no')->pluck('period_no')->values()->all())->toBe([1, 2, 3, 4, 5, 6, 7, 8])
            ->and($slots[3]->label)->toBe('Recess')
            ->and($slots->last()->end_time)->toBe('15:15:00');
    });

    it('is only for an empty bell schedule', function () {
        DB::table('time_slots')->insert(['day_pattern_id' => $this->patternId, 'period_no' => 1, 'start_time' => '07:00', 'end_time' => '07:45']);

        $this->postJson("/api/day-patterns/{$this->patternId}/slots/preset", ['slots' => tenRows()])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('slots');
    });

    it('refuses rows that overlap or have an unnamed break, and saves none', function () {
        $rows = tenRows();
        $rows[2]['start_time'] = '08:00';
        $rows[3]['label'] = null;

        $this->postJson("/api/day-patterns/{$this->patternId}/slots/preset", ['slots' => $rows])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['slots.2.start_time', 'slots.3.label']);

        expect(TimeSlot::where('day_pattern_id', $this->patternId)->count())->toBe(0);
    });

    it('is for the Admin only', function () {
        $this->actingAs(User::factory()->create()->assignRole('glc'));

        $this->postJson("/api/day-patterns/{$this->patternId}/slots/preset", ['slots' => tenRows()])->assertForbidden();
    });
});

describe('color coding', function () {
    it('is on until the user turns it off, and stays off on any device', function () {
        $user = User::factory()->create()->assignRole('glc');
        $this->actingAs($user);

        $this->getJson('/api/me')->assertOk()->assertJsonPath('data.preferences.color_coding', true);

        $this->putJson('/api/me/preferences', ['color_coding' => false])
            ->assertOk()
            ->assertJsonPath('data.preferences.color_coding', false);

        expect($user->fresh()->preferences)->toBe(['color_coding' => false]);
    });

    it('accepts only yes or no', function () {
        $this->actingAs(User::factory()->create()->assignRole('teacher'));

        $this->putJson('/api/me/preferences', ['color_coding' => 'blue'])->assertUnprocessable();
    });
});
