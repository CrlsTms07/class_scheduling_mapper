<?php

use App\Models\User;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Support\Facades\DB;

function validationGrade(int $grade): int
{
    return DB::table('grade_levels')->where('grade', $grade)->value('id');
}

function validationEntry(object $test, int $sectionId, int $loadingId, int $teacherId, string $status, int $roomId): void
{
    DB::table('schedule_entries')->insert([
        'term_id' => $test->termId, 'section_id' => $sectionId, 'section_subject_id' => $loadingId, 'teacher_id' => $teacherId,
        'room_id' => $roomId, 'created_by' => $test->glc->id, 'status' => $status,
        'day_of_week' => 1, 'start_time' => '07:00', 'end_time' => '07:45',
    ]);
}

function validationLoading(object $test, int $sectionId, int $teacherId, string $subject): int
{
    $subjectId = DB::table('subjects')->insertGetId([
        'school_year_id' => $test->yearId, 'grade_level_id' => validationGrade(7), 'name' => $subject, 'minutes_per_week' => 225,
    ]);

    return DB::table('section_subjects')->insertGetId([
        'term_id' => $test->termId, 'section_id' => $sectionId, 'subject_id' => $subjectId, 'teacher_id' => $teacherId,
    ]);
}

beforeEach(function () {
    $this->withHeader('Referer', 'http://localhost:5173');
    $this->seed(ReferenceDataSeeder::class);

    $this->yearId = DB::table('school_years')->insertGetId([
        'name' => '2026-2027', 'start_date' => '2026-06-01', 'end_date' => '2027-03-31',
    ]);
    $this->termId = DB::table('school_terms')->insertGetId([
        'school_year_id' => $this->yearId, 'term_no' => 1, 'name' => 'First',
        'start_date' => '2026-06-01', 'end_date' => '2026-09-30', 'is_active' => true,
    ]);
    $patternId = DB::table('day_patterns')->insertGetId([
        'school_year_id' => $this->yearId, 'level' => 'JHS', 'shift' => 'WHOLE_DAY', 'name' => 'Monday – Friday', 'days' => '{1,2,3,4,5}',
    ]);
    DB::table('time_slots')->insert([
        'day_pattern_id' => $patternId, 'period_no' => 1, 'label' => null, 'start_time' => '07:00', 'end_time' => '07:45', 'is_break' => false,
    ]);

    $this->teacherId = DB::table('teachers')->insertGetId(['first_name' => 'Ana', 'last_name' => 'Reyes']);
    $this->adviserId = DB::table('teachers')->insertGetId(['first_name' => 'Ben', 'last_name' => 'Cruz']);
    $buildingId = DB::table('buildings')->insertGetId(['name' => 'Main']);
    $this->roomId = DB::table('rooms')->insertGetId(['building_id' => $buildingId, 'room_number' => '101']);
    $this->otherRoom = DB::table('rooms')->insertGetId(['building_id' => $buildingId, 'room_number' => '102']);

    $this->glc = User::factory()->create()->assignRole('glc');
    $this->glc->gradeLevels()->attach(validationGrade(7));

    $this->sectionId = DB::table('sections')->insertGetId([
        'school_year_id' => $this->yearId, 'grade_level_id' => validationGrade(7), 'name' => 'Honesty', 'adviser_id' => $this->adviserId,
    ]);
    $this->url = "/api/terms/{$this->termId}/reports/validation";
    $this->actingAs($this->glc);
});

it('lists the issues of each section, with the summary', function () {
    $loading = validationLoading($this, $this->sectionId, $this->teacherId, 'Math 7');
    validationEntry($this, $this->sectionId, $loading, $this->teacherId, 'draft', $this->roomId);
    DB::table('sections')->insert(['school_year_id' => $this->yearId, 'grade_level_id' => validationGrade(7), 'name' => 'Hope']);

    $this->getJson($this->url)
        ->assertOk()
        ->assertJsonPath('data.summary.sections', 2)
        ->assertJsonPath('data.summary.sections_with_issues', 2)
        ->assertJsonPath('data.summary.issues', 2)
        ->assertJsonPath('data.summary.not_acknowledged', 2)
        ->assertJsonPath('data.sections.0.label', 'Grade 7 – Honesty')
        ->assertJsonPath('data.sections.0.status_label', 'Draft')
        ->assertJsonPath('data.sections.0.issues.0.message', 'Math 7: 45 of 225 minutes scheduled.')
        ->assertJsonPath('data.sections.0.issues.0.level', 'To check')
        ->assertJsonPath('data.sections.1.issues.0.message', 'This section has no adviser.');
});

it('marks open slots as must fix, and leaves out sections with nothing wrong', function () {
    DB::table('schedule_entries')->insert([
        'term_id' => $this->termId, 'section_id' => $this->sectionId, 'room_id' => $this->roomId, 'created_by' => $this->glc->id,
        'status' => 'draft', 'day_of_week' => 1, 'start_time' => '07:00', 'end_time' => '07:45',
    ]);
    DB::table('sections')->insert([
        'school_year_id' => $this->yearId, 'grade_level_id' => validationGrade(7), 'name' => 'Clear', 'adviser_id' => $this->teacherId,
    ]);

    $this->getJson($this->url)
        ->assertJsonPath('data.summary.sections', 2)
        ->assertJsonPath('data.summary.sections_with_issues', 1)
        ->assertJsonPath('data.summary.urgent', 1)
        ->assertJsonCount(1, 'data.sections')
        ->assertJsonPath('data.sections.0.issues.0.level', 'Must fix');
});

it('shows an acknowledged flag as acknowledged', function () {
    DB::table('sections')->where('id', $this->sectionId)->update(['adviser_id' => null]);
    DB::table('schedule_flag_acknowledgements')->insert([
        'term_id' => $this->termId, 'section_id' => $this->sectionId, 'flag_key' => 'no_adviser', 'acknowledged_by' => $this->glc->id,
    ]);

    $this->getJson($this->url)
        ->assertJsonPath('data.sections.0.issues.0.acknowledged', true)
        ->assertJsonPath('data.summary.not_acknowledged', 0);
});

it('finds a rejected entry whose teacher or room has since been taken', function () {
    $rejected = validationLoading($this, $this->sectionId, $this->teacherId, 'Math 7');
    validationEntry($this, $this->sectionId, $rejected, $this->teacherId, 'rejected', $this->roomId);

    $other = DB::table('sections')->insertGetId([
        'school_year_id' => $this->yearId, 'grade_level_id' => validationGrade(7), 'name' => 'Hope', 'adviser_id' => null,
    ]);
    $taken = validationLoading($this, $other, $this->teacherId, 'Science 7');
    validationEntry($this, $other, $taken, $this->teacherId, 'draft', $this->otherRoom);

    $issues = collect($this->getJson($this->url)->assertOk()->json('data.sections'))
        ->firstWhere('label', 'Grade 7 – Honesty')['issues'];

    expect($issues[0]['level'])->toBe('Conflict')
        ->and($issues[0]['message'])->toContain('Math 7 on Monday at 7:00 AM can no longer return')
        ->and($issues[0]['message'])->toContain('Ana Reyes is teaching Grade 7 – Hope');
});

it('does not report a conflict for a rejected entry that is still free', function () {
    $rejected = validationLoading($this, $this->sectionId, $this->teacherId, 'Math 7');
    validationEntry($this, $this->sectionId, $rejected, $this->teacherId, 'rejected', $this->roomId);

    $issues = collect($this->getJson($this->url)->json('data.sections.0.issues'));

    expect($issues->pluck('level'))->not->toContain('Conflict');
});

it('stays within the grade levels of the user', function () {
    DB::table('sections')->insert(['school_year_id' => $this->yearId, 'grade_level_id' => validationGrade(8), 'name' => 'Other']);
    DB::table('sections')->where('id', $this->sectionId)->update(['adviser_id' => null]);

    $this->getJson($this->url)
        ->assertJsonPath('data.summary.sections', 1)
        ->assertJsonCount(1, 'data.sections')
        ->assertJsonPath('data.sections.0.label', 'Grade 7 – Honesty');
});

it('shows the Admin every grade level', function () {
    DB::table('sections')->insert(['school_year_id' => $this->yearId, 'grade_level_id' => validationGrade(8), 'name' => 'Other']);

    $this->actingAs(User::factory()->create()->assignRole('super_admin'));

    $this->getJson($this->url)->assertJsonPath('data.summary.sections', 2);
});

it('is not for teachers', function () {
    $this->actingAs(User::factory()->create()->assignRole('teacher'));

    $this->getJson($this->url)->assertForbidden();
    $this->getJson("{$this->url}.pdf")->assertForbidden();
    $this->getJson("{$this->url}.xlsx")->assertForbidden();
});

it('downloads as PDF and XLSX, with or without issues', function () {
    $pdf = $this->get("{$this->url}.pdf")->assertOk();
    $xlsx = $this->get("{$this->url}.xlsx")->assertOk();

    expect(substr($pdf->getContent(), 0, 4))->toBe('%PDF')
        ->and(substr($xlsx->getContent(), 0, 2))->toBe('PK')
        ->and($pdf->headers->get('Content-Disposition'))->toContain('validation-report-first');

    DB::table('sections')->where('id', $this->sectionId)->update(['adviser_id' => null]);

    expect(substr($this->get("{$this->url}.pdf")->assertOk()->getContent(), 0, 4))->toBe('%PDF');
    $this->get("{$this->url}.xlsx")->assertOk();
});
