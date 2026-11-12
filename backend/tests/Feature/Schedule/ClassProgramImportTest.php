<?php

use App\Models\SchoolTerm;
use App\Models\Section;
use App\Models\SectionSubject;
use App\Models\TimeSlot;
use App\Models\User;
use App\Services\ClassProgramReader;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

/*
 * The school's own class program workbook: sections side by side, four lines per class.
 */

/** A small workbook in the school's layout: one Grade 11 sheet with two sections. */
function classProgramWorkbook(): string
{
    $book = new Spreadsheet;
    $book->getActiveSheet()->setTitle('Notes');
    $sheet = $book->createSheet()->setTitle('G11_2ND Sem_CP');

    foreach (['A' => ['STEM 11-1', 'GEN BIO 2', 'J. REYES', 'C 401'], 'I' => ['STEM 11-2', 'UCSP', 'J. REYES', 'C 402']] as $first => [$section, $subject, $teacher, $room]) {
        $col = fn (int $offset) => chr(ord($first) + $offset);
        $sheet->setCellValue("{$first}2", 'SHS GRADE 11 - CLASS PROGRAM');
        $sheet->setCellValue("{$first}3", 'Second Semester, School Year 2025-2026');
        $sheet->setCellValue("{$first}4", $section);
        $sheet->setCellValue("{$first}5", 'Class Adviser: Someone');
        foreach (['TIME', 'NO. OF MINUTES', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as $i => $heading) {
            $sheet->setCellValue($col($i).'7', $heading);
        }
        // 6:00 - 8:00, Monday: subject, the section again, teacher, room.
        $sheet->setCellValue("{$first}8", '6:00 - 8:00');
        $sheet->setCellValue($col(1).'8', '120 minutes');
        $sheet->setCellValue($col(2).'8', $subject);
        $sheet->setCellValue($col(2).'9', $section);
        $sheet->setCellValue($col(2).'10', $teacher);
        $sheet->setCellValue($col(2).'11', $room);
        // A break, then an afternoon class written without PM, its lines in another order.
        $sheet->setCellValue("{$first}12", '10:00 - 10:30');
        $sheet->setCellValue($col(2).'12', 'BREAK TIME');
        $sheet->setCellValue("{$first}13", '1:00 - 3:00');
        $sheet->setCellValue($col(3).'13', 'GEN. CHEM 1');
        $sheet->setCellValue($col(3).'14', $teacher);
        $sheet->setCellValue($col(3).'15', $section);
        $sheet->setCellValue($col(3).'16', 'C 203 SPEECH LAB');
        $sheet->setCellValue("{$first}17", 'Total Time Duration');
    }

    $path = tempnam(sys_get_temp_dir(), 'cp').'.xlsx';
    (new Xlsx($book))->save($path);

    return $path;
}

it('reads one row per class from the school layout', function () {
    $result = app(ClassProgramReader::class)->read(classProgramWorkbook());

    expect($result['sections'])->toBe(['Grade 11 – STEM 11-1', 'Grade 11 – STEM 11-2'])
        ->and($result['rows'])->toHaveCount(4)
        ->and($result['rows'][0])->toBe([11, 'STEM 11-1', 'Monday', '06:00', '08:00', 'GEN BIO 2', 'J. REYES', 'C 401'])
        ->and($result['rows'][1])->toBe([11, 'STEM 11-1', 'Tuesday', '13:00', '15:00', 'GEN. CHEM 1', 'J. REYES', 'C 203 SPEECH LAB']);
});

it('says when a workbook has no class program sheet', function () {
    $book = new Spreadsheet;
    $book->getActiveSheet()->setTitle('Budget');
    $path = tempnam(sys_get_temp_dir(), 'cp').'.xlsx';
    (new Xlsx($book))->save($path);

    expect(app(ClassProgramReader::class)->read($path))->toBeNull();
});

it('imports the school workbook through the same review, matching "J. REYES" and "C 401"', function () {
    $this->withHeader('Referer', 'http://localhost:5173');
    $this->seed(DatabaseSeeder::class);
    $term = SchoolTerm::where('is_active', true)->first();
    $yearId = $term->school_year_id;
    $grade = DB::table('grade_levels')->where('grade', 11)->value('id');

    $pattern = DB::table('day_patterns')->insertGetId(['school_year_id' => $yearId, 'level' => 'SHS', 'shift' => 'WHOLE_DAY', 'name' => 'Monday – Friday', 'days' => '{1,2,3,4,5}']);
    foreach ([['06:00', '08:00'], ['13:00', '15:00']] as $index => [$start, $end]) {
        TimeSlot::create(['day_pattern_id' => $pattern, 'period_no' => $index + 1, 'start_time' => $start, 'end_time' => $end, 'is_break' => false]);
    }
    $building = DB::table('buildings')->insertGetId(['name' => 'SHS Building']);
    DB::table('rooms')->insert([['building_id' => $building, 'room_number' => '401'], ['building_id' => $building, 'room_number' => '203']]);
    $teacher = DB::table('teachers')->insertGetId(['first_name' => 'Juan', 'last_name' => 'Reyes']);
    $section = Section::create(['school_year_id' => $yearId, 'grade_level_id' => $grade, 'name' => 'STEM 11-1']);
    foreach (['Gen Bio 2', 'Gen Chem 1'] as $name) {
        $subject = DB::table('subjects')->insertGetId(['school_year_id' => $yearId, 'grade_level_id' => $grade, 'name' => $name, 'minutes_per_week' => 240]);
        SectionSubject::create(['term_id' => $term->id, 'section_id' => $section->id, 'subject_id' => $subject, 'teacher_id' => $teacher]);
    }

    $master = User::factory()->create()->assignRole('master_teacher');
    $master->gradeLevels()->sync([$grade]);
    $this->actingAs($master);

    $file = new UploadedFile(classProgramWorkbook(), 'class-program.xlsx', null, null, true);
    $response = $this->post("/api/terms/{$term->id}/schedule-import", ['file' => $file, 'preview' => '1'], ['Accept' => 'application/json'])
        ->assertOk();

    $rows = collect($response->json('data.rows'))->keyBy(fn ($row) => "{$row['section']}|{$row['day']}");

    expect($response->json('data.source'))->toBe('class_program')
        ->and($response->json('data.sections_found'))->toHaveCount(2)
        ->and($rows['Grade 11 – STEM 11-1|Monday']['status'])->toBe('ok')
        ->and($rows['Grade 11 – STEM 11-1|Tuesday']['status'])->toBe('ok')
        ->and($rows['Grade 11 – STEM 11-2|Monday']['message'])->toContain('no section with this name in Grade 11')
        ->and($response->json('data.missing.sections.count'))->toBe(1);
});

it('sets up what the workbook names but the system lacks, only when asked', function () {
    $this->withHeader('Referer', 'http://localhost:5173');
    $this->seed(DatabaseSeeder::class);
    $term = SchoolTerm::where('is_active', true)->first();
    $grade11 = DB::table('grade_levels')->where('grade', 11)->value('id');
    DB::table('day_patterns')->where('school_year_id', $term->school_year_id)->where('level', 'SHS')->delete();

    $master = User::factory()->create()->assignRole('master_teacher');
    $master->gradeLevels()->sync([$grade11]);
    $this->actingAs($master);
    $sectionsBefore = Section::count();
    $send = fn (array $fields) => $this->post("/api/terms/{$term->id}/schedule-import", $fields + ['file' => new UploadedFile(classProgramWorkbook(), 'class-program.xlsx', null, null, true)], ['Accept' => 'application/json'])->assertOk();

    // First look: everything is missing, nothing is created.
    $first = $send(['preview' => '1']);
    expect($first->json('data.ok'))->toBe(0)
        ->and($first->json('data.missing.sections.count'))->toBe(2)
        ->and($first->json('data.missing.bell_schedules.count'))->toBe(1)
        ->and($first->json('data.missing.subjects.count'))->toBe(3)
        ->and($first->json('data.missing.teachers.names'))->toBe(['J. REYES'])
        ->and($first->json('data.missing.rooms.count'))->toBe(3)
        ->and(Section::count())->toBe($sectionsBefore);

    // A review with the set-up is still undone.
    $review = $send(['preview' => '1', 'set_up' => '1']);
    expect($review->json('data.ok'))->toBe(2)
        ->and($review->json('data.errors'))->toBe(2)
        ->and(Section::count())->toBe($sectionsBefore);

    // Using it keeps the records and the classes, as drafts that can be edited.
    $done = $send(['set_up' => '1']);
    expect($done->json('data.ok'))->toBe(2)
        ->and(Section::where('name', 'STEM 11-1')->exists())->toBeTrue()
        ->and(DB::table('teachers')->where('first_name', 'J.')->where('last_name', 'Reyes')->exists())->toBeTrue()
        ->and(DB::table('rooms')->join('buildings', 'buildings.id', '=', 'rooms.building_id')->where('buildings.name', 'Building C')->where('room_number', '203')->value('room_name'))->toBe('Speech Lab')
        ->and(DB::table('subjects')->where('name', 'GEN BIO 2')->value('minutes_per_week'))->toBe(120)
        ->and(DB::table('time_slots')->join('day_patterns', 'day_patterns.id', '=', 'time_slots.day_pattern_id')->where('day_patterns.level', 'SHS')->count())->toBe(2)
        ->and(\App\Models\ScheduleEntry::where('term_id', $term->id)->where('status', 'draft')->count())->toBe(2);
});

/** A Grade 9 workbook like the school's: a Teachers Program and a class program per section. */
function juniorHighWorkbook(): string
{
    $book = new Spreadsheet;
    $teachers = $book->getActiveSheet()->setTitle('Template Teachers Program');
    $teachers->fromArray([
        ['FILIPINO', null, null, null, null, null, null, 'MAPEH'],
        [],
        ['NAME OF TEACHER', null, 'Geraldine C. Roldan', null, 'SUBJECT', 'Filipino', null, 'NAME OF TEACHER', null, 'MR. NARVAEZ', null, 'SUBJECT'],
        ['TIME', 'No. of Mins.', 'MONDAY - THURSDAY', 'TIME', 'No. of Mins.', 'FRIDAY', null, 'TIME', 'No. of Mins.', 'MONDAY - THURSDAY', 'TIME', 'No. of Mins.', 'FRIDAY'],
        ['6:00- 6:45', 45, 'TINIO', '6:00- 6:40', 40, 'TINIO', null, '6:00- 6:45', 45, null, '6:00- 6:40', 40],
        ['6:45- 7:30', 45, null, '6:40- 7:20', 40, null, null, '6:45- 7:30', 45, 'TINIO', '6:40- 7:20', 40, 'TINIO'],
        ['12:30- 1:50', 80, 'TINIO', null, null, null],
        ['WEEKLY TEACHING LOAD'],
    ]);
    $grade = $book->createSheet()->setTitle('Grade 9');
    $grade->fromArray([
        ['GRADE 9'],
        [],
        ['SECTION', 'RECTO'],
        [null, null, null, 'ADVISER'],
        ['Time', 'Monday- Thursday', null, null, null, 'Time', 'Friday'],
        ['7:30- 8:15', 'AP', 'AP', 'VE', 'AP', '7:20- 8:00', 'HGP'],
        ['9:45- 10:05', 'RECESS', null, null, null, '9:20- 9:40', 'RECESS'],
    ]);

    $path = tempnam(sys_get_temp_dir(), 'jhs').'.xlsx';
    (new Xlsx($book))->save($path);

    return $path;
}

it('reads a Teachers Program and a Junior High class program, whatever the names', function () {
    $result = app(ClassProgramReader::class)->read(juniorHighWorkbook(), 'Grade-9 (1).xlsx');
    $rows = collect($result['rows'])->map(fn ($row) => implode('|', $row));

    expect($result['sections'])->toBe(['Grade 9 – TINIO', 'Grade 9 – RECTO'])
        // The Teachers Program: Monday to Thursday in one column, the section in the cell.
        ->and($rows)->toContain('9|TINIO|Monday|06:00|06:45|Filipino|Geraldine C. Roldan|')
        ->and($rows)->toContain('9|TINIO|Thursday|06:00|06:45|Filipino|Geraldine C. Roldan|')
        ->and($rows)->toContain('9|TINIO|Friday|06:00|06:40|Filipino|Geraldine C. Roldan|')
        // 12:30 - 1:50 runs into the afternoon.
        ->and($rows)->toContain('9|TINIO|Monday|12:30|13:50|Filipino|Geraldine C. Roldan|')
        // No subject written: the heading of the column group; "MR." is dropped.
        ->and($rows)->toContain('9|TINIO|Monday|06:45|07:30|Mapeh|NARVAEZ|')
        // The class program: one column per day under "Monday – Thursday"; recess is left out.
        ->and($rows)->toContain('9|RECTO|Wednesday|07:30|08:15|VE||')
        ->and($rows)->toContain('9|RECTO|Friday|07:20|08:00|HGP||')
        ->and($rows->filter(fn ($row) => str_contains($row, 'RECESS')))->toBeEmpty();
});

it('imports any Excel file name, matching "AP" to Araling Panlipunan, and says what to do with a PDF', function () {
    $this->withHeader('Referer', 'http://localhost:5173');
    $this->seed(DatabaseSeeder::class);
    $term = SchoolTerm::where('is_active', true)->first();
    $grade9 = DB::table('grade_levels')->where('grade', 9)->value('id');
    DB::table('subjects')->insert(['school_year_id' => $term->school_year_id, 'grade_level_id' => $grade9, 'name' => 'Araling Panlipunan', 'minutes_per_week' => 180]);

    $chair = User::factory()->create()->assignRole('glc');
    $chair->gradeLevels()->sync([$grade9]);
    $this->actingAs($chair);
    $url = "/api/terms/{$term->id}/schedule-import";

    $review = $this->post($url, ['file' => new UploadedFile(juniorHighWorkbook(), 'Grade-9 (1).xlsx', null, null, true), 'preview' => '1'], ['Accept' => 'application/json'])->assertOk();
    expect($review->json('data.source'))->toBe('class_program')
        ->and($review->json('data.missing.sections.count'))->toBe(2)
        ->and(collect($review->json('data.missing.subjects.names'))->join(' '))->not->toContain('Araling');

    $pdf = UploadedFile::fake()->create('Grade 9 schedule.pdf', 20, 'application/pdf');
    $this->post($url, ['file' => $pdf, 'preview' => '1'], ['Accept' => 'application/json'])
        ->assertUnprocessable()
        ->assertJsonPath('errors.file.0', fn (string $message) => str_contains($message, 'save it as an Excel workbook'));
});

it('sets up "Monday – Thursday" and "Friday" bell schedules, and keeps classes without a room until the home room is set', function () {
    $this->withHeader('Referer', 'http://localhost:5173');
    $this->seed(DatabaseSeeder::class);
    $term = SchoolTerm::where('is_active', true)->first();
    $grade9 = DB::table('grade_levels')->where('grade', 9)->value('id');
    DB::table('day_patterns')->where('school_year_id', $term->school_year_id)->where('level', 'JHS')->delete();

    $chair = User::factory()->create()->assignRole('glc');
    $chair->gradeLevels()->sync([$grade9]);
    $this->actingAs($chair);
    $send = fn (array $fields) => $this->post("/api/terms/{$term->id}/schedule-import", $fields + ['file' => new UploadedFile(juniorHighWorkbook(), 'Grade-9 (1).xlsx', null, null, true)], ['Accept' => 'application/json'])->assertOk();

    $review = $send(['preview' => '1', 'set_up' => '1']);
    expect($review->json('data.missing.bell_schedules.names'))->toBe(['Junior High, Monday – Thursday, 4 periods', 'Junior High, Friday, 3 periods'])
        ->and($review->json('data.ok'))->toBeGreaterThan(0)
        ->and(collect($review->json('data.rows'))->where('status', 'ok')->every(fn ($row) => str_contains((string) $row['message'], 'No room yet') || $row['message'] === 'Activity'))->toBeTrue();

    $done = $send(['set_up' => '1']);
    $tinio = Section::where('name', 'TINIO')->firstOrFail();
    $classes = \App\Models\ScheduleEntry::where('section_id', $tinio->id)->whereNotNull('section_subject_id');
    expect($done->json('data.ok'))->toBe($review->json('data.ok'))
        ->and((clone $classes)->whereNull('room_id')->count())->toBeGreaterThan(0);

    // Not submittable while classes have no room.
    $flags = app(\App\Services\FlagService::class)->forSection($tinio, $term->id);
    expect(collect($flags)->firstWhere('type', 'no_room'))->toMatchArray(['blocking' => true]);

    // The home room fills them.
    $buildingId = DB::table('buildings')->insertGetId(['name' => 'Main']);
    $roomId = DB::table('rooms')->insertGetId(['building_id' => $buildingId, 'room_number' => '301']);
    $this->putJson("/api/sections/{$tinio->id}/room", ['room_id' => $roomId])
        ->assertOk()
        ->assertJsonPath('filled.busy', 0)
        ->assertJsonPath('message', fn (string $message) => str_contains($message, 'without a room now use it'));

    expect((clone $classes)->whereNull('room_id')->count())->toBe(0)
        ->and(collect(app(\App\Services\FlagService::class)->forSection($tinio->fresh(), $term->id))->firstWhere('type', 'no_room'))->toBeNull();
});
