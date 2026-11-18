<?php

use App\Models\ScheduleEntry;
use App\Models\Section;
use App\Models\SectionSubject;
use App\Models\TimeSlot;
use App\Models\User;
use App\Services\ConflictService;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    $this->withHeader('Referer', 'http://localhost:5173');
    $this->seed(DatabaseSeeder::class);

    $this->glc = User::where('email', 'glc@deped.gov.ph')->first();
    $this->admin = User::where('email', 'admin@deped.gov.ph')->first();
    $this->termId = DB::table('school_terms')->where('is_active', true)->value('id');
    $this->sectionA = Section::where('name', 'Sample A')->first();
    $this->sectionB = Section::where('name', 'Sample B')->first();
});

function loadingFor(Section $section, string $subject): SectionSubject
{
    return SectionSubject::where('section_id', $section->id)
        ->whereHas('subject', fn ($query) => $query->where('name', $subject))
        ->first();
}

/** A time slot of the seeded JHS bell schedule, such as ('Friday', 1). */
function slotOf(string $pattern, ?int $period, bool $isBreak = false): TimeSlot
{
    return TimeSlot::whereHas('dayPattern', fn ($query) => $query->where('name', $pattern))
        ->where('is_break', $isBreak)
        ->when($period, fn ($query) => $query->where('period_no', $period))
        ->first();
}

function assign(object $test, Section $section, TimeSlot $slot, array $data)
{
    return $test->putJson("/api/terms/{$test->termId}/sections/{$section->id}/slots/{$slot->id}", $data);
}

function mathInSlot(Section $section, array $days = [1, 2, 3, 4], ?int $roomId = null): array
{
    return [
        'section_subject_id' => loadingFor($section, 'Enhanced Mathematics')->id,
        'room_id' => $roomId ?? $section->home_room_id,
        'days' => $days,
    ];
}

describe('assigning a subject', function () {
    it('saves one entry per selected day with the time of the slot', function () {
        $this->actingAs($this->glc);

        assign($this, $this->sectionA, slotOf('Monday – Thursday', 3), mathInSlot($this->sectionA))
            ->assertOk()
            ->assertJsonCount(4, 'data.entries');

        $entries = ScheduleEntry::where('section_id', $this->sectionA->id)->orderBy('day_of_week')->get();

        expect($entries->pluck('day_of_week')->all())->toBe([1, 2, 3, 4])
            ->and($entries->first()->start_time)->toBe('08:00:00')
            ->and($entries->first()->end_time)->toBe('09:20:00')
            ->and($entries->first()->status)->toBe('draft')
            ->and($entries->first()->created_by)->toBe($this->glc->id);
    });

    it('can place a subject on only some days of a pattern', function () {
        $this->actingAs($this->glc);

        assign($this, $this->sectionA, slotOf('Monday – Thursday', 3), mathInSlot($this->sectionA, [1, 3]))
            ->assertOk();

        expect(ScheduleEntry::where('section_id', $this->sectionA->id)->pluck('day_of_week')->sort()->values()->all())
            ->toBe([1, 3]);
    });

    it('allows a different subject per day in the same slot', function () {
        $this->actingAs($this->glc);
        $slot = slotOf('Monday – Thursday', 3);

        assign($this, $this->sectionA, $slot, mathInSlot($this->sectionA, [1]))->assertOk();
        assign($this, $this->sectionA, $slot, [
            'section_subject_id' => loadingFor($this->sectionA, 'Filipino')->id,
            'room_id' => $this->sectionA->home_room_id,
            'days' => [2],
        ])->assertOk();

        expect(ScheduleEntry::where('section_id', $this->sectionA->id)->count())->toBe(2);
    });

    it('replaces what the section already has in that slot', function () {
        $this->actingAs($this->glc);
        $slot = slotOf('Friday', 1);

        assign($this, $this->sectionA, $slot, mathInSlot($this->sectionA, [5]))->assertOk();
        assign($this, $this->sectionA, $slot, [
            'section_subject_id' => loadingFor($this->sectionA, 'Filipino')->id,
            'room_id' => $this->sectionA->home_room_id,
            'days' => [5],
        ])->assertOk()->assertJsonPath('data.entries.0.subject', 'Filipino');

        expect(ScheduleEntry::where('section_id', $this->sectionA->id)->count())->toBe(1);
    });

    it('clears a slot on the selected days', function () {
        $this->actingAs($this->glc);
        $slot = slotOf('Monday – Thursday', 3);
        assign($this, $this->sectionA, $slot, mathInSlot($this->sectionA))->assertOk();

        $this->deleteJson("/api/terms/{$this->termId}/sections/{$this->sectionA->id}/slots/{$slot->id}", ['days' => [1, 2]])
            ->assertOk();

        expect(ScheduleEntry::where('section_id', $this->sectionA->id)->pluck('day_of_week')->sort()->values()->all())
            ->toBe([3, 4]);
    });
});

describe('hard conflicts', function () {
    it('blocks a teacher conflict and says who and when, saving nothing', function () {
        $this->actingAs($this->glc);
        $slot = slotOf('Monday – Thursday', 3);
        assign($this, $this->sectionA, $slot, mathInSlot($this->sectionA))->assertOk();

        $response = assign($this, $this->sectionB, $slot, mathInSlot($this->sectionB))
            ->assertUnprocessable()
            ->assertJsonPath('code', 'schedule_conflict')
            ->assertJsonPath('conflicts.0.type', 'teacher');

        expect($response->json('conflicts.0.message'))
            ->toContain('Grade 7 – Sample A')
            ->toContain('Monday, Tuesday, Wednesday and Thursday at 8:00 AM')
            ->and($response->json('conflicts'))->toHaveCount(1)
            ->and($response->json('conflicts.0.days'))->toBe([1, 2, 3, 4])
            ->and(ScheduleEntry::where('section_id', $this->sectionB->id)->count())->toBe(0);
    });

    it('blocks a room conflict', function () {
        $this->actingAs($this->glc);
        $slot = slotOf('Monday – Thursday', 3);
        assign($this, $this->sectionA, $slot, mathInSlot($this->sectionA))->assertOk();

        assign($this, $this->sectionB, $slot, [
            'section_subject_id' => loadingFor($this->sectionB, 'Filipino')->id,
            'room_id' => $this->sectionA->home_room_id,
            'days' => [1],
        ])
            ->assertUnprocessable()
            ->assertJsonPath('conflicts.0.type', 'room');
    });

    it('saves none of the days when only one day conflicts', function () {
        $this->actingAs($this->glc);
        $slot = slotOf('Monday – Thursday', 3);
        assign($this, $this->sectionA, $slot, mathInSlot($this->sectionA, [2]))->assertOk();

        assign($this, $this->sectionB, $slot, mathInSlot($this->sectionB))->assertUnprocessable();

        expect(ScheduleEntry::where('section_id', $this->sectionB->id)->count())->toBe(0);
    });

    it('suggests free rooms and free periods', function () {
        $this->actingAs($this->glc);
        $slot = slotOf('Monday – Thursday', 3);
        assign($this, $this->sectionA, $slot, mathInSlot($this->sectionA))->assertOk();

        $response = assign($this, $this->sectionB, $slot, [
            'section_subject_id' => loadingFor($this->sectionB, 'Filipino')->id,
            'room_id' => $this->sectionA->home_room_id,
            'days' => [1],
        ])->assertUnprocessable();

        expect(collect($response->json('suggestions.rooms'))->pluck('id'))
            ->not->toContain($this->sectionA->home_room_id)
            ->toContain($this->sectionB->home_room_id)
            ->and($response->json('suggestions.slots'))->not->toBeEmpty()
            ->and(collect($response->json('suggestions.slots'))->pluck('id'))->not->toContain($slot->id);
    });

    it('allows the next period right after, with the same teacher and room', function () {
        $this->actingAs($this->glc);
        assign($this, $this->sectionA, slotOf('Monday – Thursday', 1), mathInSlot($this->sectionA))->assertOk();

        assign($this, $this->sectionB, slotOf('Monday – Thursday', 2), mathInSlot($this->sectionB, roomId: $this->sectionA->home_room_id))
            ->assertOk();
    });

    it('ignores another section\'s rejected entries', function () {
        $this->actingAs($this->glc);
        $slot = slotOf('Monday – Thursday', 3);
        assign($this, $this->sectionA, $slot, mathInSlot($this->sectionA))->assertOk();
        ScheduleEntry::where('section_id', $this->sectionA->id)->update(['status' => 'rejected']);

        assign($this, $this->sectionB, $slot, mathInSlot($this->sectionB))->assertOk();
    });

    it('turns a conflict caught only by the database into the same message', function () {
        $this->actingAs($this->glc);
        $slot = slotOf('Monday – Thursday', 3);
        assign($this, $this->sectionA, $slot, mathInSlot($this->sectionA))->assertOk();

        // The first check sees nothing, as if the other user saved a moment later.
        $real = app(ConflictService::class);
        $this->mock(ConflictService::class, function ($mock) use ($real) {
            $mock->shouldReceive('findConflicts')->once()->andReturn([]);
            $mock->shouldReceive('findConflicts')->andReturnUsing(fn (...$args) => $real->findConflicts(...$args));
            $mock->shouldReceive('suggest')->andReturnUsing(fn (...$args) => $real->suggest(...$args));
        });

        assign($this, $this->sectionB, $slot, mathInSlot($this->sectionB))
            ->assertUnprocessable()
            ->assertJsonPath('code', 'schedule_conflict');
    });
});

describe('validation', function () {
    it('refuses to place a class on a break', function () {
        $this->actingAs($this->glc);

        assign($this, $this->sectionA, slotOf('Monday – Thursday', null, isBreak: true), mathInSlot($this->sectionA))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('time_slot');
    });

    it('refuses a day outside the slot\'s pattern', function () {
        $this->actingAs($this->glc);

        assign($this, $this->sectionA, slotOf('Friday', 1), mathInSlot($this->sectionA, [1]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('days');
    });

    it('refuses a subject loaded on another section', function () {
        $this->actingAs($this->glc);

        assign($this, $this->sectionA, slotOf('Friday', 1), [
            ...mathInSlot($this->sectionA, [5]),
            'section_subject_id' => loadingFor($this->sectionB, 'Filipino')->id,
        ])->assertUnprocessable()->assertJsonValidationErrors('section_subject_id');
    });

    it('refuses a room that is not active', function () {
        $this->actingAs($this->glc);
        DB::table('rooms')->where('id', $this->sectionA->home_room_id)->update(['is_active' => false]);

        assign($this, $this->sectionA, slotOf('Friday', 1), mathInSlot($this->sectionA, [5]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('room_id');
    });

    it('does not change approved entries', function () {
        $this->actingAs($this->glc);
        $slot = slotOf('Friday', 1);
        assign($this, $this->sectionA, $slot, mathInSlot($this->sectionA, [5]))->assertOk();
        ScheduleEntry::where('section_id', $this->sectionA->id)->update(['status' => 'approved']);

        assign($this, $this->sectionA, $slot, [
            'section_subject_id' => loadingFor($this->sectionA, 'Filipino')->id,
            'room_id' => $this->sectionA->home_room_id,
            'days' => [5],
        ])->assertUnprocessable()->assertJsonValidationErrors('days');

        $this->deleteJson("/api/terms/{$this->termId}/sections/{$this->sectionA->id}/slots/{$slot->id}", ['days' => [5]])
            ->assertUnprocessable();

        expect(ScheduleEntry::where('section_id', $this->sectionA->id)->count())->toBe(1);
    });
});

describe('access', function () {
    it('stops a GLC from plotting outside their grade levels', function () {
        $otherGlc = User::factory()->create()->assignRole('glc');
        $otherGlc->gradeLevels()->attach(DB::table('grade_levels')->where('grade', 8)->value('id'));
        $this->actingAs($otherGlc);

        assign($this, $this->sectionA, slotOf('Friday', 1), mathInSlot($this->sectionA, [5]))->assertForbidden();
        $this->getJson("/api/terms/{$this->termId}/sections/{$this->sectionA->id}/plotter")->assertForbidden();
    });

    it('lets the Admin plot any section too (team decision, Nov 10, 2026)', function () {
        $this->actingAs($this->admin);

        $this->getJson("/api/terms/{$this->termId}/sections/{$this->sectionA->id}/plotter")
            ->assertOk()
            ->assertJsonPath('data.can_plot', true);

        assign($this, $this->sectionA, slotOf('Friday', 1), mathInSlot($this->sectionA, [5]))->assertOk();
    });

    it('keeps teachers out of the plotter', function () {
        $this->actingAs(User::where('email', 'teacher@deped.gov.ph')->first());

        $this->getJson("/api/terms/{$this->termId}/sections/{$this->sectionA->id}/plotter")->assertForbidden();
    });

    it('requires signing in', function () {
        $this->getJson("/api/terms/{$this->termId}/sections/{$this->sectionA->id}/plotter")->assertUnauthorized();
    });

    it('returns 404 when the section belongs to another school year', function () {
        $otherYear = DB::table('school_years')->insertGetId(['name' => '2027-2028', 'start_date' => '2027-06-01', 'end_date' => '2028-03-31']);
        $otherTerm = DB::table('school_terms')->insertGetId([
            'school_year_id' => $otherYear, 'term_no' => 1, 'name' => 'First Term', 'start_date' => '2027-06-01', 'end_date' => '2027-09-30',
        ]);
        $this->actingAs($this->glc);

        $this->getJson("/api/terms/{$otherTerm}/sections/{$this->sectionA->id}/plotter")->assertNotFound();
    });
});

describe('plotter data', function () {
    beforeEach(function () {
        $this->actingAs($this->glc);
    });

    it('returns both bell schedules with their days and slots', function () {
        $data = $this->getJson("/api/terms/{$this->termId}/sections/{$this->sectionA->id}/plotter")->assertOk()->json('data');

        expect(collect($data['patterns'])->pluck('name')->all())->toBe(['Monday – Thursday', 'Friday'])
            ->and($data['patterns'][0]['days'])->toBe([1, 2, 3, 4])
            ->and($data['patterns'][0]['slots'][0]['start_time'])->toBe('06:30')
            ->and($data['patterns'][0]['slots'][0]['minutes'])->toBe(45)
            ->and($data['loading'])->toHaveCount(11)
            ->and($data['status'])->toBe('not_started')
            ->and($data['can_plot'])->toBeTrue();
    });

    it('lists priority subjects first in the loading', function () {
        $data = $this->getJson("/api/terms/{$this->termId}/sections/{$this->sectionA->id}/plotter")->json('data');

        expect($data['loading'][0]['subject'])->toBe('Homeroom Guidance');
    });

    it('counts scheduled minutes per subject', function () {
        assign($this, $this->sectionA, slotOf('Monday – Thursday', 3), mathInSlot($this->sectionA))->assertOk();

        $data = $this->getJson("/api/terms/{$this->termId}/sections/{$this->sectionA->id}/plotter")->json('data');
        $math = collect($data['loading'])->firstWhere('subject', 'Enhanced Mathematics');

        expect($math['scheduled_minutes'])->toBe(320)
            ->and($math['required_minutes'])->toBe(400)
            ->and($data['status'])->toBe('draft');
    });

    it('flags a subject under its minutes in amber', function () {
        assign($this, $this->sectionA, slotOf('Monday – Thursday', 3), mathInSlot($this->sectionA))->assertOk();

        $data = $this->getJson("/api/terms/{$this->termId}/sections/{$this->sectionA->id}/plotter")->json('data');
        $flag = collect($data['flags'])->first(fn ($flag) => str_contains($flag['message'], 'Enhanced Mathematics'));

        expect($flag['type'])->toBe('minutes_under')
            ->and($flag['severity'])->toBe('amber')
            ->and($flag['message'])->toContain('320 of 400');
    });

    it('flags Homeroom over 60 minutes in red', function () {
        assign($this, $this->sectionA, slotOf('Monday – Thursday', 3), [
            'section_subject_id' => loadingFor($this->sectionA, 'Homeroom Guidance')->id,
            'room_id' => $this->sectionA->home_room_id,
            'days' => [1],
        ])->assertOk();

        $data = $this->getJson("/api/terms/{$this->termId}/sections/{$this->sectionA->id}/plotter")->json('data');
        $flag = collect($data['flags'])->first(fn ($flag) => str_contains($flag['message'], 'Homeroom Guidance'));

        expect($flag['type'])->toBe('minutes_over')
            ->and($flag['severity'])->toBe('red')
            ->and($flag['message'])->toContain('80 of 60');
    });

    it('flags a section without an adviser', function () {
        DB::table('sections')->where('id', $this->sectionA->id)->update(['adviser_id' => null]);

        $flags = $this->getJson("/api/terms/{$this->termId}/sections/{$this->sectionA->id}/plotter")->json('data.flags');

        expect(collect($flags)->pluck('type'))->toContain('no_adviser');
    });

    it('flags an entry left on a break after the bell schedule changes', function () {
        assign($this, $this->sectionA, slotOf('Monday – Thursday', 3), mathInSlot($this->sectionA))->assertOk();
        slotOf('Monday – Thursday', 3)->update(['end_time' => '09:00']);
        slotOf('Monday – Thursday', null, isBreak: true)->update(['start_time' => '09:00', 'end_time' => '09:40']);

        $flags = $this->getJson("/api/terms/{$this->termId}/sections/{$this->sectionA->id}/plotter")->json('data.flags');

        expect(collect($flags)->pluck('type'))->toContain('overlaps_break');
    });

    it('flags a teacher whose shift does not cover the entry', function () {
        $slot = slotOf('Monday – Thursday', 10);
        assign($this, $this->sectionA, $slot, mathInSlot($this->sectionA, [1]))->assertOk();

        $loading = loadingFor($this->sectionA, 'Enhanced Mathematics');
        DB::table('teachers')->where('id', $loading->teacher_id)->update(['shift' => 'AM']);
        $patternId = DB::table('day_patterns')->insertGetId([
            'school_year_id' => $this->sectionA->school_year_id, 'level' => 'JHS', 'shift' => 'AM', 'name' => 'Morning', 'days' => '{1,2,3,4,5}',
        ]);
        DB::table('time_slots')->insert(['day_pattern_id' => $patternId, 'period_no' => 1, 'start_time' => '06:30', 'end_time' => '12:00']);

        $flags = $this->getJson("/api/terms/{$this->termId}/sections/{$this->sectionA->id}/plotter")->json('data.flags');

        expect(collect($flags)->pluck('type'))->toContain('teacher_shift');
    });

    it('flags a teacher over the limit', function () {
        $loading = loadingFor($this->sectionA, 'Filipino');
        DB::table('teachers')->where('id', $loading->teacher_id)->update(['max_subjects' => 1]);

        $flags = $this->getJson("/api/terms/{$this->termId}/sections/{$this->sectionA->id}/plotter")->json('data.flags');

        expect(collect($flags)->pluck('type'))->toContain('teacher_overloaded');
    });
});

describe('terms and sections', function () {
    it('lists the terms with the active one marked', function () {
        $this->actingAs($this->glc);

        $terms = $this->getJson('/api/terms')->assertOk()->json('data');

        expect($terms)->toHaveCount(3)
            ->and(collect($terms)->where('is_active', true)->pluck('name')->all())->toBe(['Second Term'])
            ->and($terms[0]['school_year']['term_label'])->toBe('Term');
    });

    it('hides sections outside the scope', function () {
        $otherGlc = User::factory()->create()->assignRole('glc');
        $otherGlc->gradeLevels()->attach(DB::table('grade_levels')->where('grade', 8)->value('id'));

        $this->actingAs($otherGlc)->getJson("/api/terms/{$this->termId}/sections")
            ->assertOk()
            ->assertJsonCount(0, 'data');
    });

    it('lists the sections inside the scope, with their status', function () {
        $this->actingAs($this->glc)->getJson("/api/terms/{$this->termId}/sections")
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.status', 'not_started');
    });
});

describe('section_term_status view', function () {
    function statusOf(object $test): string
    {
        return DB::table('section_term_status')
            ->where('term_id', $test->termId)
            ->where('section_id', $test->sectionA->id)
            ->value('status');
    }

    it('moves from not started through the review states', function () {
        $this->actingAs($this->glc);
        expect(statusOf($this))->toBe('not_started');

        assign($this, $this->sectionA, slotOf('Friday', 1), mathInSlot($this->sectionA, [5]))->assertOk();
        expect(statusOf($this))->toBe('draft');

        $entries = ScheduleEntry::where('section_id', $this->sectionA->id);

        $entries->update(['status' => 'pending']);
        expect(statusOf($this))->toBe('pending');

        $entries->update(['status' => 'approved']);
        expect(statusOf($this))->toBe('approved');

        $entries->update(['status' => 'rejected']);
        expect(statusOf($this))->toBe('rejected');
    });
});
