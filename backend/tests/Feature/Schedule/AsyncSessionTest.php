<?php

use App\Models\SchoolTerm;
use App\Models\Section;
use App\Models\SectionSubject;
use App\Models\User;
use App\Services\ReportService;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Support\Facades\DB;

/*
 * Asynchronous sessions (Senior High, Nov 21, 2026): a period of the class hours marked
 * asynchronous takes classes with a subject and teacher but no room, so it never blocks a room.
 */

beforeEach(function () {
    $this->withHeader('Referer', 'http://localhost:5173');
    $this->seed(DatabaseSeeder::class);
    $this->term = SchoolTerm::where('is_active', true)->first();
    $grade11 = DB::table('grade_levels')->where('grade', 11)->value('id');
    DB::table('day_patterns')->where('school_year_id', $this->term->school_year_id)->where('level', 'SHS')->delete();

    $this->master = User::factory()->create()->assignRole('master_teacher');
    $this->master->gradeLevels()->sync([$grade11]);
    $this->actingAs($this->master);

    $this->stem = Section::create(['school_year_id' => $this->term->school_year_id, 'grade_level_id' => $grade11, 'name' => 'STEM 11-1']);
    $this->abm = Section::create(['school_year_id' => $this->term->school_year_id, 'grade_level_id' => $grade11, 'name' => 'ABM 11-1']);
    $this->pattern = DB::table('day_patterns')->insertGetId([
        'school_year_id' => $this->term->school_year_id, 'level' => 'SHS', 'shift' => 'WHOLE_DAY', 'name' => 'Monday – Friday', 'days' => '{1,2,3,4,5}',
    ]);
    $this->class = DB::table('time_slots')->insertGetId(['day_pattern_id' => $this->pattern, 'period_no' => 1, 'start_time' => '10:00', 'end_time' => '12:00']);
    $this->async = DB::table('time_slots')->insertGetId(['day_pattern_id' => $this->pattern, 'period_no' => 2, 'start_time' => '13:20', 'end_time' => '14:50', 'is_async' => true]);

    $subject = DB::table('subjects')->insertGetId(['school_year_id' => $this->term->school_year_id, 'name' => 'General Science']);
    $this->juan = DB::table('teachers')->insertGetId(['first_name' => 'Juan', 'last_name' => 'Reyes']);
    $this->ana = DB::table('teachers')->insertGetId(['first_name' => 'Ana', 'last_name' => 'Cruz']);
    $this->stemLoading = SectionSubject::create(['term_id' => $this->term->id, 'section_id' => $this->stem->id, 'subject_id' => $subject, 'teacher_id' => $this->juan]);
    $this->abmLoading = SectionSubject::create(['term_id' => $this->term->id, 'section_id' => $this->abm->id, 'subject_id' => $subject, 'teacher_id' => $this->ana]);
    $this->room = DB::table('rooms')->value('id');
});

function placeIn(object $test, Section $section, int $slotId, array $body)
{
    return $test->putJson("/api/terms/{$test->term->id}/sections/{$section->id}/slots/{$slotId}", ['days' => [1], ...$body]);
}

it('places a class in an asynchronous period with no room, and keeps no room on it', function () {
    placeIn($this, $this->stem, $this->async, ['section_subject_id' => $this->stemLoading->id])->assertOk()
        ->assertJsonPath('data.entries.0.room', 'Asynchronous')
        ->assertJsonPath('data.entries.0.is_async', true);

    // Even when a room is sent, an asynchronous class keeps none.
    placeIn($this, $this->abm, $this->async, ['section_subject_id' => $this->abmLoading->id, 'room_id' => $this->room])->assertOk();

    expect(DB::table('schedule_entries')->whereNotNull('room_id')->count())->toBe(0)
        ->and(DB::table('schedule_entries')->where('is_async', true)->count())->toBe(2);
});

it('still needs a room for a usual period', function () {
    placeIn($this, $this->stem, $this->class, ['section_subject_id' => $this->stemLoading->id])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('room_id');
});

it('still blocks the same teacher at the same time', function () {
    placeIn($this, $this->stem, $this->async, ['section_subject_id' => $this->stemLoading->id])->assertOk();
    DB::table('section_subjects')->where('id', $this->abmLoading->id)->update(['teacher_id' => $this->juan]);

    placeIn($this, $this->abm, $this->async, ['section_subject_id' => $this->abmLoading->id])->assertUnprocessable();
});

it('is not flagged for having no room, and prints under an ASYNCHRONOUS SESSION banner', function () {
    placeIn($this, $this->stem, $this->async, ['section_subject_id' => $this->stemLoading->id])->assertOk();

    $flags = collect($this->getJson("/api/terms/{$this->term->id}/sections/{$this->stem->id}/plotter")->json('data.flags'))->pluck('type');
    expect($flags)->not->toContain('no_room');

    $data = app(ReportService::class)->classProgramData($this->term, $this->stem->fresh());
    $rows = collect($data['weekly']['rows']);
    expect($rows->firstWhere('async_banner', true)['time'])->toContain('1:20')
        ->and($rows->where('async_banner', true))->toHaveCount(1)
        ->and($rows->firstWhere('async_banner', true)['cells'][1]['room'])->toBe('Asynchronous');
});

it('marks a period asynchronous only for Senior High, and never a break', function () {
    $this->actingAs(User::factory()->create()->assignRole('super_admin'));
    $jhs = DB::table('day_patterns')->where('school_year_id', $this->term->school_year_id)->where('level', 'JHS')->value('id');

    $this->postJson("/api/day-patterns/{$this->pattern}/slots", ['is_break' => false, 'is_async' => true, 'start_time' => '15:00', 'end_time' => '16:00'])->assertCreated();
    $this->postJson("/api/day-patterns/{$jhs}/slots", ['is_break' => false, 'is_async' => true, 'start_time' => '17:00', 'end_time' => '17:30'])
        ->assertUnprocessable()->assertJsonValidationErrors(['is_async' => 'Senior High only']);
    $this->postJson("/api/day-patterns/{$this->pattern}/slots", ['is_break' => true, 'label' => 'Break', 'is_async' => true, 'start_time' => '16:00', 'end_time' => '16:20'])
        ->assertUnprocessable()->assertJsonValidationErrors(['is_async' => 'only a period can']);
});
