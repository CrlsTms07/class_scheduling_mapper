<?php

use App\Models\ScheduleEntry;
use App\Models\SchoolTerm;
use App\Models\Section;
use App\Models\SectionSubject;
use App\Models\User;
use App\Services\ApprovalService;
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

/** Adds one entry directly, for a section's subject, without going through the plotter. */
function entryFor(object $test, Section $section, string $subject, array $overrides = []): ScheduleEntry
{
    $loading = SectionSubject::where('section_id', $section->id)
        ->whereHas('subject', fn ($query) => $query->where('name', $subject))
        ->first();

    return ScheduleEntry::create([
        'term_id' => $test->termId,
        'section_id' => $section->id,
        'section_subject_id' => $loading->id,
        'teacher_id' => $loading->teacher_id,
        'room_id' => $section->home_room_id,
        'day_of_week' => 1,
        'start_time' => '08:00',
        'end_time' => '09:20',
        'created_by' => $test->glc->id,
        ...$overrides,
    ]);
}

function plotterUrl(object $test, Section $section): string
{
    return "/api/terms/{$test->termId}/sections/{$section->id}";
}

/** The key of every flag this section has now, so a test can acknowledge them all. */
function allFlagKeys(object $test, Section $section): array
{
    return collect($test->getJson(plotterUrl($test, $section).'/plotter')->json('data.flags'))
        ->where('acknowledged', false)
        ->pluck('key')
        ->all();
}

function submitAll(object $test, Section $section)
{
    return $test->postJson(plotterUrl($test, $section).'/submit', [
        'acknowledged_flags' => allFlagKeys($test, $section),
    ]);
}

function review(object $test, array $data)
{
    return $test->postJson("/api/terms/{$test->termId}/approvals", $data);
}

function entryStatuses(Section $section): array
{
    return ScheduleEntry::where('section_id', $section->id)->pluck('status')->unique()->values()->all();
}

describe('submitting', function () {
    beforeEach(function () {
        $this->actingAs($this->glc);
    });

    it('moves draft entries to pending once every flag is acknowledged', function () {
        entryFor($this, $this->sectionA, 'Filipino');

        submitAll($this, $this->sectionA)->assertOk();

        expect(entryStatuses($this->sectionA))->toBe(['pending']);
    });

    it('is blocked while a flag is not acknowledged, and says which', function () {
        entryFor($this, $this->sectionA, 'Filipino');

        $this->postJson(plotterUrl($this, $this->sectionA).'/submit', ['acknowledged_flags' => []])
            ->assertUnprocessable()
            ->assertJsonPath('code', 'flags_not_acknowledged')
            ->assertJsonPath('flags.0.acknowledged', false);

        expect(entryStatuses($this->sectionA))->toBe(['draft']);
    });

    it('remembers acknowledgements, with who and why', function () {
        entryFor($this, $this->sectionA, 'Filipino');

        $keys = allFlagKeys($this, $this->sectionA);

        $this->postJson(plotterUrl($this, $this->sectionA).'/submit', [
            'acknowledged_flags' => $keys,
            'note' => 'Client approved a shorter week.',
        ])->assertOk();

        $saved = DB::table('schedule_flag_acknowledgements')->where('section_id', $this->sectionA->id)->first();

        expect(DB::table('schedule_flag_acknowledgements')->count())->toBe(count($keys))
            ->and($saved->acknowledged_by)->toBe($this->glc->id)
            ->and($saved->note)->toBe('Client approved a shorter week.');
    });

    it('needs a new acknowledgement when the problem changes', function () {
        $entry = entryFor($this, $this->sectionA, 'Filipino');
        $before = allFlagKeys($this, $this->sectionA);

        DB::table('schedule_flag_acknowledgements')->insert(array_map(fn ($key) => [
            'term_id' => $this->termId, 'section_id' => $this->sectionA->id, 'flag_key' => $key, 'acknowledged_by' => $this->glc->id,
        ], $before));

        expect(allFlagKeys($this, $this->sectionA))->toBe([]);

        $entry->update(['end_time' => '09:00']);

        $filipino = collect($this->getJson(plotterUrl($this, $this->sectionA).'/plotter')->json('data.flags'))
            ->first(fn ($flag) => str_contains($flag['message'], 'Filipino'));

        expect($filipino['acknowledged'])->toBeFalse();
    });

    it('refuses open slots, which cannot be acknowledged', function () {
        entryFor($this, $this->sectionA, 'Filipino', ['section_subject_id' => null, 'teacher_id' => null]);

        submitAll($this, $this->sectionA)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('section');

        expect(entryStatuses($this->sectionA))->toBe(['draft']);
    });

    it('refuses a section with nothing plotted', function () {
        submitAll($this, $this->sectionA)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('section');
    });

    it('writes an audit log', function () {
        entryFor($this, $this->sectionA, 'Filipino');

        submitAll($this, $this->sectionA)->assertOk();

        expect(DB::table('audit_logs')->where('action', 'submit')->value('record_id'))->toBe($this->sectionA->id);
    });

    it('locks the whole section while pending', function () {
        entryFor($this, $this->sectionA, 'Filipino');
        submitAll($this, $this->sectionA)->assertOk();

        $slot = DB::table('time_slots')->where('start_time', '06:30')->where('end_time', '07:15')->value('id');
        $loading = SectionSubject::where('section_id', $this->sectionA->id)->value('id');

        $this->putJson(plotterUrl($this, $this->sectionA)."/slots/{$slot}", [
            'section_subject_id' => $loading,
            'room_id' => $this->sectionA->home_room_id,
            'days' => [2],
        ])->assertUnprocessable()->assertJsonValidationErrors('days');

        $this->getJson(plotterUrl($this, $this->sectionA).'/plotter')
            ->assertJsonPath('data.can_edit', false)
            ->assertJsonPath('data.status', 'pending');
    });

    it('is not for the Admin', function () {
        entryFor($this, $this->sectionA, 'Filipino');

        $this->actingAs($this->admin);

        $this->postJson(plotterUrl($this, $this->sectionA).'/submit', ['acknowledged_flags' => []])->assertForbidden();
    });

    it('is not for a GLC of another grade level', function () {
        entryFor($this, $this->sectionA, 'Filipino');
        $other = User::factory()->create()->assignRole('glc');
        $other->gradeLevels()->attach(DB::table('grade_levels')->where('grade', 8)->value('id'));

        $this->actingAs($other);

        $this->postJson(plotterUrl($this, $this->sectionA).'/submit', ['acknowledged_flags' => []])->assertForbidden();
    });
});

describe('reviewing', function () {
    beforeEach(function () {
        $this->actingAs($this->admin);
    });

    it('approves one section and records one review', function () {
        entryFor($this, $this->sectionA, 'Filipino', ['status' => 'pending']);
        entryFor($this, $this->sectionB, 'Enhanced English', ['status' => 'pending']);

        review($this, ['scope' => 'section', 'scope_ref_id' => $this->sectionA->id, 'action' => 'approve'])
            ->assertOk()
            ->assertJsonPath('data.entries', 1)
            ->assertJsonPath('data.sections', 1);

        expect(entryStatuses($this->sectionA))->toBe(['approved'])
            ->and(entryStatuses($this->sectionB))->toBe(['pending'])
            ->and(DB::table('schedule_reviews')->count())->toBe(1)
            ->and(ScheduleEntry::where('section_id', $this->sectionA->id)->value('review_id'))
            ->toBe(DB::table('schedule_reviews')->value('id'));
    });

    it('approves by grade level', function () {
        entryFor($this, $this->sectionA, 'Filipino', ['status' => 'pending']);
        entryFor($this, $this->sectionB, 'Enhanced English', ['status' => 'pending']);

        review($this, ['scope' => 'grade_level', 'scope_ref_id' => $this->sectionA->grade_level_id, 'action' => 'approve'])
            ->assertOk()
            ->assertJsonPath('data.sections', 2);
    });

    it('approves a whole department or everything with one review row', function (string $scope) {
        entryFor($this, $this->sectionA, 'Filipino', ['status' => 'pending']);
        entryFor($this, $this->sectionB, 'Enhanced English', ['status' => 'pending']);

        review($this, ['scope' => $scope, 'action' => 'approve'])->assertOk()->assertJsonPath('data.entries', 2);

        expect(DB::table('schedule_reviews')->count())->toBe(1);
    })->with(['JHS', 'all']);

    it('leaves other departments out of a department scope', function () {
        entryFor($this, $this->sectionA, 'Filipino', ['status' => 'pending']);

        review($this, ['scope' => 'SHS', 'action' => 'approve'])->assertUnprocessable();

        expect(entryStatuses($this->sectionA))->toBe(['pending']);
    });

    it('leaves drafts alone when approving', function () {
        entryFor($this, $this->sectionA, 'Filipino', ['status' => 'pending']);
        entryFor($this, $this->sectionB, 'Enhanced English');

        review($this, ['scope' => 'all', 'action' => 'approve'])->assertOk();

        expect(entryStatuses($this->sectionB))->toBe(['draft']);
    });

    it('refuses when there is nothing to review', function () {
        review($this, ['scope' => 'all', 'action' => 'approve'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('scope');

        expect(DB::table('schedule_reviews')->count())->toBe(0);
    });

    it('needs remarks to reject or reopen', function (string $action) {
        entryFor($this, $this->sectionA, 'Filipino', ['status' => 'pending']);

        review($this, ['scope' => 'all', 'action' => $action])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('remarks');
    })->with(['reject', 'reopen']);

    it('rejects with remarks', function () {
        entryFor($this, $this->sectionA, 'Filipino', ['status' => 'pending']);

        review($this, ['scope' => 'section', 'scope_ref_id' => $this->sectionA->id, 'action' => 'reject', 'remarks' => 'Please fix Filipino.'])
            ->assertOk();

        expect(entryStatuses($this->sectionA))->toBe(['rejected'])
            ->and(DB::table('schedule_reviews')->value('remarks'))->toBe('Please fix Filipino.');
    });

    it('reopens approved entries back to draft', function () {
        entryFor($this, $this->sectionA, 'Filipino', ['status' => 'approved']);

        review($this, ['scope' => 'section', 'scope_ref_id' => $this->sectionA->id, 'action' => 'reopen', 'remarks' => 'Teacher resigned.'])
            ->assertOk();

        expect(entryStatuses($this->sectionA))->toBe(['draft']);
    });

    it('writes an audit log', function () {
        entryFor($this, $this->sectionA, 'Filipino', ['status' => 'pending']);

        review($this, ['scope' => 'all', 'action' => 'approve'])->assertOk();

        expect(json_decode(DB::table('audit_logs')->where('action', 'approve')->value('new_data'))->entries)->toBe(1);
    });

    it('refuses a section from another school year', function () {
        review($this, ['scope' => 'section', 'scope_ref_id' => 999999, 'action' => 'approve'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('scope_ref_id');
    });

    it('needs a reference for the section and grade level scopes', function (string $scope) {
        review($this, ['scope' => $scope, 'action' => 'approve'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('scope_ref_id');
    })->with(['section', 'grade_level']);

    it('shows every section with its status, counts and flags', function () {
        entryFor($this, $this->sectionA, 'Filipino', ['status' => 'pending']);

        $data = $this->getJson("/api/terms/{$this->termId}/approvals")->assertOk()->json('data');
        $sampleA = collect($data)->firstWhere('name', 'Sample A');

        expect($data)->toHaveCount(2)
            ->and($sampleA['status'])->toBe('pending')
            ->and($sampleA['pending_count'])->toBe(1)
            ->and($sampleA['flags'])->not->toBeEmpty();
    });
});

describe('access to reviewing', function () {
    it('is only for the Admin', function (string $email) {
        entryFor($this, $this->sectionA, 'Filipino', ['status' => 'pending']);
        $this->actingAs(User::where('email', $email)->first());

        review($this, ['scope' => 'all', 'action' => 'approve'])->assertForbidden();
        $this->getJson("/api/terms/{$this->termId}/approvals")->assertForbidden();

        expect(entryStatuses($this->sectionA))->toBe(['pending']);
    })->with(['glc@deped.gov.ph', 'master.teacher@deped.gov.ph', 'teacher@deped.gov.ph']);
});

describe('after a rejection', function () {
    beforeEach(function () {
        $this->actingAs($this->glc);
    });

    it('shows the entries and the remarks, and locks editing until revised', function () {
        entryFor($this, $this->sectionA, 'Filipino', ['status' => 'pending']);
        app(ApprovalService::class)->review(SchoolTerm::find($this->termId), 'all', null, 'reject', 'Please fix Filipino.', $this->admin);

        $data = $this->getJson(plotterUrl($this, $this->sectionA).'/plotter')->json('data');

        expect($data['status'])->toBe('rejected')
            ->and($data['can_edit'])->toBeFalse()
            ->and($data['entries'])->toHaveCount(1)
            ->and($data['last_review']['action'])->toBe('reject')
            ->and($data['last_review']['remarks'])->toBe('Please fix Filipino.');
    });

    it('brings entries back to draft when revised', function () {
        entryFor($this, $this->sectionA, 'Filipino', ['status' => 'rejected']);

        $this->postJson(plotterUrl($this, $this->sectionA).'/revise')
            ->assertOk()
            ->assertJsonPath('removed', [])
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.can_edit', true);
    });

    it('reports an entry whose room was taken, and restores the rest', function () {
        entryFor($this, $this->sectionA, 'Filipino', ['status' => 'rejected']);
        entryFor($this, $this->sectionA, 'Enhanced English', ['status' => 'rejected', 'day_of_week' => 2]);

        // Another section takes the room on Monday while Sample A is rejected.
        entryFor($this, $this->sectionB, 'MAPEH', ['room_id' => $this->sectionA->home_room_id]);

        $response = $this->postJson(plotterUrl($this, $this->sectionA).'/revise')->assertOk();

        expect($response->json('removed'))->toHaveCount(1)
            ->and($response->json('removed.0'))->toContain('Filipino')->toContain('Grade 7 – Sample B')
            ->and(ScheduleEntry::where('section_id', $this->sectionA->id)->count())->toBe(1)
            ->and(entryStatuses($this->sectionA))->toBe(['draft']);
    });

    it('only works on a rejected schedule', function () {
        entryFor($this, $this->sectionA, 'Filipino');

        $this->postJson(plotterUrl($this, $this->sectionA).'/revise')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('section');
    });

    it('is not for the Admin', function () {
        entryFor($this, $this->sectionA, 'Filipino', ['status' => 'rejected']);

        $this->actingAs($this->admin);

        $this->postJson(plotterUrl($this, $this->sectionA).'/revise')->assertForbidden();
    });
});
