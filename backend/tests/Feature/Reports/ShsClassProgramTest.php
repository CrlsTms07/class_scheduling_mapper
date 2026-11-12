<?php

use App\Models\SchoolTerm;
use App\Models\Section;
use App\Models\User;
use App\Services\ReportService;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\IOFactory;

function shsGrade(int $grade): int
{
    return DB::table('grade_levels')->where('grade', $grade)->value('id');
}

beforeEach(function () {
    $this->withHeader('Referer', 'http://localhost:5173');
    $this->seed(ReferenceDataSeeder::class);

    $this->masterTeacher = User::factory()->create()->assignRole('master_teacher');
    $this->masterTeacher->gradeLevels()->sync([shsGrade(11)]);
    $this->actingAs($this->masterTeacher);

    $this->yearId = DB::table('school_years')->insertGetId([
        'name' => '2026-2027', 'start_date' => '2026-06-01', 'end_date' => '2027-03-31',
    ]);
    $this->termId = DB::table('school_terms')->insertGetId([
        'school_year_id' => $this->yearId, 'term_no' => 1, 'name' => 'First Semester',
        'start_date' => '2026-06-01', 'end_date' => '2026-10-31', 'is_active' => true,
    ]);
    $patternId = DB::table('day_patterns')->insertGetId([
        'school_year_id' => $this->yearId, 'level' => 'SHS', 'shift' => 'WHOLE_DAY',
        'name' => 'Monday – Friday', 'days' => '{1,2,3,4,5}',
    ]);
    DB::table('time_slots')->insert([
        ['day_pattern_id' => $patternId, 'period_no' => 1, 'label' => null, 'start_time' => '06:00', 'end_time' => '08:00', 'is_break' => false],
        ['day_pattern_id' => $patternId, 'period_no' => null, 'label' => 'Break Time', 'start_time' => '08:00', 'end_time' => '08:30', 'is_break' => true],
        ['day_pattern_id' => $patternId, 'period_no' => 2, 'label' => null, 'start_time' => '08:30', 'end_time' => '10:30', 'is_break' => false],
    ]);
    $this->adviserId = DB::table('teachers')->insertGetId(['first_name' => 'Ana', 'last_name' => 'Reyes']);
    $this->sectionId = DB::table('sections')->insertGetId([
        'school_year_id' => $this->yearId, 'grade_level_id' => shsGrade(11), 'name' => 'STEM 11-1', 'adviser_id' => $this->adviserId,
    ]);
    $buildingId = DB::table('buildings')->insertGetId(['name' => 'Main']);
    $this->roomId = DB::table('rooms')->insertGetId(['building_id' => $buildingId, 'room_number' => 'C 401']);
    $this->subjectId = DB::table('subjects')->insertGetId([
        'school_year_id' => $this->yearId, 'grade_level_id' => shsGrade(11), 'name' => 'Gen Bio', 'minutes_per_week' => 240,
    ]);
    $this->loadingId = DB::table('section_subjects')->insertGetId([
        'term_id' => $this->termId, 'section_id' => $this->sectionId, 'subject_id' => $this->subjectId, 'teacher_id' => $this->adviserId,
    ]);
    DB::table('school_profile')->insert(['school_name' => 'My School']);
});

function shsEntry(object $test, int $day, string $start = '06:00', string $end = '08:00', string $status = 'approved'): void
{
    DB::table('schedule_entries')->insert([
        'term_id' => $test->termId, 'section_id' => $test->sectionId, 'section_subject_id' => $test->loadingId,
        'teacher_id' => $test->adviserId, 'room_id' => $test->roomId, 'created_by' => $test->masterTeacher->id,
        'status' => $status, 'day_of_week' => $day, 'start_time' => $start, 'end_time' => $end,
    ]);
}

function shsData(object $test): array
{
    return app(ReportService::class)->classProgramData(SchoolTerm::find($test->termId), Section::find($test->sectionId));
}

it('has one row per period and break, and one column per day', function () {
    shsEntry($this, 1);
    shsEntry($this, 3);

    $weekly = shsData($this)['weekly'];

    expect($weekly['rows'])->toHaveCount(3)
        ->and($weekly['days'][0]['name'])->toBe('Monday')
        ->and($weekly['rows'][0]['time'])->toBe('6:00 - 8:00')
        ->and($weekly['rows'][0]['minutes'])->toBe(120)
        ->and($weekly['rows'][0]['cells'][1]['subject'])->toBe('Gen Bio')
        ->and($weekly['rows'][0]['cells'][1]['teacher'])->toBe('Ana Reyes')
        ->and($weekly['rows'][0]['cells'][1]['room'])->toBe('Main – C 401')
        ->and($weekly['rows'][0]['cells'][2])->toBeNull();
});

it('prints the same break on all days as one wide row', function () {
    expect(shsData($this)['weekly']['rows'][1]['wide_break'])->toBe('BREAK TIME');
});

it('counts breaks in the total of a day with classes, like the official form', function () {
    shsEntry($this, 1);
    shsEntry($this, 1, '08:30', '10:30');
    shsEntry($this, 2);

    $totals = shsData($this)['weekly']['totals'];

    expect($totals[1])->toBe('4 hours 30 minutes')
        ->and($totals[2])->toBe('2 hours 30 minutes')
        ->and($totals[3])->toBe('–');
});

it('handles a day with its own bell schedule', function () {
    DB::table('day_patterns')->update(['days' => '{1,2,3,4}']);
    $friday = DB::table('day_patterns')->insertGetId([
        'school_year_id' => $this->yearId, 'level' => 'SHS', 'shift' => 'WHOLE_DAY', 'name' => 'Friday', 'days' => '{5}',
    ]);
    DB::table('time_slots')->insert([
        'day_pattern_id' => $friday, 'period_no' => 1, 'start_time' => '07:00', 'end_time' => '09:00',
    ]);

    $rows = shsData($this)['weekly']['rows'];

    expect(collect($rows)->pluck('time')->all())->toBe(['6:00 - 8:00', '7:00 - 9:00', '8:00 - 8:30', '8:30 - 10:30'])
        ->and($rows[2]['wide_break'])->toBeNull()
        ->and($rows[2]['breaks'])->toHaveKeys([1, 2, 3, 4]);
});

it('leaves the JHS form alone', function () {
    $section = Section::create([
        'school_year_id' => $this->yearId, 'grade_level_id' => shsGrade(7), 'name' => 'Honesty',
    ]);

    expect(app(ReportService::class)->classProgramData(SchoolTerm::find($this->termId), $section)['weekly'])->toBeNull();
});

it('downloads as a PDF', function () {
    shsEntry($this, 1);

    $response = $this->get("/api/terms/{$this->termId}/sections/{$this->sectionId}/class-program.pdf")->assertOk();

    expect(substr($response->getContent(), 0, 4))->toBe('%PDF')
        ->and($response->headers->get('Content-Disposition'))->toContain('class-program-grade-11-stem-11-1-first-semester.pdf');
});

it('downloads as an XLSX with the same content', function () {
    DB::table('report_settings')->insert([
        'report_type' => 'class_program', 'level' => 'SHS', 'title_format' => '{level} GRADE {grade} - CLASS PROGRAM', 'reference_note' => 'DO 12',
    ]);
    DB::table('report_signatories')->insert([
        'term_id' => $this->termId, 'report_type' => 'class_program', 'level' => 'SHS',
        'label' => 'Prepared by', 'name' => 'Some Name', 'position' => 'Master Teacher I',
    ]);
    shsEntry($this, 1);

    $response = $this->get("/api/terms/{$this->termId}/sections/{$this->sectionId}/class-program.xlsx")->assertOk();

    $path = tempnam(sys_get_temp_dir(), 'shs').'.xlsx';
    file_put_contents($path, $response->getContent());
    $text = collect(IOFactory::load($path)->getActiveSheet()->toArray())->flatten()->filter()->implode(' | ');
    unlink($path);

    expect($text)->toContain('SHS GRADE 11 - CLASS PROGRAM')
        ->and($text)->toContain('First Semester, School Year 2026-2027')
        ->and($text)->toContain('STEM 11-1')
        ->and($text)->toContain('Class Adviser: Ana Reyes')
        ->and($text)->toContain('MONDAY')
        ->and($text)->toContain('Gen Bio')
        ->and($text)->toContain('BREAK TIME')
        ->and($text)->toContain('Total Time Duration')
        ->and($text)->toContain('DO 12')
        ->and($text)->toContain('Prepared by: Some Name, Master Teacher I');
});

it('keeps a Master Teacher to their grade levels', function () {
    $outside = DB::table('sections')->insertGetId([
        'school_year_id' => $this->yearId, 'grade_level_id' => shsGrade(12), 'name' => 'Outside',
    ]);

    $this->get("/api/terms/{$this->termId}/sections/{$outside}/class-program.pdf")->assertForbidden();
    $this->get("/api/terms/{$this->termId}/sections/{$outside}/class-program.xlsx")->assertForbidden();
});
