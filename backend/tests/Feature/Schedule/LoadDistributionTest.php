<?php

use App\Models\SectionSubject;
use App\Models\Teacher;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Support\Facades\DB;

/*
 * Load Distribution: hours per week from the teacher loading, against each teacher's limit.
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

it('counts the hours a week of each teacher from the loading, plotted or not', function () {
    $row = loadRow($this, $this->mathTeacher);

    expect($row['hours_per_week'])->toBe(13.3)
        ->and($row['max_hours'])->toBe(30)
        ->and($row['is_over_hours'])->toBeFalse()
        ->and($row['loads'])->toHaveCount(2)
        ->and($row['loads'][0])->toMatchArray(['section' => 'Grade 7 – Sample A', 'subject' => 'Enhanced Mathematics', 'hours_per_week' => 6.7]);
});

it('flags a teacher over their own limit', function () {
    Teacher::whereKey($this->mathTeacher)->update(['max_hours_per_week' => 12]);

    $response = $this->getJson("/api/terms/{$this->termId}/reports/teacher-load")->assertOk();

    expect(collect($response->json('data.teachers'))->firstWhere('id', $this->mathTeacher)['is_over_hours'])->toBeTrue()
        ->and($response->json('data.summary.over_hours'))->toBe(1);
});

it('starts every teacher at 30 hours, and keeps the limit sensible', function () {
    $teacher = Teacher::create(['first_name' => 'New', 'last_name' => 'Teacher'])->refresh();

    expect($teacher->max_hours_per_week)->toBe(30)
        ->and(fn () => $teacher->update(['max_hours_per_week' => 0]))->toThrow(Illuminate\Database\QueryException::class);
});
