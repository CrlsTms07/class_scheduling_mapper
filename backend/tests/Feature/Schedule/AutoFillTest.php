<?php

use App\Models\ScheduleEntry;
use App\Models\SchoolTerm;
use App\Models\Section;
use App\Models\SectionSubject;
use App\Models\TimeSlot;
use App\Models\User;
use App\Services\AutoFillService;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Support\Facades\DB;

/*
 * Auto-fill places the minutes still missing, never moving what is already there, and
 * never creating a conflict. What does not fit is listed with a reason.
 */

beforeEach(function () {
    $this->withHeader('Referer', 'http://localhost:5173');
    $this->seed(DatabaseSeeder::class);

    $this->glc = User::where('email', 'glc@deped.gov.ph')->first();
    $this->actingAs($this->glc);
    $this->term = SchoolTerm::where('is_active', true)->first();
    $this->sectionA = Section::where('name', 'Sample A')->first();
    $this->sectionB = Section::where('name', 'Sample B')->first();
});

function autoFillPreview(object $test, string $scope = 'grade', ?Section $section = null)
{
    $section ??= $test->sectionA;

    return $test->postJson("/api/terms/{$test->term->id}/sections/{$section->id}/auto-fill/preview", ['scope' => $scope]);
}

function autoFillConfirm(object $test, string $scope = 'grade', ?Section $section = null)
{
    $section ??= $test->sectionA;
    $hash = autoFillPreview($test, $scope, $section)->json('data.plan_hash');

    return $test->postJson("/api/terms/{$test->term->id}/sections/{$section->id}/auto-fill", ['scope' => $scope, 'plan_hash' => $hash]);
}

/** Every pair of entries in the term that share a teacher, room or section at the same time. */
function clashes(int $termId, string $column): int
{
    return DB::selectOne("
        SELECT COUNT(*) AS n FROM schedule_entries a JOIN schedule_entries b
          ON a.id < b.id AND a.term_id = b.term_id AND a.day_of_week = b.day_of_week
         AND a.{$column} = b.{$column} AND a.start_time < b.end_time AND b.start_time < a.end_time
        WHERE a.term_id = ? AND a.status <> 'rejected' AND b.status <> 'rejected'", [$termId])->n;
}

it('previews without saving anything', function () {
    $response = autoFillPreview($this)->assertOk();

    expect($response->json('data.placed'))->toBeGreaterThan(0)
        ->and($response->json('data.sections'))->toHaveCount(2)
        ->and($response->json('data.plan_hash'))->toHaveLength(40)
        ->and(ScheduleEntry::count())->toBe(0);
});

it('never creates a teacher, room or section conflict', function () {
    autoFillConfirm($this)->assertCreated();

    expect(ScheduleEntry::count())->toBeGreaterThan(0)
        ->and(clashes($this->term->id, 'teacher_id'))->toBe(0)
        ->and(clashes($this->term->id, 'room_id'))->toBe(0)
        ->and(clashes($this->term->id, 'section_id'))->toBe(0);
});

it('never places more than the loading asks for', function () {
    autoFillConfirm($this)->assertCreated();

    $over = DB::table('subject_minutes_check')
        ->where('term_id', $this->term->id)
        ->whereColumn('scheduled_minutes', '>', 'required_minutes')
        ->count();

    expect($over)->toBe(0);
});

it('puts every entry on a real period of the section, never on a break', function () {
    autoFillConfirm($this)->assertCreated();

    $flags = collect([$this->sectionA, $this->sectionB])
        ->flatMap(fn (Section $section) => $this->getJson("/api/terms/{$this->term->id}/sections/{$section->id}/plotter")->json('data.flags'))
        ->pluck('type');

    expect($flags)->not->toContain('overlaps_break')
        ->not->toContain('outside_shift')
        ->not->toContain('teacher_shift');
});

it('leaves what was placed by hand exactly where it was', function () {
    $slot = TimeSlot::whereHas('dayPattern', fn ($query) => $query->where('name', 'Monday – Thursday'))->where('period_no', 2)->first();
    $filipino = SectionSubject::where('section_id', $this->sectionA->id)->whereHas('subject', fn ($query) => $query->where('name', 'Filipino'))->first();
    $this->putJson("/api/terms/{$this->term->id}/sections/{$this->sectionA->id}/slots/{$slot->id}", [
        'section_subject_id' => $filipino->id, 'room_id' => $this->sectionA->home_room_id, 'days' => [1, 2],
    ])->assertOk();
    $pinned = ScheduleEntry::orderBy('id')->get(['id', 'day_of_week', 'start_time', 'section_subject_id'])->toArray();

    autoFillConfirm($this)->assertCreated();

    expect(ScheduleEntry::whereIn('id', collect($pinned)->pluck('id'))->orderBy('id')->get(['id', 'day_of_week', 'start_time', 'section_subject_id'])->toArray())
        ->toBe($pinned)
        ->and(ScheduleEntry::whereIn('id', collect($pinned)->pluck('id'))->whereNotNull('auto_fill_run_id')->exists())->toBeFalse();
});

it('spreads a subject over the week, one period a day until every day has one', function () {
    autoFillConfirm($this, 'section')->assertCreated();

    $tooMany = ScheduleEntry::where('section_id', $this->sectionA->id)
        ->get()
        ->groupBy('section_subject_id')
        ->filter(fn ($entries) => $entries->pluck('day_of_week')->unique()->count() < 5)
        ->filter(fn ($entries) => $entries->countBy('day_of_week')->max() > 1)
        ->count();

    expect($tooMany)->toBe(0);
});

it('lists what does not fit, each with a reason', function () {
    // Both sections share every teacher, so not everything can fit.
    $response = autoFillPreview($this)->assertOk();
    $unplaced = collect($response->json('data.unplaced'));

    expect($unplaced)->not->toBeEmpty();
    $unplaced->each(fn (array $item) => expect($item['reason'])->toBeString()->not->toBeEmpty()
        ->and($item['minutes_left'])->toBeGreaterThan(0)
        ->and($item)->toHaveKeys(['section', 'subject', 'teacher']));

    // Nothing is dropped quietly: what is placed and what is left add up to what was asked.
    $asked = DB::table('section_subjects')->join('subjects', 'subjects.id', '=', 'section_subjects.subject_id')
        ->where('section_subjects.term_id', $this->term->id)->sum('subjects.minutes_per_week');
    $placed = collect($response->json('data.sections'))->sum('minutes');

    expect($placed + $unplaced->sum('minutes_left'))->toBe((int) $asked);
});

it('says why when the section has no home room', function () {
    $this->sectionA->update(['home_room_id' => null]);

    $reasons = collect(autoFillPreview($this, 'section')->json('data.unplaced'))->pluck('reason')->unique()->all();

    expect($reasons)->toBe(['The section has no home room yet.']);
});

it('gives the same result for the same data', function () {
    $first = autoFillPreview($this)->json('data');
    $second = autoFillPreview($this)->json('data');

    expect($first)->toBe($second);
});

it('refuses to save when the schedules changed after the preview', function () {
    $hash = autoFillPreview($this)->json('data.plan_hash');

    $slot = TimeSlot::whereHas('dayPattern', fn ($query) => $query->where('name', 'Friday'))->where('period_no', 1)->first();
    $loading = SectionSubject::where('section_id', $this->sectionB->id)->first();
    $this->putJson("/api/terms/{$this->term->id}/sections/{$this->sectionB->id}/slots/{$slot->id}", [
        'section_subject_id' => $loading->id, 'room_id' => $this->sectionB->home_room_id, 'days' => [5],
    ])->assertOk();

    $this->postJson("/api/terms/{$this->term->id}/sections/{$this->sectionA->id}/auto-fill", ['scope' => 'grade', 'plan_hash' => $hash])
        ->assertStatus(409);

    expect(ScheduleEntry::whereNotNull('auto_fill_run_id')->count())->toBe(0);
});

it('leaves out a section waiting for approval', function () {
    $slot = TimeSlot::whereHas('dayPattern', fn ($query) => $query->where('name', 'Friday'))->where('period_no', 1)->first();
    $loading = SectionSubject::where('section_id', $this->sectionB->id)->first();
    $this->putJson("/api/terms/{$this->term->id}/sections/{$this->sectionB->id}/slots/{$slot->id}", [
        'section_subject_id' => $loading->id, 'room_id' => $this->sectionB->home_room_id, 'days' => [5],
    ])->assertOk();
    ScheduleEntry::where('section_id', $this->sectionB->id)->update(['status' => 'pending']);

    $response = autoFillPreview($this)->assertOk();

    expect($response->json('data.sections'))->toHaveCount(1)
        ->and($response->json('data.skipped.0.section'))->toBe('Grade 7 – Sample B');
});

it('marks its entries, and a move by hand removes the mark', function () {
    autoFillConfirm($this, 'section')->assertCreated()->assertJsonPath('data.entries.0.auto_filled', true);
    $plotter = $this->getJson("/api/terms/{$this->term->id}/sections/{$this->sectionA->id}/plotter")->json('data');

    expect($plotter['last_auto_fill']['entries'])->toBe(ScheduleEntry::count());

    // Move one class to a free period by hand.
    $entry = ScheduleEntry::where('section_id', $this->sectionA->id)->where('day_of_week', 5)->orderBy('start_time')->first();
    $from = TimeSlot::whereHas('dayPattern', fn ($query) => $query->where('name', 'Friday'))->where('start_time', $entry->start_time)->first();
    $taken = ScheduleEntry::where('section_id', $this->sectionA->id)->where('day_of_week', 5)->pluck('start_time');
    $to = TimeSlot::whereHas('dayPattern', fn ($query) => $query->where('name', 'Friday'))
        ->where('is_break', false)->whereNotIn('start_time', $taken)
        ->whereRaw('(end_time - start_time) = ?::time - ?::time', [$entry->end_time, $entry->start_time])
        ->first();

    if ($to) {
        $this->postJson("/api/terms/{$this->term->id}/sections/{$this->sectionA->id}/slots/{$to->id}/move", [
            'from_slot_id' => $from->id, 'from_days' => [5], 'days' => [5],
        ])->assertOk();

        expect($entry->fresh()->auto_fill_run_id)->toBeNull();
    }
});

it('undoes only its own entries', function () {
    $slot = TimeSlot::whereHas('dayPattern', fn ($query) => $query->where('name', 'Monday – Thursday'))->where('period_no', 1)->first();
    $values = SectionSubject::where('section_id', $this->sectionA->id)->whereHas('subject', fn ($query) => $query->where('name', 'Values Education'))->first();
    $this->putJson("/api/terms/{$this->term->id}/sections/{$this->sectionA->id}/slots/{$slot->id}", [
        'section_subject_id' => $values->id, 'room_id' => $this->sectionA->home_room_id, 'days' => [1, 2, 3, 4],
    ])->assertOk();

    $runId = autoFillConfirm($this)->assertCreated()->json('summary.run_id');

    $this->deleteJson("/api/terms/{$this->term->id}/sections/{$this->sectionA->id}/auto-fill/{$runId}")
        ->assertOk()
        ->assertJsonPath('data.last_auto_fill', null);

    expect(ScheduleEntry::count())->toBe(4)
        ->and(ScheduleEntry::pluck('section_subject_id')->unique()->all())->toBe([$values->id])
        ->and(DB::table('auto_fill_runs')->where('id', $runId)->value('undone_at'))->not->toBeNull();

    // A run can be undone once.
    $this->deleteJson("/api/terms/{$this->term->id}/sections/{$this->sectionA->id}/auto-fill/{$runId}")->assertNotFound();
});

it('is for those who plot the section: the Admin too, but not a teacher', function () {
    $this->actingAs(User::where('email', 'admin@deped.gov.ph')->first());
    autoFillPreview($this)->assertOk();
});

it('is not for teachers', function () {
    $this->actingAs(User::where('email', 'teacher@deped.gov.ph')->first());
    autoFillPreview($this)->assertForbidden();
});

describe('SHS', function () {
    beforeEach(function () {
        $grade = DB::table('grade_levels')->where('grade', 11)->value('id');
        $yearId = $this->sectionA->school_year_id;
        foreach (['AM' => [['06:00', '08:00'], ['08:00', '10:00'], ['10:00', '12:00']], 'PM' => [['12:00', '14:00'], ['14:00', '16:00'], ['16:00', '18:00']]] as $shift => $times) {
            $pattern = DB::table('day_patterns')->insertGetId([
                'school_year_id' => $yearId, 'level' => 'SHS', 'shift' => $shift, 'name' => 'Monday – Friday', 'days' => '{1,2,3,4,5}',
            ]);
            foreach ($times as $index => [$start, $end]) {
                TimeSlot::create(['day_pattern_id' => $pattern, 'period_no' => $index + 1, 'start_time' => $start, 'end_time' => $end, 'is_break' => false]);
            }
        }

        $master = User::factory()->create()->assignRole('master_teacher');
        $master->gradeLevels()->sync([$grade]);
        $this->actingAs($master);

        // Two AM sections share one room and one PE teacher. A PM teacher teaches an AM section.
        $building = DB::table('buildings')->insertGetId(['name' => 'SHS Building']);
        $room = DB::table('rooms')->insertGetId(['building_id' => $building, 'room_number' => 'S1']);
        DB::table('rooms')->where('id', '<>', $room)->update(['is_active' => false]);
        $pe = DB::table('subjects')->insertGetId(['school_year_id' => $yearId, 'grade_level_id' => $grade, 'name' => 'PE', 'minutes_per_week' => 240, 'is_priority' => true]);
        $bio = DB::table('subjects')->insertGetId(['school_year_id' => $yearId, 'grade_level_id' => $grade, 'name' => 'Gen Bio', 'minutes_per_week' => 240]);
        $peTeacher = DB::table('teachers')->insertGetId(['first_name' => 'Pe', 'last_name' => 'Teacher', 'shift' => 'AM']);
        $pmTeacher = DB::table('teachers')->insertGetId(['first_name' => 'Pm', 'last_name' => 'Teacher', 'shift' => 'PM']);

        $this->shs = [];
        foreach (['STEM A', 'STEM B'] as $name) {
            $section = Section::create(['school_year_id' => $yearId, 'grade_level_id' => $grade, 'name' => $name, 'shift' => 'AM', 'home_room_id' => $room]);
            SectionSubject::create(['term_id' => $this->term->id, 'section_id' => $section->id, 'subject_id' => $pe, 'teacher_id' => $peTeacher]);
            $this->shs[] = $section;
        }
        SectionSubject::create(['term_id' => $this->term->id, 'section_id' => $this->shs[0]->id, 'subject_id' => $bio, 'teacher_id' => $pmTeacher]);
    });

    it('shares the one room without a clash, and keeps to the shifts', function () {
        $response = autoFillPreview($this, 'grade', $this->shs[0])->assertOk();
        $this->postJson("/api/terms/{$this->term->id}/sections/{$this->shs[0]->id}/auto-fill", [
            'scope' => 'grade', 'plan_hash' => $response->json('data.plan_hash'),
        ])->assertCreated();

        expect(clashes($this->term->id, 'room_id'))->toBe(0)
            ->and(clashes($this->term->id, 'teacher_id'))->toBe(0)
            ->and(ScheduleEntry::where('start_time', '>=', '12:00')->exists())->toBeFalse();

        $bio = collect($response->json('data.unplaced'))->firstWhere('subject', 'Gen Bio');
        expect($bio['reason'])->toContain('PM shift');
    });

    it('places the priority subject first', function () {
        $plan = app(AutoFillService::class)->preview($this->term, $this->shs[0], 'grade', auth()->user());

        expect(collect($plan['unplaced'])->pluck('subject'))->not->toContain('PE');
    });
});
