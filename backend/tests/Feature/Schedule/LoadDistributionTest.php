<?php

use App\Models\SectionSubject;
use App\Models\Teacher;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Support\Facades\DB;

/*
 * Load Distribution: hours per week from the teacher loading (shown, not typed), and the limit of
 * 5 subjects a term. The typed "most hours a week" is gone (beneficiary review, Nov 21, 2026).
 */

beforeEach(function () {
    $this->withHeader('Referer', 'http://localhost:5173');
    $this->seed(DatabaseSeeder::class);
    $this->actingAs(User::where('email', 'glc@deped.gov.ph')->first());
    $this->termId = DB::table('school_terms')->where('is_active', true)->value('id');

    // The Math teacher has Enhanced Mathematics (400 mins a week) in both sections.
    $this->mathTeacher = SectionSubject::whereHas('subject', fn ($query) => $query->where('name', 'Enhanced Mathematics'))
        ->value('teacher_id');
});

function loadRow(object $test, int $teacherId): array
{
    return collect($test->getJson("/api/terms/{$test->termId}/reports/teacher-load")->assertOk()->json('data.teachers'))
        ->firstWhere('id', $teacherId);
}

it('counts the hours a week of each teacher from the schedule (minutes are not typed)', function () {
    expect(loadRow($this, $this->mathTeacher)['hours_per_week'])->toEqual(0);

    $loading = SectionSubject::with('section')->where('teacher_id', $this->mathTeacher)->orderBy('id')->first();
    \App\Models\ScheduleEntry::create([
        'term_id' => $this->termId, 'section_id' => $loading->section_id, 'section_subject_id' => $loading->id,
        'teacher_id' => $this->mathTeacher, 'room_id' => $loading->section->home_room_id, 'day_of_week' => 1,
        'start_time' => '07:00', 'end_time' => '08:20', 'created_by' => User::first()->id,
    ]);
    $row = loadRow($this, $this->mathTeacher);

    expect($row['hours_per_week'])->toBe(1.3)
        ->and($row)->not->toHaveKeys(['max_hours', 'is_over_hours'])
        ->and($row['is_overloaded'])->toBeFalse()
        ->and($row['loads'])->toHaveCount(2)
        ->and($row['loads'][0])->toMatchArray(['section' => 'Grade 7 – Sample A', 'subject' => 'Enhanced Mathematics']);
});

it('counts the subjects against the limit of 5', function () {
    $response = $this->getJson("/api/terms/{$this->termId}/reports/teacher-load")->assertOk();
    $row = collect($response->json('data.teachers'))->firstWhere('id', $this->mathTeacher);

    expect($row['limit'])->toBe(5)
        ->and($row['assigned'])->toBe(2)
        ->and($response->json('data.summary'))->not->toHaveKey('over_hours');
});
