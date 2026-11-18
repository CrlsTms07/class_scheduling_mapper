<?php

use App\Models\Section;
use App\Models\SectionSubject;
use App\Models\TimeSlot;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Support\Facades\DB;

/*
 * Junior High and Senior High stay apart (team decision, Nov 10, 2026): a Master Teacher
 * does not see Junior High details, and a Chairperson does not see Senior High details.
 */

beforeEach(function () {
    $this->withHeader('Referer', 'http://localhost:5173');
    $this->seed(DatabaseSeeder::class);

    $this->termId = DB::table('school_terms')->where('is_active', true)->value('id');
    $this->sectionA = Section::where('name', 'Sample A')->first();
    $this->room = $this->sectionA->home_room_id;

    // A Grade 7 class in room 101, with the Values Education teacher.
    $values = SectionSubject::where('section_id', $this->sectionA->id)->whereHas('subject', fn ($q) => $q->where('name', 'Values Education'))->first();
    $this->valuesTeacher = $values->teacher_id;
    DB::table('schedule_entries')->insert([
        'term_id' => $this->termId, 'section_id' => $this->sectionA->id, 'section_subject_id' => $values->id,
        'teacher_id' => $values->teacher_id, 'room_id' => $this->room, 'day_of_week' => 1,
        'start_time' => '07:15', 'end_time' => '08:00', 'created_by' => User::first()->id,
    ]);

    $grade11 = DB::table('grade_levels')->where('grade', 11)->value('id');
    $this->master = User::factory()->create()->assignRole('master_teacher');
    $this->master->gradeLevels()->sync([$grade11]);

    $pattern = DB::table('day_patterns')->insertGetId([
        'school_year_id' => $this->sectionA->school_year_id, 'level' => 'SHS', 'shift' => 'WHOLE_DAY', 'name' => 'Monday – Friday', 'days' => '{1,2,3,4,5}',
    ]);
    $this->shsSlot = TimeSlot::create(['day_pattern_id' => $pattern, 'period_no' => 1, 'start_time' => '07:15', 'end_time' => '08:00', 'is_break' => false]);
    $this->stem = Section::create(['school_year_id' => $this->sectionA->school_year_id, 'grade_level_id' => $grade11, 'name' => 'STEM A']);
    $subject = DB::table('subjects')->insertGetId(['school_year_id' => $this->sectionA->school_year_id, 'grade_level_id' => $grade11, 'name' => 'Gen Bio', 'minutes_per_week' => 240]);
    $this->bio = SectionSubject::create(['term_id' => $this->termId, 'section_id' => $this->stem->id, 'subject_id' => $subject, 'teacher_id' => $this->valuesTeacher]);
});

it('names a Junior High class only as Junior High in a Senior High conflict', function () {
    $this->actingAs($this->master);

    $response = $this->putJson("/api/terms/{$this->termId}/sections/{$this->stem->id}/slots/{$this->shsSlot->id}", [
        'section_subject_id' => $this->bio->id, 'room_id' => $this->room, 'days' => [1],
    ])->assertUnprocessable();

    expect(json_encode($response->json('conflicts')))->toContain('a Junior High section')
        ->not->toContain('Sample A')
        ->not->toContain('Values Education');
});

it('shows a room taken by the other department without its details', function () {
    $this->actingAs($this->master);

    $entries = $this->getJson("/api/terms/{$this->termId}/rooms/{$this->room}/schedule")->assertOk()->json('data.entries');

    expect($entries[0]['section'])->toBe('Junior High section')
        ->and($entries[0]['subject'])->toBe('Taken')
        ->and($entries[0]['teacher'])->toBeNull()
        ->and($entries[0]['can_open'])->toBeFalse();
});

it('adds up the other department in room usage', function () {
    $this->actingAs($this->master);

    $rooms = collect($this->getJson("/api/terms/{$this->termId}/reports/room-usage")->assertOk()->json('data.buildings'))->flatMap(fn ($b) => $b['rooms']);

    expect(json_encode($rooms))->toContain('Junior High section')->not->toContain('Sample A');
});

it('lists every teacher, but a teacher of the other department only is view-only', function () {
    $this->actingAs($this->master);
    $onlyJhs = SectionSubject::where('section_id', $this->sectionA->id)->whereHas('subject', fn ($q) => $q->where('name', 'Filipino'))->value('teacher_id');

    $teachers = collect($this->getJson("/api/terms/{$this->termId}/teachers")->assertOk()->json('data'))->keyBy('id');

    expect($teachers[$onlyJhs]['can_edit'])->toBeFalse()
        ->and($teachers[$this->valuesTeacher]['can_edit'])->toBeTrue();

    $this->deleteJson("/api/teachers/{$onlyJhs}")->assertForbidden();
});

it('lets the Admin edit every teacher', function () {
    $this->actingAs(User::where('email', 'admin@deped.gov.ph')->first());

    $teachers = collect($this->getJson("/api/terms/{$this->termId}/teachers")->assertOk()->json('data'));

    expect($teachers->every(fn ($teacher) => $teacher['can_edit']))->toBeTrue();
});

it('keeps everything visible to the Admin', function () {
    $this->actingAs(User::where('email', 'admin@deped.gov.ph')->first());

    expect($this->getJson("/api/terms/{$this->termId}/rooms/{$this->room}/schedule")->json('data.entries.0.section'))->toBe('Grade 7 – Sample A');
});

it('keeps the classes of the department visible to it', function () {
    $this->actingAs(User::where('email', 'glc@deped.gov.ph')->first());

    expect($this->getJson("/api/terms/{$this->termId}/rooms/{$this->room}/schedule")->json('data.entries.0.subject'))->toBe('Values Education');
});

it('lets a Master Teacher give a Junior High teacher a Senior High class, and then edit that teacher', function () {
    $this->actingAs($this->master);
    $juniorTeacher = SectionSubject::where('section_id', $this->sectionA->id)->whereHas('subject', fn ($q) => $q->where('name', 'Filipino'))->value('teacher_id');
    $chem = DB::table('subjects')->insertGetId(['school_year_id' => $this->sectionA->school_year_id, 'grade_level_id' => $this->stem->grade_level_id, 'name' => 'Gen Chem', 'minutes_per_week' => 240]);

    // The teacher list of the loading offers every teacher, the Junior High ones too.
    $this->putJson("/api/terms/{$this->termId}/sections/{$this->stem->id}/loading/{$chem}", ['teacher_id' => $juniorTeacher])->assertOk();

    $teachers = collect($this->getJson("/api/terms/{$this->termId}/teachers")->assertOk()->json('data'))->keyBy('id');
    expect($teachers[$juniorTeacher]['can_edit'])->toBeTrue();

    // Now the Master Teacher keeps the record too: deleting is stopped by the loading, not by the department.
    $this->deleteJson("/api/teachers/{$juniorTeacher}")->assertUnprocessable();
});
