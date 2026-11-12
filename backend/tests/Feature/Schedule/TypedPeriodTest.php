<?php

use App\Models\SchoolTerm;
use App\Models\Section;
use App\Models\SectionSubject;
use App\Models\TimeSlot;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Support\Facades\DB;

/*
 * Building a schedule by hand from the start: a typed time uses a period of the bell schedule,
 * or becomes one.
 */

beforeEach(function () {
    $this->withHeader('Referer', 'http://localhost:5173');
    $this->seed(DatabaseSeeder::class);
    $this->term = SchoolTerm::where('is_active', true)->first();
    $grade11 = DB::table('grade_levels')->where('grade', 11)->value('id');
    DB::table('day_patterns')->where('school_year_id', $this->term->school_year_id)->where('level', 'SHS')->delete();

    $this->stem = Section::create(['school_year_id' => $this->term->school_year_id, 'grade_level_id' => $grade11, 'name' => 'STEM 11-1']);
    $this->master = User::factory()->create()->assignRole('master_teacher');
    $this->master->gradeLevels()->sync([$grade11]);
    $this->url = "/api/terms/{$this->term->id}/sections/{$this->stem->id}/periods";
});

it('starts a bell schedule from the first typed time, and reuses a matching period', function () {
    $this->actingAs($this->master);

    $first = $this->postJson($this->url, ['days' => [1], 'start_time' => '06:00', 'end_time' => '08:00'])->assertOk();
    $slotId = $first->json('data.slots.1');

    $pattern = DB::table('day_patterns')->where('school_year_id', $this->term->school_year_id)->where('level', 'SHS')->first();
    expect($pattern->name)->toBe('Monday – Friday')
        ->and(TimeSlot::find($slotId)->period_no)->toBe(1);

    $again = $this->postJson($this->url, ['days' => [1, 3], 'start_time' => '06:00', 'end_time' => '08:00'])->assertOk();
    expect($again->json('data.slots'))->toBe(['1' => $slotId, '3' => $slotId])
        ->and(TimeSlot::where('day_pattern_id', $pattern->id)->count())->toBe(1);
});

it('refuses a time that overlaps a period or a break, and says which', function () {
    $this->actingAs($this->master);
    $this->postJson($this->url, ['days' => [1], 'start_time' => '06:00', 'end_time' => '08:00'])->assertOk();
    $this->postJson($this->url, ['days' => [1], 'start_time' => '10:00', 'end_time' => '10:30', 'is_break' => true, 'label' => 'Recess'])->assertOk();

    $this->postJson($this->url, ['days' => [2], 'start_time' => '07:00', 'end_time' => '09:00'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['start_time' => 'Period 1 (6:00 AM – 8:00 AM)']);
    $this->postJson($this->url, ['days' => [2], 'start_time' => '10:15', 'end_time' => '11:00'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['start_time' => 'Recess']);
});

it('places a class in a typed time with the usual place request', function () {
    $this->actingAs($this->master);
    $teacher = DB::table('teachers')->insertGetId(['first_name' => 'Juan', 'last_name' => 'Reyes']);
    $subject = DB::table('subjects')->insertGetId(['school_year_id' => $this->term->school_year_id, 'grade_level_id' => $this->stem->grade_level_id, 'name' => 'Gen Bio', 'minutes_per_week' => 120]);
    $loading = SectionSubject::create(['term_id' => $this->term->id, 'section_id' => $this->stem->id, 'subject_id' => $subject, 'teacher_id' => $teacher]);
    $room = DB::table('rooms')->value('id');

    $slotId = $this->postJson($this->url, ['days' => [2], 'start_time' => '13:00', 'end_time' => '15:00'])->json('data.slots.2');
    $this->putJson("/api/terms/{$this->term->id}/sections/{$this->stem->id}/slots/{$slotId}", ['section_subject_id' => $loading->id, 'room_id' => $room, 'days' => [2]])->assertOk();

    expect(DB::table('schedule_entries')->where('section_id', $this->stem->id)->where('day_of_week', 2)->value('start_time'))->toStartWith('13:00');
});

it('gives a day with no bell schedule its own, next to the others', function () {
    $this->actingAs($this->master);
    $pattern = DB::table('day_patterns')->insertGetId(['school_year_id' => $this->term->school_year_id, 'level' => 'SHS', 'shift' => 'WHOLE_DAY', 'name' => 'Monday – Thursday', 'days' => '{1,2,3,4}']);

    $this->postJson($this->url, ['days' => [5], 'start_time' => '07:00', 'end_time' => '08:00'])->assertOk();

    expect(DB::table('day_patterns')->where('level', 'SHS')->where('school_year_id', $this->term->school_year_id)->orderBy('id')->pluck('name')->all())
        ->toBe(['Monday – Thursday', 'Friday'])
        ->and(TimeSlot::where('day_pattern_id', $pattern)->count())->toBe(0);
});

it('is not for a Chairperson of the other department', function () {
    $chair = User::where('email', 'glc@deped.gov.ph')->first();
    $this->actingAs($chair);

    $this->postJson($this->url, ['days' => [1], 'start_time' => '06:00', 'end_time' => '08:00'])->assertForbidden();
});
