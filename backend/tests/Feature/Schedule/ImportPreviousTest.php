<?php

use App\Models\ScheduleEntry;
use App\Models\SchoolTerm;
use App\Models\Section;
use App\Models\SectionSubject;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Support\Facades\DB;

/*
 * Import previous data: the teacher loading of an earlier term, never its plotted schedule.
 */

beforeEach(function () {
    $this->withHeader('Referer', 'http://localhost:5173');
    $this->seed(DatabaseSeeder::class);
    $this->actingAs(User::where('email', 'glc@deped.gov.ph')->first());

    $this->active = SchoolTerm::where('is_active', true)->first();      // Second Term, loaded
    $this->third = SchoolTerm::where('name', 'Third Term')->first();     // empty
    $this->sectionA = Section::where('name', 'Sample A')->first();
});

function importFrom(object $test, SchoolTerm $into, SchoolTerm $from, bool $preview = false)
{
    return $test->postJson("/api/terms/{$into->id}/import-previous", ['from_term_id' => $from->id, 'preview' => $preview]);
}

it('copies the teacher loading of an earlier term in one go', function () {
    $before = SectionSubject::where('term_id', $this->active->id)->count();

    importFrom($this, $this->third, $this->active)
        ->assertOk()
        ->assertJsonPath('data.copied', $before)
        ->assertJsonPath('data.sections', 2);

    expect(SectionSubject::where('term_id', $this->third->id)->count())->toBe($before);
});

it('never copies the plotted schedule: plotting starts as a new draft', function () {
    DB::table('schedule_entries')->insert([
        'term_id' => $this->active->id, 'section_id' => $this->sectionA->id, 'room_id' => $this->sectionA->home_room_id,
        'day_of_week' => 1, 'start_time' => '07:15', 'end_time' => '08:00', 'created_by' => User::first()->id,
    ]);

    importFrom($this, $this->third, $this->active)->assertOk();

    expect(ScheduleEntry::where('term_id', $this->third->id)->count())->toBe(0);
});

it('only previews when asked', function () {
    importFrom($this, $this->third, $this->active, preview: true)->assertOk()->assertJsonPath('data.sections', 2);

    expect(SectionSubject::where('term_id', $this->third->id)->count())->toBe(0);
});

it('keeps what the term already has, and can run twice', function () {
    importFrom($this, $this->third, $this->active)->assertOk();

    importFrom($this, $this->third, $this->active)
        ->assertOk()
        ->assertJsonPath('data.copied', 0)
        ->assertJsonPath('data.already_set', SectionSubject::where('term_id', $this->active->id)->count());
});

it('matches sections and subjects by name across school years', function () {
    // Next school year: same section names and subjects, new records.
    $nextYear = DB::table('school_years')->insertGetId(['name' => '2027-2028', 'start_date' => '2027-06-07', 'end_date' => '2028-03-31', 'term_count' => 3]);
    $nextTerm = SchoolTerm::create(['school_year_id' => $nextYear, 'term_no' => 1, 'name' => 'First Term', 'start_date' => '2027-06-07', 'end_date' => '2027-09-10']);
    $grade = $this->sectionA->grade_level_id;
    $section = Section::create(['school_year_id' => $nextYear, 'grade_level_id' => $grade, 'name' => 'Sample A']);
    DB::table('subjects')->insert([
        ['school_year_id' => $nextYear, 'grade_level_id' => $grade, 'name' => 'Filipino', 'minutes_per_week' => 220],
        ['school_year_id' => $nextYear, 'grade_level_id' => $grade, 'name' => 'Enhanced Mathematics', 'minutes_per_week' => 400],
    ]);

    $response = importFrom($this, $nextTerm, $this->active)->assertOk();

    $copied = SectionSubject::with('subject')->where('term_id', $nextTerm->id)->get();
    expect($copied)->toHaveCount(2)
        ->and($copied->pluck('section_id')->unique()->all())->toBe([$section->id])
        ->and($copied->pluck('subject.name')->sort()->values()->all())->toBe(['Enhanced Mathematics', 'Filipino'])
        ->and($response->json('data.no_section'))->toBeGreaterThan(0)
        ->and($response->json('data.missing'))->toContain('Section Sample B is not in this school year.');
});

it('refuses a later term as the source', function () {
    importFrom($this, $this->active, $this->third)
        ->assertUnprocessable()
        ->assertJsonValidationErrors('from_term_id');
});

it('is for the Admin too, who imports for every grade', function () {
    $this->actingAs(User::where('email', 'admin@deped.gov.ph')->first());

    importFrom($this, $this->third, $this->active)->assertOk()->assertJsonPath('data.sections', 2);
});

it('is not for teachers', function () {
    $this->actingAs(User::where('email', 'teacher@deped.gov.ph')->first());

    importFrom($this, $this->third, $this->active)->assertForbidden();
});

it('stays inside the grade levels of the user', function () {
    $outsider = User::factory()->create()->assignRole('glc');
    $outsider->gradeLevels()->sync([DB::table('grade_levels')->where('grade', 9)->value('id')]);
    $this->actingAs($outsider);

    importFrom($this, $this->third, $this->active)->assertOk()->assertJsonPath('data.copied', 0);
});

it('shows the four steps on the dashboard, with their progress', function () {
    $steps = collect($this->getJson("/api/terms/{$this->active->id}/my-dashboard")->assertOk()->json('data.steps'))->keyBy('key');

    expect($steps->keys()->all())->toBe(['subjects', 'teachers', 'loading', 'plot'])
        ->and($steps['subjects']['done'])->toBeTrue()
        ->and($steps['subjects']['counts'])->toMatchArray(['sections' => 2, 'activities' => 2])
        ->and($steps['loading']['done'])->toBeTrue()
        ->and($steps['plot']['done'])->toBeFalse()
        ->and($steps['plot']['counts'])->toMatchArray(['sections' => 2, 'started' => 0, 'submitted' => 0]);

    $third = collect($this->getJson("/api/terms/{$this->third->id}/my-dashboard")->json('data.steps'))->keyBy('key');
    expect($third['loading']['done'])->toBeFalse()
        ->and($third['loading']['counts']['loaded'])->toBe(0);
});
