<?php

use App\Models\SchoolTerm;
use App\Models\ScheduleEntry;
use App\Models\Section;
use App\Models\SectionSubject;
use App\Models\User;
use App\Services\ReportService;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    $this->withHeader('Referer', 'http://localhost:5173');
    $this->seed(DatabaseSeeder::class);

    $this->term = SchoolTerm::where('is_active', true)->first();
    $this->section = Section::where('name', 'Sample A')->first();
    $this->user = User::where('email', 'glc@deped.gov.ph')->first();
});

function plotMath(object $test, string $status = 'draft'): void
{
    $loading = SectionSubject::where('section_id', $test->section->id)
        ->whereHas('subject', fn ($query) => $query->where('name', 'Enhanced Mathematics'))
        ->first();

    foreach ([1, 2, 3, 4] as $day) {
        ScheduleEntry::create([
            'term_id' => $test->term->id,
            'section_id' => $test->section->id,
            'section_subject_id' => $loading->id,
            'teacher_id' => $loading->teacher_id,
            'room_id' => $test->section->home_room_id,
            'day_of_week' => $day,
            'start_time' => '08:00',
            'end_time' => '09:20',
            'status' => $status,
            'created_by' => $test->user->id,
        ]);
    }
}

it('downloads a PDF', function () {
    plotMath($this);

    $response = $this->actingAs($this->user)
        ->get("/api/terms/{$this->term->id}/sections/{$this->section->id}/class-program.pdf")
        ->assertOk()
        ->assertHeader('Content-Type', 'application/pdf');

    expect($response->getContent())->toStartWith('%PDF')
        ->and($response->headers->get('Content-Disposition'))->toContain('class-program-grade-7-sample-a');
});

it('keeps people outside the scope from downloading', function () {
    $otherGlc = User::factory()->create()->assignRole('glc');
    $otherGlc->gradeLevels()->attach(DB::table('grade_levels')->where('grade', 8)->value('id'));

    $this->actingAs($otherGlc)
        ->getJson("/api/terms/{$this->term->id}/sections/{$this->section->id}/class-program.pdf")
        ->assertForbidden();
});

describe('document contents', function () {
    beforeEach(function () {
        plotMath($this);
        $this->data = app(ReportService::class)->classProgramData($this->term, $this->section);
    });

    it('builds the title from the document settings', function () {
        expect($this->data['title'])->toBe('JHS GRADE 7 – CLASS PROGRAM');
    });

    it('has one block per day pattern with automatic totals', function () {
        [$monThu, $friday] = $this->data['blocks'];

        expect($monThu['name'])->toBe('Monday – Thursday')
            ->and($monThu['total_minutes'])->toBe(595)
            ->and($monThu['class_minutes'])->toBe(555)
            ->and($monThu['duration'])->toBe('9 hours 55 minutes')
            ->and($friday['total_minutes'])->toBe(600)
            ->and($friday['duration'])->toBe('10 hours');
    });

    it('prints subject and teacher in the right slot and marks breaks', function () {
        $rows = collect($this->data['blocks'][0]['rows']);

        expect($rows[2]['time'])->toBe('8:00 – 9:20')
            ->and($rows[2]['subject'])->toBe('Enhanced Mathematics')
            ->and($rows[2]['teacher'])->toBe('Teacher Sample 3')
            ->and($rows[3]['is_break'])->toBeTrue()
            ->and($rows[3]['subject'])->toBe('BREAK');
    });

    it('prints signatories in order and fills Conforme from the section adviser', function () {
        expect(collect($this->data['signatories'])->pluck('label')->all())
            ->toBe(['Prepared by', 'Conforme', 'Recommending Approval', 'Approved by'])
            ->and($this->data['signatories'][1]['name'])->toBe('Teacher Sample 1')
            ->and($this->data['signatories'][1]['position'])->toBe('Class Adviser');
    });

    it('uses the display name when a teacher has one', function () {
        DB::table('teachers')->where('id', $this->section->adviser_id)->update(['display_name' => 'T. Sample']);

        $data = app(ReportService::class)->classProgramData($this->term, $this->section->fresh());

        expect($data['adviser'])->toBe('T. Sample');
    });
});

describe('draft watermark', function () {
    it('marks an unapproved schedule as draft', function () {
        plotMath($this);

        expect(app(ReportService::class)->classProgramData($this->term, $this->section)['isDraft'])->toBeTrue();
    });

    it('marks an empty schedule as draft', function () {
        expect(app(ReportService::class)->classProgramData($this->term, $this->section)['isDraft'])->toBeTrue();
    });

    it('removes the mark when every entry is approved', function () {
        plotMath($this, 'approved');

        expect(app(ReportService::class)->classProgramData($this->term, $this->section)['isDraft'])->toBeFalse();
    });
});
