<?php

use App\Models\Activity;
use App\Models\ScheduleEntry;
use App\Models\SchoolTerm;
use App\Models\Section;
use App\Models\SectionSubject;
use App\Models\Teacher;
use App\Models\TimeSlot;
use App\Models\User;
use App\Services\ReportService;
use App\Services\ScheduleReportService;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    $this->withHeader('Referer', 'http://localhost:5173');
    $this->seed(DatabaseSeeder::class);

    $this->glc = User::where('email', 'glc@deped.gov.ph')->first();
    $this->actingAs($this->glc);
    $this->term = SchoolTerm::where('is_active', true)->first();
    $this->sectionA = Section::where('name', 'Sample A')->first();
    $this->sectionB = Section::where('name', 'Sample B')->first();
    $this->catchUp = Activity::where('name', 'Catch-up Friday')->first();
    $this->flag = Activity::where('name', 'Flag Ceremony')->first();
    $this->friday = TimeSlot::whereHas('dayPattern', fn ($query) => $query->where('name', 'Friday'))
        ->where('period_no', 2)
        ->first();
    $this->monday = TimeSlot::whereHas('dayPattern', fn ($query) => $query->where('name', 'Monday – Thursday'))
        ->where('period_no', 1)
        ->first();
});

function placeActivity(object $test, Section $section, TimeSlot $slot, Activity $activity, string $scope, array $days, bool $preview = false)
{
    return $test->postJson("/api/terms/{$test->term->id}/sections/{$section->id}/slots/{$slot->id}/activity", [
        'activity_id' => $activity->id, 'scope' => $scope, 'days' => $days, 'preview' => $preview,
    ]);
}

function classIn(object $test, Section $section, TimeSlot $slot, string $subject, array $days)
{
    $loading = SectionSubject::where('section_id', $section->id)
        ->whereHas('subject', fn ($query) => $query->where('name', $subject))
        ->first();

    return $test->putJson("/api/terms/{$test->term->id}/sections/{$section->id}/slots/{$slot->id}", [
        'section_subject_id' => $loading->id, 'room_id' => $section->home_room_id, 'days' => $days,
    ]);
}

describe('the list of activities', function () {
    it('is kept per school year and can be added to', function () {
        $yearId = $this->sectionA->school_year_id;

        $this->postJson("/api/school-years/{$yearId}/activities", ['code' => 'NRP', 'name' => 'National Reading Program'])
            ->assertCreated();

        $this->getJson("/api/school-years/{$yearId}/activities")
            ->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('data.0.name', 'Catch-up Friday');
    });

    it('refuses the same name twice in one school year', function () {
        $this->postJson("/api/school-years/{$this->sectionA->school_year_id}/activities", ['name' => 'Flag Ceremony'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('name');
    });

    it('will not delete an activity that is on a schedule', function () {
        placeActivity($this, $this->sectionA, $this->friday, $this->catchUp, 'section', [5])->assertOk();

        $this->deleteJson("/api/activities/{$this->catchUp->id}")->assertUnprocessable();
        $this->deleteJson("/api/activities/{$this->flag->id}")->assertOk();
    });

    it('is managed by schedulers, not by teachers', function () {
        $this->actingAs(User::where('email', 'teacher@deped.gov.ph')->first());

        $this->postJson("/api/school-years/{$this->sectionA->school_year_id}/activities", ['name' => 'Club Day'])
            ->assertForbidden();
    });
});

describe('placing an activity', function () {
    it('takes the period without a teacher or room', function () {
        placeActivity($this, $this->sectionA, $this->friday, $this->catchUp, 'section', [5])
            ->assertOk()
            ->assertJsonPath('summary.placed_sections', 1)
            ->assertJsonPath('data.entries.0.subject', 'Catch-up Friday')
            ->assertJsonPath('data.entries.0.activity_id', $this->catchUp->id);

        $entry = ScheduleEntry::where('section_id', $this->sectionA->id)->first();

        expect($entry->teacher_id)->toBeNull()
            ->and($entry->room_id)->toBeNull()
            ->and($entry->section_subject_id)->toBeNull()
            ->and($entry->start_time)->toBe($this->friday->start_time);
    });

    it('reaches every section of the grade level at once', function () {
        placeActivity($this, $this->sectionA, $this->friday, $this->catchUp, 'grade', [5])
            ->assertOk()
            ->assertJsonPath('summary.placed_sections', 2);

        expect(ScheduleEntry::where('activity_id', $this->catchUp->id)->pluck('section_id')->sort()->values()->all())
            ->toBe(collect([$this->sectionA->id, $this->sectionB->id])->sort()->values()->all());
    });

    it('only previews when asked, saving nothing', function () {
        placeActivity($this, $this->sectionA, $this->friday, $this->catchUp, 'all', [5], preview: true)
            ->assertOk()
            ->assertJsonPath('summary.placed_sections', 2)
            ->assertJsonPath('data', null);

        expect(ScheduleEntry::count())->toBe(0);
    });

    it('moves a class it replaces to Unplaced, keeping its teacher loading', function () {
        classIn($this, $this->sectionA, $this->monday, 'Filipino', [1, 2, 3, 4])->assertOk();
        $loadings = SectionSubject::count();

        $response = placeActivity($this, $this->sectionA, $this->monday, $this->flag, 'grade', [1])->assertOk();

        expect($response->json('summary.unplaced_classes'))->toBe(1)
            ->and($response->json('summary.sections.0.unplaced'))->toBe(['Filipino (Monday)'])
            ->and(SectionSubject::count())->toBe($loadings)
            ->and(ScheduleEntry::where('section_id', $this->sectionA->id)->whereNotNull('section_subject_id')->pluck('day_of_week')->sort()->values()->all())
            ->toBe([2, 3, 4]);

        // The plotter now counts fewer minutes for Filipino, so it shows as still to place.
        $filipino = collect($response->json('data.loading'))->firstWhere('subject', 'Filipino');
        expect($filipino['scheduled_minutes'])->toBeLessThan($filipino['required_minutes']);
    });

    it('leaves out a section that is waiting for approval, and says why', function () {
        classIn($this, $this->sectionB, $this->monday, 'Filipino', [2])->assertOk();
        ScheduleEntry::where('section_id', $this->sectionB->id)->update(['status' => 'pending']);

        $response = placeActivity($this, $this->sectionA, $this->friday, $this->catchUp, 'grade', [5])->assertOk();
        $sectionB = collect($response->json('summary.sections'))->firstWhere('id', $this->sectionB->id);

        expect($response->json('summary.placed_sections'))->toBe(1)
            ->and($sectionB['skipped'])->toContain('pending')
            ->and(ScheduleEntry::where('section_id', $this->sectionB->id)->whereNotNull('activity_id')->exists())->toBeFalse();
    });

    it('refuses an activity of another school year', function () {
        $otherYear = DB::table('school_years')->insertGetId(['name' => '2027-2028', 'start_date' => '2027-06-01', 'end_date' => '2028-03-31']);
        $other = Activity::create(['school_year_id' => $otherYear, 'name' => 'Flag Ceremony']);

        placeActivity($this, $this->sectionA, $this->friday, $other, 'section', [5])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('activity_id');
    });

    it('cannot go on a break', function () {
        $break = TimeSlot::whereHas('dayPattern', fn ($query) => $query->where('name', 'Friday'))->where('is_break', true)->first();

        placeActivity($this, $this->sectionA, $break, $this->catchUp, 'section', [5])->assertUnprocessable();
    });

    it('can be placed by the Admin too, but not by a teacher', function () {
        $this->actingAs(User::where('email', 'admin@deped.gov.ph')->first());
        placeActivity($this, $this->sectionA, $this->friday, $this->catchUp, 'section', [5])->assertOk();
    });

    it('is not for teachers', function () {
        $this->actingAs(User::where('email', 'teacher@deped.gov.ph')->first());
        placeActivity($this, $this->sectionA, $this->friday, $this->catchUp, 'section', [5])->assertForbidden();
    });
});

describe('an activity on the schedule', function () {
    it('is not an open slot, so the section can still be submitted', function () {
        placeActivity($this, $this->sectionA, $this->friday, $this->catchUp, 'section', [5])->assertOk();

        $plotter = $this->getJson("/api/terms/{$this->term->id}/sections/{$this->sectionA->id}/plotter")->json('data');

        expect(collect($plotter['flags'])->pluck('type'))->not->toContain('open_slots')
            ->and(DB::table('section_term_status')->where('section_id', $this->sectionA->id)->where('term_id', $this->term->id)->value('open_slot_count'))
            ->toBe(0);
    });

    it('shows on the section class program', function () {
        placeActivity($this, $this->sectionA, $this->friday, $this->catchUp, 'section', [5])->assertOk();

        $data = app(ReportService::class)->classProgramData($this->term, $this->sectionA);

        expect(json_encode($data))->toContain('Catch-up Friday');
    });

    it('shows on the adviser\'s teacher program, without counting as teaching time', function () {
        placeActivity($this, $this->sectionA, $this->friday, $this->catchUp, 'section', [5])->assertOk();
        $reports = app(ScheduleReportService::class);

        $adviser = $reports->teacherProgram($this->term, Teacher::find($this->sectionA->adviser_id));
        $other = $reports->teacherProgram($this->term, Teacher::find($this->sectionB->adviser_id));

        expect(json_encode($adviser['rows']))->toContain('Catch-up Friday')
            ->and($adviser['totals']['week'])->toBe(0)
            ->and(json_encode($other['rows']))->not->toContain('Catch-up Friday');
    });

    it('shows on every teacher program when all sections have it', function () {
        placeActivity($this, $this->sectionA, $this->monday, $this->flag, 'all', [1])->assertOk();

        $teacher = DB::table('teachers')->insertGetId(['first_name' => 'No', 'last_name' => 'Advisory']);
        $program = app(ScheduleReportService::class)->teacherProgram($this->term, Teacher::find($teacher));

        expect(json_encode($program['rows']))->toContain('Flag Ceremony')
            ->and(collect($program['rows'])->flatMap(fn ($row) => $row['cells'][1])->count())->toBe(1);
    });

    it('can never carry a teacher', function () {
        expect(fn () => DB::table('schedule_entries')->insert([
            'term_id' => $this->term->id, 'section_id' => $this->sectionA->id, 'activity_id' => $this->flag->id,
            'teacher_id' => $this->sectionA->adviser_id, 'day_of_week' => 1, 'start_time' => '06:00', 'end_time' => '06:30',
            'created_by' => $this->glc->id,
        ]))->toThrow(QueryException::class);
    });

    it('can be submitted and approved without a room', function () {
        placeActivity($this, $this->sectionA, $this->friday, $this->catchUp, 'section', [5])->assertOk();

        ScheduleEntry::where('section_id', $this->sectionA->id)->update(['status' => 'approved']);

        expect(ScheduleEntry::where('status', 'approved')->count())->toBe(1);
    });
});
