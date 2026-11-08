<?php

use App\Models\SchoolTerm;
use App\Models\Section;
use App\Models\User;
use App\Services\ReportService;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Support\Facades\DB;

function summaryGrade(int $grade): int
{
    return DB::table('grade_levels')->where('grade', $grade)->value('id');
}

function summaryLoading(object $test, int $sectionId, int $teacherId, string $subject, int $grade = 7): int
{
    $subjectId = DB::table('subjects')->insertGetId([
        'school_year_id' => $test->yearId, 'grade_level_id' => summaryGrade($grade), 'name' => $subject, 'minutes_per_week' => 90,
    ]);

    return DB::table('section_subjects')->insertGetId([
        'term_id' => $test->termId, 'section_id' => $sectionId, 'subject_id' => $subjectId, 'teacher_id' => $teacherId,
    ]);
}

function summaryEntry(object $test, int $sectionId, int $loadingId, int $teacherId, int $day, string $status = 'approved', ?int $roomId = null): void
{
    DB::table('schedule_entries')->insert([
        'term_id' => $test->termId, 'section_id' => $sectionId, 'section_subject_id' => $loadingId, 'teacher_id' => $teacherId,
        'room_id' => $roomId ?? $test->roomId, 'created_by' => $test->glc->id, 'status' => $status,
        'day_of_week' => $day, 'start_time' => '07:00', 'end_time' => '07:45',
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
        'school_year_id' => $this->yearId, 'level' => 'JHS', 'shift' => 'WHOLE_DAY', 'name' => 'Monday – Tuesday', 'days' => '{1,2}',
    ]);
    DB::table('time_slots')->insert([
        ['day_pattern_id' => $patternId, 'period_no' => 1, 'label' => null, 'start_time' => '07:00', 'end_time' => '07:45', 'is_break' => false],
        ['day_pattern_id' => $patternId, 'period_no' => null, 'label' => 'Recess', 'start_time' => '07:45', 'end_time' => '08:05', 'is_break' => true],
    ]);

    $this->ana = DB::table('teachers')->insertGetId(['first_name' => 'Ana', 'last_name' => 'Reyes', 'max_subjects' => 1]);
    $this->ben = DB::table('teachers')->insertGetId(['first_name' => 'Ben', 'last_name' => 'Cruz']);
    $buildingId = DB::table('buildings')->insertGetId(['name' => 'Main']);
    $this->roomId = DB::table('rooms')->insertGetId(['building_id' => $buildingId, 'room_number' => '101']);

    $this->glc = User::factory()->create()->assignRole('glc');
    $this->glc->gradeLevels()->attach(summaryGrade(7));

    $this->honesty = DB::table('sections')->insertGetId(['school_year_id' => $this->yearId, 'grade_level_id' => summaryGrade(7), 'name' => 'Honesty']);
    $this->hope = DB::table('sections')->insertGetId(['school_year_id' => $this->yearId, 'grade_level_id' => summaryGrade(7), 'name' => 'Hope']);

    $this->base = "/api/terms/{$this->termId}/reports";
    $this->actingAs($this->glc);
});

describe('Teacher Load Report', function () {
    it('shows each teacher with their classes, minutes and limit', function () {
        $math = summaryLoading($this, $this->honesty, $this->ana, 'Math 7');
        summaryLoading($this, $this->hope, $this->ana, 'Math 7 B');
        summaryEntry($this, $this->honesty, $math, $this->ana, 1);
        summaryEntry($this, $this->honesty, $math, $this->ana, 2, 'draft');
        summaryEntry($this, $this->honesty, $math, $this->ana, 3, 'rejected');

        $this->getJson("{$this->base}/teacher-load")
            ->assertOk()
            ->assertJsonPath('data.summary.teachers', 1)
            ->assertJsonPath('data.summary.overloaded', 1)
            ->assertJsonPath('data.teachers.0.name', 'Ana Reyes')
            ->assertJsonPath('data.teachers.0.assigned', 2)
            ->assertJsonPath('data.teachers.0.limit', 1)
            ->assertJsonPath('data.teachers.0.is_overloaded', true)
            ->assertJsonPath('data.teachers.0.minutes', 90)
            ->assertJsonPath('data.teachers.0.classes', ['Grade 7 – Honesty: Math 7', 'Grade 7 – Hope: Math 7 B']);
    });

    it('leaves out teachers who have nothing in these grade levels, but counts a whole load', function () {
        $eight = DB::table('sections')->insertGetId(['school_year_id' => $this->yearId, 'grade_level_id' => summaryGrade(8), 'name' => 'Faith']);
        summaryLoading($this, $eight, $this->ben, 'Science 8', 8);
        summaryLoading($this, $this->honesty, $this->ana, 'Math 7');
        summaryLoading($this, $eight, $this->ana, 'Math 8', 8);

        $this->getJson("{$this->base}/teacher-load")
            ->assertJsonPath('data.summary.teachers', 1)
            ->assertJsonPath('data.teachers.0.name', 'Ana Reyes')
            ->assertJsonPath('data.teachers.0.assigned', 2);
    });

    it('downloads as PDF and XLSX, even when empty', function () {
        expect(substr($this->get("{$this->base}/teacher-load.pdf")->assertOk()->getContent(), 0, 4))->toBe('%PDF')
            ->and(substr($this->get("{$this->base}/teacher-load.xlsx")->assertOk()->getContent(), 0, 2))->toBe('PK');
    });
});

describe('Grade Level Timetable', function () {
    it('shows the sections side by side, with breaks and the days of a partial subject', function () {
        $every = summaryLoading($this, $this->honesty, $this->ana, 'Math 7');
        $once = summaryLoading($this, $this->hope, $this->ben, 'Science 7');
        summaryEntry($this, $this->honesty, $every, $this->ana, 1);
        summaryEntry($this, $this->honesty, $every, $this->ana, 2);
        $other = DB::table('rooms')->insertGetId(['building_id' => DB::table('buildings')->value('id'), 'room_number' => '102']);
        summaryEntry($this, $this->hope, $once, $this->ben, 2, 'approved', $other);

        $response = $this->getJson("{$this->base}/grades/7/timetable")->assertOk();
        $table = $response->json('data.tables.0');

        expect($table['name'])->toBe('Monday – Tuesday')
            ->and(collect($table['sections'])->pluck('label')->all())->toBe(['Honesty', 'Hope'])
            ->and($table['rows'][0]['time'])->toBe('7:00 AM – 7:45 AM')
            ->and($table['rows'][0]['cells'][$this->honesty][0])->toMatchArray(['subject' => 'Math 7', 'teacher' => 'Ana Reyes', 'days' => null])
            ->and($table['rows'][0]['cells'][$this->hope][0])->toMatchArray(['subject' => 'Science 7', 'days' => 'Tue'])
            ->and($table['rows'][1]['break'])->toBe('RECESS');

        expect($response->json('data.isDraft'))->toBeFalse();
    });

    it('marks a draft', function () {
        $loading = summaryLoading($this, $this->honesty, $this->ana, 'Math 7');
        summaryEntry($this, $this->honesty, $loading, $this->ana, 1, 'draft');

        $this->getJson("{$this->base}/grades/7/timetable")->assertJsonPath('data.isDraft', true);
    });

    it('splits a grade with many sections into several tables', function () {
        foreach (range(1, 6) as $number) {
            DB::table('sections')->insert(['school_year_id' => $this->yearId, 'grade_level_id' => summaryGrade(7), 'name' => "S{$number}"]);
        }

        expect($this->getJson("{$this->base}/grades/7/timetable")->json('data.tables'))->toHaveCount(2);
    });

    it('downloads as PDF and XLSX', function () {
        expect(substr($this->get("{$this->base}/grades/7/timetable.pdf")->assertOk()->getContent(), 0, 4))->toBe('%PDF')
            ->and(substr($this->get("{$this->base}/grades/7/timetable.xlsx")->assertOk()->getContent(), 0, 2))->toBe('PK');
    });

    it('stays within the grade levels of the user', function () {
        $this->getJson("{$this->base}/grades/8/timetable")->assertForbidden();
        $this->get("{$this->base}/grades/8/timetable.pdf", ['Accept' => 'application/json'])->assertForbidden();
    });

    it('is offered in the options', function () {
        $this->getJson("{$this->base}/options")->assertJsonPath('data.grades', [7]);
    });
});

it('is not for teachers', function () {
    $this->actingAs(User::factory()->create()->assignRole('teacher'));

    $this->getJson("{$this->base}/teacher-load")->assertForbidden();
    $this->getJson("{$this->base}/grades/7/timetable")->assertForbidden();
});

describe('co-adviser and the public copy', function () {
    beforeEach(function () {
        DB::table('sections')->where('id', $this->honesty)->update(['adviser_id' => $this->ana, 'co_adviser_id' => $this->ben]);
        $this->carla = DB::table('teachers')->insertGetId(['first_name' => 'Carla', 'last_name' => 'Santos']);
        $loading = summaryLoading($this, $this->honesty, $this->carla, 'Math 7');
        summaryEntry($this, $this->honesty, $loading, $this->carla, 1);
        summaryEntry($this, $this->honesty, $loading, $this->carla, 2);
        DB::table('report_signatories')->insert([
            'term_id' => $this->termId, 'report_type' => 'class_program', 'level' => 'JHS', 'label' => 'Prepared by', 'name' => 'Dana Principal', 'position' => 'Principal', 'sort_order' => 1,
        ]);
    });

    it('names only the adviser and co-adviser to guests', function () {
        auth()->logout();
        $this->app['auth']->forgetGuards();

        $response = $this->getJson("/api/guest/sections/{$this->honesty}")
            ->assertOk()
            ->assertJsonPath('data.adviser', 'Ana Reyes')
            ->assertJsonPath('data.co_adviser', 'Ben Cruz')
            ->assertJsonPath('data.week.rows.0.cells.1.subject', 'Math 7');

        expect($response->getContent())->not->toContain('Carla')->not->toContain('Santos');
    });

    it('leaves the teachers and signatories out of the public form, and keeps them on the official one', function () {
        $term = SchoolTerm::find($this->termId);
        $section = Section::find($this->honesty);
        $data = app(ReportService::class)->classProgramData($term, $section);

        $public = view('reports.class-program-jhs', [...$data, 'isPublic' => true])->render();
        $official = view('reports.class-program-jhs', [...$data, 'isPublic' => false])->render();

        expect($public)->toContain('Ana Reyes')->toContain('Co-Adviser')->toContain('Ben Cruz')->toContain('Math 7')
            ->not->toContain('Carla Santos')->not->toContain('TEACHER')->not->toContain('Dana Principal');
        expect($official)->toContain('Carla Santos')->toContain('TEACHER')->toContain('Dana Principal');
    });

    it('does the same on the Senior High form', function () {
        $term = SchoolTerm::find($this->termId);
        $section = Section::find($this->honesty);
        $data = app(ReportService::class)->classProgramData($term, $section);
        $data['weekly'] = (fn () => $this->weeklyTable($section, \App\Models\ScheduleEntry::with(['sectionSubject.subject', 'teacher', 'room.building'])->where('section_id', $section->id)->get()))->call(app(ReportService::class));

        $public = view('reports.class-program-shs', [...$data, 'isPublic' => true])->render();
        $official = view('reports.class-program-shs', [...$data, 'isPublic' => false])->render();

        expect($public)->not->toContain('Carla Santos')->toContain('Math 7');
        expect($official)->toContain('Carla Santos');
    });
});
