<?php

use App\Models\User;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\IOFactory;

function reportGrade(int $grade): int
{
    return DB::table('grade_levels')->where('grade', $grade)->value('id');
}

beforeEach(function () {
    $this->withHeader('Referer', 'http://localhost:5173');
    $this->seed(ReferenceDataSeeder::class);

    $this->glc = User::factory()->create()->assignRole('glc');
    $this->glc->gradeLevels()->sync([reportGrade(7)]);
    $this->actingAs($this->glc);

    $this->yearId = DB::table('school_years')->insertGetId([
        'name' => '2026-2027', 'start_date' => '2026-06-01', 'end_date' => '2027-03-31',
    ]);
    $this->termId = DB::table('school_terms')->insertGetId([
        'school_year_id' => $this->yearId, 'term_no' => 1, 'name' => 'First',
        'start_date' => '2026-06-01', 'end_date' => '2026-09-30', 'is_active' => true,
    ]);
    DB::table('school_profile')->insert(['school_name' => 'My School']);
    $buildingId = DB::table('buildings')->insertGetId(['name' => 'Main']);
    $this->roomId = DB::table('rooms')->insertGetId(['building_id' => $buildingId, 'room_number' => '101', 'room_name' => 'Lab', 'capacity' => 40]);
    $this->freeRoomId = DB::table('rooms')->insertGetId(['building_id' => $buildingId, 'room_number' => '102']);
    $this->teacherId = DB::table('teachers')->insertGetId(['first_name' => 'Ana', 'last_name' => 'Reyes']);
    $this->sectionId = DB::table('sections')->insertGetId([
        'school_year_id' => $this->yearId, 'grade_level_id' => reportGrade(7), 'name' => 'Honesty',
        'adviser_id' => $this->teacherId, 'home_room_id' => $this->roomId,
    ]);
    $subjectId = DB::table('subjects')->insertGetId([
        'school_year_id' => $this->yearId, 'grade_level_id' => reportGrade(7), 'name' => 'Math 7', 'minutes_per_week' => 225,
    ]);
    $this->loadingId = DB::table('section_subjects')->insertGetId([
        'term_id' => $this->termId, 'section_id' => $this->sectionId, 'subject_id' => $subjectId, 'teacher_id' => $this->teacherId,
    ]);
    $this->base = "/api/terms/{$this->termId}/reports";
});

function reportEntry(object $test, int $day = 1, string $status = 'approved', string $start = '07:00', string $end = '07:45'): void
{
    DB::table('schedule_entries')->insert([
        'term_id' => $test->termId, 'section_id' => $test->sectionId, 'section_subject_id' => $test->loadingId,
        'teacher_id' => $test->teacherId, 'room_id' => $test->roomId, 'created_by' => $test->glc->id,
        'status' => $status, 'day_of_week' => $day, 'start_time' => $start, 'end_time' => $end,
    ]);
}

/** All the text of a downloaded workbook, cell by cell. */
function workbookText(object $response): string
{
    $path = tempnam(sys_get_temp_dir(), 'report').'.xlsx';
    file_put_contents($path, $response->getContent());

    $text = collect(IOFactory::load($path)->getActiveSheet()->toArray())->flatten()->filter()->implode(' | ');
    unlink($path);

    return $text;
}

describe('Teacher Program', function () {
    it('has one row per class time and adds up the minutes', function () {
        reportEntry($this, 1);
        reportEntry($this, 2);
        reportEntry($this, 1, 'approved', '08:00', '09:20');

        $this->getJson("{$this->base}/teachers/{$this->teacherId}")
            ->assertOk()
            ->assertJsonPath('data.title', 'TEACHER PROGRAM')
            ->assertJsonPath('data.heading', 'ANA REYES')
            ->assertJsonPath('data.details', ['Adviser of Grade 7 – Honesty'])
            ->assertJsonCount(2, 'data.rows')
            ->assertJsonPath('data.rows.0.time', '7:00 AM – 7:45 AM')
            ->assertJsonPath('data.rows.0.minutes', 45)
            ->assertJsonPath('data.rows.0.cells.1.0.0', 'Grade 7 – Honesty')
            ->assertJsonPath('data.rows.0.cells.1.0.1', 'Math 7')
            ->assertJsonPath('data.rows.0.cells.1.0.2', 'Main – 101')
            ->assertJsonPath('data.totals.per_day.1', 125)
            ->assertJsonPath('data.totals.per_day.2', 45)
            ->assertJsonPath('data.totals.per_day.3', 0)
            ->assertJsonPath('data.totals.week', 170);
    });

    it('is a draft until every entry is approved', function () {
        reportEntry($this, 1, 'approved');
        $this->getJson("{$this->base}/teachers/{$this->teacherId}")->assertJsonPath('data.isDraft', false);

        reportEntry($this, 2, 'pending');
        $this->getJson("{$this->base}/teachers/{$this->teacherId}")->assertJsonPath('data.isDraft', true);
    });

    it('leaves out rejected entries', function () {
        reportEntry($this, 1, 'rejected');

        $this->getJson("{$this->base}/teachers/{$this->teacherId}")
            ->assertJsonPath('data.rows', [])
            ->assertJsonPath('data.totals.week', 0)
            ->assertJsonPath('data.isDraft', true);
    });

    it('downloads as a PDF', function () {
        reportEntry($this);

        $response = $this->get("{$this->base}/teachers/{$this->teacherId}/program.pdf")->assertOk();

        expect($response->headers->get('Content-Type'))->toBe('application/pdf')
            ->and($response->headers->get('Content-Disposition'))->toContain('teacher-program-ana-reyes-first.pdf')
            ->and(substr($response->getContent(), 0, 4))->toBe('%PDF');
    });

    it('downloads as an XLSX with the same content', function () {
        reportEntry($this);

        $response = $this->get("{$this->base}/teachers/{$this->teacherId}/program.xlsx")->assertOk();
        $text = workbookText($response);

        expect($response->headers->get('Content-Disposition'))->toContain('teacher-program-ana-reyes-first.xlsx')
            ->and($text)->toContain('My School')
            ->and($text)->toContain('TEACHER PROGRAM')
            ->and($text)->toContain('ANA REYES')
            ->and($text)->toContain('7:00 AM – 7:45 AM')
            ->and($text)->toContain('Math 7')
            ->and($text)->toContain('Total per week: 45 minutes');
    });

    it('fills a signatory with the teacher on the form', function () {
        DB::table('report_signatories')->insert([
            'term_id' => $this->termId, 'report_type' => 'teacher_program', 'label' => 'Conforme',
            'auto_source' => 'teacher', 'position' => 'Teacher',
        ]);
        reportEntry($this);

        $text = workbookText($this->get("{$this->base}/teachers/{$this->teacherId}/program.xlsx"));

        expect($text)->toContain('Conforme: Ana Reyes, Teacher');
    });

    it('uses the title the Admin set', function () {
        DB::table('report_settings')->insert([
            'report_type' => 'teacher_program', 'title_format' => 'FACULTY PROGRAM', 'doc_ref_code' => 'X',
        ]);

        $this->getJson("{$this->base}/teachers/{$this->teacherId}")->assertJsonPath('data.title', 'FACULTY PROGRAM');
    });

    describe('who can see it', function () {
        it('lets a scheduler print a teacher of their grade levels, whole', function () {
            $outsideSection = DB::table('sections')->insertGetId([
                'school_year_id' => $this->yearId, 'grade_level_id' => reportGrade(9), 'name' => 'Outside',
            ]);
            $subject = DB::table('subjects')->insertGetId([
                'school_year_id' => $this->yearId, 'grade_level_id' => reportGrade(9), 'name' => 'Science 9', 'minutes_per_week' => 225,
            ]);
            $loading = DB::table('section_subjects')->insertGetId([
                'term_id' => $this->termId, 'section_id' => $outsideSection, 'subject_id' => $subject, 'teacher_id' => $this->teacherId,
            ]);
            DB::table('schedule_entries')->insert([
                'term_id' => $this->termId, 'section_id' => $outsideSection, 'section_subject_id' => $loading,
                'teacher_id' => $this->teacherId, 'created_by' => $this->glc->id,
                'day_of_week' => 3, 'start_time' => '07:00', 'end_time' => '07:45',
            ]);

            $this->getJson("{$this->base}/teachers/{$this->teacherId}")
                ->assertOk()
                ->assertJsonPath('data.rows.0.cells.3.0.0', 'Grade 9 – Outside');
        });

        it('refuses a teacher with no section in their grade levels', function () {
            $other = DB::table('teachers')->insertGetId(['first_name' => 'Ben', 'last_name' => 'Cruz']);

            $this->getJson("{$this->base}/teachers/{$other}")->assertForbidden();
            $this->get("{$this->base}/teachers/{$other}/program.pdf")->assertForbidden();
            $this->get("{$this->base}/teachers/{$other}/program.xlsx")->assertForbidden();
        });

        it('lets the Admin print anyone', function () {
            $other = DB::table('teachers')->insertGetId(['first_name' => 'Ben', 'last_name' => 'Cruz']);
            $this->actingAs(User::factory()->create()->assignRole('super_admin'));

            $this->getJson("{$this->base}/teachers/{$other}")->assertOk();
        });
    });
});

describe('Room Schedule', function () {
    it('shows who uses the room', function () {
        reportEntry($this);

        $this->getJson("{$this->base}/rooms/{$this->roomId}")
            ->assertOk()
            ->assertJsonPath('data.title', 'ROOM SCHEDULE')
            ->assertJsonPath('data.heading', 'MAIN – 101')
            ->assertJsonPath('data.details', ['Lab', 'Capacity: 40'])
            ->assertJsonPath('data.rows.0.cells.1.0.0', 'Grade 7 – Honesty')
            ->assertJsonPath('data.rows.0.cells.1.0.2', 'Ana Reyes')
            ->assertJsonPath('data.totals.week', 45);
    });

    it('downloads as a PDF and XLSX', function () {
        reportEntry($this);

        $pdf = $this->get("{$this->base}/rooms/{$this->roomId}/schedule.pdf")->assertOk();
        $xlsx = $this->get("{$this->base}/rooms/{$this->roomId}/schedule.xlsx")->assertOk();

        expect(substr($pdf->getContent(), 0, 4))->toBe('%PDF')
            ->and($pdf->headers->get('Content-Disposition'))->toContain('room-schedule-main-101-first.pdf')
            ->and(workbookText($xlsx))->toContain('ROOM SCHEDULE');
    });
});

describe('Room usage', function () {
    it('lists each room with its sections and periods', function () {
        reportEntry($this, 1);
        reportEntry($this, 2);

        $this->getJson("{$this->base}/room-usage")
            ->assertOk()
            ->assertJsonPath('data.buildings.0.name', 'Main')
            ->assertJsonPath('data.buildings.0.rooms.0.room_number', '101')
            ->assertJsonPath('data.buildings.0.rooms.0.periods_per_week', 2)
            ->assertJsonPath('data.buildings.0.rooms.0.sections.0.label', 'Grade 7 – Honesty')
            ->assertJsonPath('data.buildings.0.rooms.0.sections.0.periods_per_week', 2)
            ->assertJsonPath('data.buildings.0.rooms.1.sections', []);
    });

    it('downloads as a PDF and XLSX', function () {
        reportEntry($this);

        $pdf = $this->get("{$this->base}/room-usage.pdf")->assertOk();
        $text = workbookText($this->get("{$this->base}/room-usage.xlsx")->assertOk());

        expect(substr($pdf->getContent(), 0, 4))->toBe('%PDF')
            ->and($text)->toContain('ROOM AND BUILDING USAGE')
            ->and($text)->toContain('Grade 7 – Honesty (1)')
            ->and($text)->toContain('Not used');
    });

    it('can be limited to one building, for the building view printout', function () {
        reportEntry($this);
        $other = DB::table('buildings')->insertGetId(['name' => 'Annex']);
        DB::table('rooms')->insert(['building_id' => $other, 'room_number' => '301']);
        $main = DB::table('buildings')->where('name', 'Main')->value('id');

        $this->getJson("{$this->base}/room-usage?building={$main}")
            ->assertOk()
            ->assertJsonCount(1, 'data.buildings')
            ->assertJsonPath('data.buildings.0.id', $main);

        $text = workbookText($this->get("{$this->base}/room-usage.xlsx?building={$main}")->assertOk());
        expect($text)->toContain('MAIN – ROOM USAGE')->not->toContain('301');
    });
});

describe('Class Program XLSX', function () {
    beforeEach(function () {
        $patternId = DB::table('day_patterns')->insertGetId([
            'school_year_id' => $this->yearId, 'level' => 'JHS', 'shift' => 'WHOLE_DAY', 'name' => 'Monday – Thursday', 'days' => '{1,2,3,4}',
        ]);
        DB::table('time_slots')->insert([
            ['day_pattern_id' => $patternId, 'period_no' => 1, 'label' => null, 'start_time' => '07:00', 'end_time' => '07:45', 'is_break' => false],
            ['day_pattern_id' => $patternId, 'period_no' => null, 'label' => 'Lunch', 'start_time' => '07:45', 'end_time' => '08:05', 'is_break' => true],
        ]);
        reportEntry($this);
    });

    it('has the same content as the PDF', function () {
        DB::table('report_signatories')->insert([
            'term_id' => $this->termId, 'report_type' => 'class_program', 'label' => 'Conforme',
            'auto_source' => 'section_adviser', 'position' => 'Class Adviser',
        ]);

        $response = $this->get("/api/terms/{$this->termId}/sections/{$this->sectionId}/class-program.xlsx")->assertOk();
        $text = workbookText($response);

        expect($response->headers->get('Content-Disposition'))->toContain('class-program-grade-7-honesty-first.xlsx')
            ->and($text)->toContain('GRADE 7 – HONESTY')
            ->and($text)->toContain('Class Adviser: Ana Reyes')
            ->and($text)->toContain('MONDAY – THURSDAY')
            ->and($text)->toContain('Math 7')
            ->and($text)->toContain('LUNCH')
            ->and($text)->toContain('Conforme: Ana Reyes, Class Adviser');
    });

    it('follows the same access as the PDF', function () {
        $outside = DB::table('sections')->insertGetId([
            'school_year_id' => $this->yearId, 'grade_level_id' => reportGrade(9), 'name' => 'Outside',
        ]);

        $this->get("/api/terms/{$this->termId}/sections/{$outside}/class-program.xlsx")->assertForbidden();
    });

});

describe('options', function () {
    it('offers a scheduler their sections, their teachers and every room', function () {
        DB::table('sections')->insert([
            'school_year_id' => $this->yearId, 'grade_level_id' => reportGrade(9), 'name' => 'Outside',
        ]);
        DB::table('teachers')->insert(['first_name' => 'No', 'last_name' => 'Load']);

        $this->getJson("{$this->base}/options")
            ->assertOk()
            ->assertJsonCount(1, 'data.sections')
            ->assertJsonPath('data.sections.0.label', 'Grade 7 – Honesty')
            ->assertJsonCount(1, 'data.teachers')
            ->assertJsonPath('data.teachers.0.label', 'Ana Reyes')
            ->assertJsonCount(2, 'data.rooms');
    });

    it('offers the Admin every section', function () {
        DB::table('sections')->insert([
            'school_year_id' => $this->yearId, 'grade_level_id' => reportGrade(9), 'name' => 'Outside',
        ]);
        $this->actingAs(User::factory()->create()->assignRole('super_admin'));

        $this->getJson("{$this->base}/options")->assertJsonCount(2, 'data.sections');
    });
});

it('keeps people who only teach out of reports', function () {
    $this->actingAs(User::factory()->create()->assignRole('teacher'));

    $this->getJson("{$this->base}/options")->assertForbidden();
    $this->getJson("{$this->base}/rooms/{$this->roomId}")->assertForbidden();
    $this->getJson("{$this->base}/room-usage")->assertForbidden();
    $this->getJson("{$this->base}/teachers/{$this->teacherId}")->assertForbidden();
});

it('still produces the Class Program PDF from the shared parts', function () {
    $this->get("/api/terms/{$this->termId}/sections/{$this->sectionId}/class-program.pdf")
        ->assertOk()
        ->assertHeader('Content-Type', 'application/pdf');
});
