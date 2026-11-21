<?php

use App\Models\SchoolTerm;
use App\Models\Section;
use App\Models\User;
use App\Services\ReportService;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    $this->withHeader('Referer', 'http://localhost:5173');
    $this->seed(ReferenceDataSeeder::class);

    $this->admin = User::factory()->create()->assignRole('super_admin');
    $this->actingAs($this->admin);

    $this->yearId = DB::table('school_years')->insertGetId([
        'name' => '2026-2027', 'start_date' => '2026-06-01', 'end_date' => '2027-03-31',
    ]);
    $this->termIds = [];
    foreach ([1, 2, 3] as $termNo) {
        $this->termIds[$termNo] = DB::table('school_terms')->insertGetId([
            'school_year_id' => $this->yearId, 'term_no' => $termNo, 'name' => "Term {$termNo}",
            'start_date' => "2026-0{$termNo}-01", 'end_date' => "2026-0{$termNo}-20",
        ]);
    }
});

function profileBody(array $overrides = []): array
{
    return ['phone' => '(046) 894-1463', 'email' => 'school@deped.gov.ph', 'facebook_url' => 'https://www.facebook.com/DepEdTayoERCIHS301179', ...$overrides];
}

function documentBody(array $overrides = []): array
{
    return ['report_type' => 'class_program', 'level' => 'JHS', 'title_format' => '{level} GRADE {grade} – CLASS PROGRAM', 'doc_ref_code' => 'ABC', 'revision_no' => '01', 'effectivity_date' => '2026-06-08', 'reference_note' => 'DO 12', ...$overrides];
}

function signatoryBody(array $overrides = []): array
{
    return ['report_type' => 'class_program', 'level' => 'JHS', 'label' => 'Prepared by', 'name' => 'Name One', 'position' => 'Head Teacher III', 'auto_source' => null, ...$overrides];
}

it('keeps report settings to the Admin', function (string $role) {
    $signatoryId = DB::table('report_signatories')->insertGetId([
        'term_id' => $this->termIds[1], 'label' => 'Prepared by', 'name' => 'Someone',
    ]);
    $this->actingAs(User::factory()->create()->assignRole($role));

    $this->getJson('/api/report-settings')->assertForbidden();
    $this->putJson('/api/school-profile', profileBody())->assertForbidden();
    $this->putJson('/api/report-settings/documents', documentBody())->assertForbidden();
    $this->getJson("/api/terms/{$this->termIds[1]}/signatories")->assertForbidden();
    $this->postJson("/api/terms/{$this->termIds[1]}/signatories", signatoryBody())->assertForbidden();
    $this->postJson("/api/terms/{$this->termIds[1]}/signatories/copy")->assertForbidden();
    $this->putJson("/api/signatories/{$signatoryId}", signatoryBody())->assertForbidden();
    $this->deleteJson("/api/signatories/{$signatoryId}")->assertForbidden();
    $this->postJson("/api/signatories/{$signatoryId}/move", ['direction' => 'up'])->assertForbidden();
})->with(['glc', 'master_teacher', 'teacher']);

describe('school profile', function () {
    it('has the school details built in, and saves only the phone, email and Facebook page', function () {
        $this->getJson('/api/report-settings')->assertOk()
            ->assertJsonPath('data.school.school_name', 'Emmanuel Resurreccion Congressional Integrated High School')
            ->assertJsonPath('data.school.school_id', '301179');

        $this->putJson('/api/school-profile', profileBody())->assertOk();
        $this->putJson('/api/school-profile', profileBody(['email' => 'new@deped.gov.ph', 'school_name' => 'Not saved']))->assertOk();

        $this->getJson('/api/report-settings')
            ->assertJsonPath('data.school.email', 'new@deped.gov.ph')
            ->assertJsonPath('data.school.school_name', 'Emmanuel Resurreccion Congressional Integrated High School')
            ->assertJsonPath('data.school.region', 'Region IV-A CALABARZON');
        expect(DB::table('school_profile')->count())->toBe(1)
            ->and(DB::table('school_profile')->value('school_id'))->toBe('301179')
            ->and(DB::table('audit_logs')->where('table_name', 'school_profile')->count())->toBe(2);
    });

    it('needs all three, each in the right form', function () {
        $this->putJson('/api/school-profile', ['phone' => '', 'email' => 'nope', 'facebook_url' => 'https://example.com/page'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['phone', 'email', 'facebook_url' => 'school\'s Facebook page']);
    });

    it('prints the built-in school logo, with no upload', function () {
        expect(app(\App\Services\ReportSettingsService::class)->logoDataUris('header'))->toHaveCount(1)
            ->and(app(\App\Services\ReportSettingsService::class)->logoDataUris('header')[0])->toStartWith('data:image/png;base64,');
        $this->postJson('/api/school-profile/logos')->assertNotFound();
    });
});

describe('document settings', function () {
    it('saves and updates one row per document and department', function () {
        $this->putJson('/api/report-settings/documents', documentBody())->assertOk();
        $this->putJson('/api/report-settings/documents', documentBody(['revision_no' => '02']))->assertOk();
        $this->putJson('/api/report-settings/documents', documentBody(['level' => 'SHS']))->assertOk();

        expect(DB::table('report_settings')->count())->toBe(2);
        $this->getJson('/api/report-settings')->assertJsonPath('data.documents.0.revision_no', '02');
    });

    it('does not duplicate a document for all departments', function () {
        $body = documentBody(['report_type' => 'teacher_program', 'level' => null, 'title_format' => 'TEACHER PROGRAM']);

        $this->putJson('/api/report-settings/documents', $body)->assertOk();
        $this->putJson('/api/report-settings/documents', [...$body, 'revision_no' => '09'])->assertOk();

        expect(DB::table('report_settings')->count())->toBe(1)
            ->and(DB::table('report_settings')->value('revision_no'))->toBe('09');
    });

    it('rejects bad values', function (array $overrides, string $field) {
        $this->putJson('/api/report-settings/documents', documentBody($overrides))
            ->assertUnprocessable()
            ->assertJsonValidationErrors($field);
    })->with([
        'no title' => [['title_format' => ''], 'title_format'],
        'unknown document' => [['report_type' => 'grades'], 'report_type'],
        'wrong date' => [['effectivity_date' => 'June 8'], 'effectivity_date'],
    ]);
});

describe('signatories', function () {
    it('adds them in order, per term', function () {
        $term = $this->termIds[1];

        $this->postJson("/api/terms/{$term}/signatories", signatoryBody())->assertCreated();
        $this->postJson("/api/terms/{$term}/signatories", signatoryBody(['label' => 'Approved by']))->assertCreated();
        $this->postJson("/api/terms/{$this->termIds[2]}/signatories", signatoryBody())->assertCreated();

        $this->getJson("/api/terms/{$term}/signatories")
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.label', 'Prepared by')
            ->assertJsonPath('data.0.sort_order', 1)
            ->assertJsonPath('data.1.label', 'Approved by')
            ->assertJsonPath('data.1.sort_order', 2);
    });

    it('fills the adviser automatically and keeps no typed name with it', function () {
        $this->postJson("/api/terms/{$this->termIds[1]}/signatories", signatoryBody([
            'label' => 'Conforme', 'name' => 'Typed by accident', 'auto_source' => 'section_adviser',
        ]))->assertCreated();

        expect(DB::table('report_signatories')->value('name'))->toBeNull();
    });

    it('rejects bad signatories', function (array $overrides, string $field) {
        $this->postJson("/api/terms/{$this->termIds[1]}/signatories", signatoryBody($overrides))
            ->assertUnprocessable()
            ->assertJsonValidationErrors($field);
    })->with([
        'no label' => [['label' => ''], 'label'],
        'no name and no automatic name' => [['name' => null], 'name'],
        'adviser on a teacher program' => [['report_type' => 'teacher_program', 'auto_source' => 'section_adviser'], 'auto_source'],
        'teacher on a class program' => [['auto_source' => 'teacher'], 'auto_source'],
        'automatic name on all documents' => [['report_type' => null, 'auto_source' => 'section_adviser'], 'auto_source'],
        'unknown department' => [['level' => 'College'], 'level'],
    ]);

    it('updates and deletes', function () {
        $id = $this->postJson("/api/terms/{$this->termIds[1]}/signatories", signatoryBody())->json('data.id');

        $this->putJson("/api/signatories/{$id}", signatoryBody(['name' => 'Name Two']))->assertOk();
        expect(DB::table('report_signatories')->where('id', $id)->value('name'))->toBe('Name Two');

        $this->deleteJson("/api/signatories/{$id}")->assertOk();
        expect(DB::table('report_signatories')->count())->toBe(0);
    });

    it('answers 404 for a signatory that does not exist', function () {
        $this->putJson('/api/signatories/999', signatoryBody())->assertNotFound();
        $this->deleteJson('/api/signatories/999')->assertNotFound();
        $this->postJson('/api/signatories/999/move', ['direction' => 'up'])->assertNotFound();
    });

    it('moves within its own form only', function () {
        $term = $this->termIds[1];
        $first = $this->postJson("/api/terms/{$term}/signatories", signatoryBody(['label' => 'First']))->json('data.id');
        $second = $this->postJson("/api/terms/{$term}/signatories", signatoryBody(['label' => 'Second']))->json('data.id');
        $otherForm = $this->postJson("/api/terms/{$term}/signatories", signatoryBody(['label' => 'SHS', 'level' => 'SHS']))->json('data.id');

        $this->postJson("/api/signatories/{$second}/move", ['direction' => 'up'])->assertOk();

        $order = fn (int $id) => DB::table('report_signatories')->where('id', $id)->value('sort_order');

        expect($order($second))->toBe(1)
            ->and($order($first))->toBe(2)
            ->and($order($otherForm))->toBe(1);
    });

    it('does nothing when already at the top or bottom', function () {
        $id = $this->postJson("/api/terms/{$this->termIds[1]}/signatories", signatoryBody())->json('data.id');

        $this->postJson("/api/signatories/{$id}/move", ['direction' => 'up'])->assertOk();
        $this->postJson("/api/signatories/{$id}/move", ['direction' => 'down'])->assertOk();

        expect(DB::table('report_signatories')->where('id', $id)->value('sort_order'))->toBe(1);
    });

    it('copies to the other terms of the year, replacing what they had', function () {
        $this->postJson("/api/terms/{$this->termIds[1]}/signatories", signatoryBody(['name' => 'Latest']))->assertCreated();
        $this->postJson("/api/terms/{$this->termIds[2]}/signatories", signatoryBody(['name' => 'Old']))->assertCreated();

        $this->postJson("/api/terms/{$this->termIds[1]}/signatories/copy")
            ->assertOk()
            ->assertJsonPath('data.terms', 2);

        foreach ($this->termIds as $termId) {
            expect(DB::table('report_signatories')->where('term_id', $termId)->pluck('name')->all())->toBe(['Latest']);
        }
    });

    it('leaves other school years alone when copying', function () {
        $otherYear = DB::table('school_years')->insertGetId([
            'name' => '2025-2026', 'start_date' => '2025-06-01', 'end_date' => '2026-03-31',
        ]);
        $otherTerm = DB::table('school_terms')->insertGetId([
            'school_year_id' => $otherYear, 'term_no' => 1, 'name' => 'Old Term',
            'start_date' => '2025-06-01', 'end_date' => '2025-09-01',
        ]);
        DB::table('report_signatories')->insert(['term_id' => $otherTerm, 'label' => 'Prepared by', 'name' => 'Past']);
        $this->postJson("/api/terms/{$this->termIds[1]}/signatories", signatoryBody())->assertCreated();

        $this->postJson("/api/terms/{$this->termIds[1]}/signatories/copy")->assertOk();

        expect(DB::table('report_signatories')->where('term_id', $otherTerm)->value('name'))->toBe('Past');
    });
});

it('prints what the Admin saved on the Class Program', function () {
    $this->putJson('/api/school-profile', profileBody(['phone' => '(046) 111-2222']));
    $this->putJson('/api/report-settings/documents', documentBody(['doc_ref_code' => 'REF-9']));
    $this->postJson("/api/terms/{$this->termIds[1]}/signatories", signatoryBody(['name' => 'Typed Head']));

    $section = Section::create([
        'school_year_id' => $this->yearId,
        'grade_level_id' => DB::table('grade_levels')->where('grade', 7)->value('id'),
        'name' => 'Honesty',
    ]);

    $data = app(ReportService::class)->classProgramData(SchoolTerm::find($this->termIds[1]), $section);

    expect($data['school']->school_name)->toBe('Emmanuel Resurreccion Congressional Integrated High School')
        ->and($data['school']->phone)->toBe('(046) 111-2222')
        ->and($data['logos'])->toHaveCount(1)
        ->and($data['settings']->doc_ref_code)->toBe('REF-9')
        ->and($data['signatories'][0]['name'])->toBe('Typed Head');
});

describe('the fixed signatories of each department (Nov 21, 2026)', function () {
    it('saves the Junior High 2x2 block in printing order, with Conforme from the adviser', function () {
        DB::table('report_signatories')->insert(['term_id' => $this->termIds[1], 'label' => 'Old', 'name' => 'Someone']);

        $this->putJson("/api/terms/{$this->termIds[1]}/signatories/slots", [
            'level' => 'JHS',
            'prepared_by' => ['name' => 'Ana Reyes', 'position' => 'Head Teacher III'],
            'recommending_approval' => ['name' => 'Ben Cruz', 'position' => 'School Principal II'],
            'approved_by' => ['name' => 'Carla Diaz', 'position' => 'PSDS Cluster IV'],
        ])->assertOk();

        $rows = DB::table('report_signatories')->where('term_id', $this->termIds[1])->orderBy('sort_order')->get();
        expect($rows->pluck('label')->all())->toBe(['Prepared by', 'Conforme', 'Recommending Approval', 'Approved by'])
            ->and($rows[1]->auto_source)->toBe('section_adviser');

        $printed = app(ReportService::class)->signatories(SchoolTerm::find($this->termIds[1]), 'class_program', 'JHS', ['section_adviser' => 'The Adviser']);
        expect(collect($printed)->pluck('name')->all())->toBe(['Ana Reyes', 'The Adviser', 'Ben Cruz', 'Carla Diaz']);
    });

    it('keeps a separate Senior High row of three: Prepared by, Noted by, Approved by', function () {
        $this->putJson("/api/terms/{$this->termIds[1]}/signatories/slots", [
            'level' => 'JHS',
            'prepared_by' => ['name' => 'Ana Reyes', 'position' => 'Head Teacher III'],
            'recommending_approval' => ['name' => 'Ben Cruz', 'position' => 'School Principal II'],
            'approved_by' => ['name' => 'Carla Diaz', 'position' => 'PSDS Cluster IV'],
        ])->assertOk();
        $this->putJson("/api/terms/{$this->termIds[1]}/signatories/slots", [
            'level' => 'SHS',
            'prepared_by' => ['name' => 'Rhessie Ambion', 'position' => 'Master Teacher I'],
            'noted_by' => ['name' => 'Irene M.', 'position' => 'Assistant School Principal II - SHS'],
            'approved_by' => ['name' => 'Ivy Joy D.', 'position' => 'School Principal'],
        ])->assertOk();

        $term = SchoolTerm::find($this->termIds[1]);
        expect(collect(app(ReportService::class)->signatories($term, 'class_program', 'SHS'))->pluck('label')->all())->toBe(['Prepared by', 'Noted by', 'Approved by'])
            ->and(collect(app(ReportService::class)->signatories($term, 'class_program', 'JHS'))->pluck('label')->all())->toHaveCount(4);
    });

    it('needs every name and position', function () {
        $this->putJson("/api/terms/{$this->termIds[1]}/signatories/slots", ['level' => 'SHS', 'prepared_by' => ['name' => 'A', 'position' => 'B'], 'noted_by' => ['name' => '', 'position' => ''], 'approved_by' => ['name' => 'C', 'position' => 'D']])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['noted_by.name' => 'Type the name to print.', 'noted_by.position']);
    });
});
