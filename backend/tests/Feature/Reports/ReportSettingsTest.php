<?php

use App\Models\SchoolTerm;
use App\Models\Section;
use App\Models\User;
use App\Services\ReportService;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

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
    return ['school_name' => 'ERCIHS', 'school_id' => '123', 'address' => 'Somewhere', 'phone' => null, 'email' => 'school@deped.gov.ph', 'website' => null, ...$overrides];
}

function documentBody(array $overrides = []): array
{
    return ['report_type' => 'class_program', 'level' => 'JHS', 'title_format' => '{level} GRADE {grade} – CLASS PROGRAM', 'doc_ref_code' => 'ABC', 'revision_no' => '01', 'effectivity_date' => '2026-06-08', 'reference_note' => 'DO 12', ...$overrides];
}

function signatoryBody(array $overrides = []): array
{
    return ['report_type' => 'class_program', 'level' => 'JHS', 'label' => 'Prepared by', 'name' => 'Name One', 'position' => 'Head Teacher III', 'auto_source' => null, ...$overrides];
}

/** A tiny real PNG, because the validator reads the file's real type. */
function pngFile(string $name = 'logo.png'): UploadedFile
{
    return UploadedFile::fake()->createWithContent($name, base64_decode(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
    ));
}

it('keeps report settings to the Admin', function (string $role) {
    $signatoryId = DB::table('report_signatories')->insertGetId([
        'term_id' => $this->termIds[1], 'label' => 'Prepared by', 'name' => 'Someone',
    ]);
    $this->actingAs(User::factory()->create()->assignRole($role));

    $this->getJson('/api/report-settings')->assertForbidden();
    $this->putJson('/api/school-profile', profileBody())->assertForbidden();
    $this->postJson('/api/school-profile/logos', ['logo' => pngFile()])->assertForbidden();
    $this->deleteJson('/api/school-profile/logos/0')->assertForbidden();
    $this->putJson('/api/report-settings/documents', documentBody())->assertForbidden();
    $this->getJson("/api/terms/{$this->termIds[1]}/signatories")->assertForbidden();
    $this->postJson("/api/terms/{$this->termIds[1]}/signatories", signatoryBody())->assertForbidden();
    $this->postJson("/api/terms/{$this->termIds[1]}/signatories/copy")->assertForbidden();
    $this->putJson("/api/signatories/{$signatoryId}", signatoryBody())->assertForbidden();
    $this->deleteJson("/api/signatories/{$signatoryId}")->assertForbidden();
    $this->postJson("/api/signatories/{$signatoryId}/move", ['direction' => 'up'])->assertForbidden();
})->with(['glc', 'master_teacher', 'teacher']);

describe('school profile', function () {
    it('starts empty on a new server, then saves and updates', function () {
        $this->getJson('/api/report-settings')->assertOk()->assertJsonPath('data.school', null);

        $this->putJson('/api/school-profile', profileBody())->assertOk();
        $this->putJson('/api/school-profile', profileBody(['school_name' => 'New Name']))->assertOk();

        $this->getJson('/api/report-settings')->assertJsonPath('data.school.school_name', 'New Name');
        expect(DB::table('school_profile')->count())->toBe(1)
            ->and(DB::table('audit_logs')->where('table_name', 'school_profile')->count())->toBe(2);
    });

    it('needs a school name and a valid email', function () {
        $this->putJson('/api/school-profile', profileBody(['school_name' => '', 'email' => 'nope']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['school_name', 'email']);
    });
});

describe('logos', function () {
    beforeEach(function () {
        Storage::fake('local');
        $this->putJson('/api/school-profile', profileBody());
    });

    it('needs the school name first', function () {
        DB::table('school_profile')->delete();

        $this->postJson('/api/school-profile/logos', ['logo' => pngFile()])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['logo' => 'school name']);
    });

    it('stores logos in order and gives them back as images', function () {
        $this->post('/api/school-profile/logos', ['logo' => pngFile()], ['Accept' => 'application/json'])->assertCreated();
        $this->post('/api/school-profile/logos', ['logo' => pngFile('deped.png')], ['Accept' => 'application/json'])->assertCreated();

        $logos = $this->getJson('/api/report-settings')->assertOk()->json('data.logos');

        expect($logos)->toHaveCount(2)
            ->and($logos[0])->toStartWith('data:image/png;base64,');

        expect(DB::table('school_logos')->count())->toBe(2);
    });

    it('keeps logos in the database, so they survive a restart of the server', function () {
        Storage::fake('local');

        $this->post('/api/school-profile/logos', ['logo' => pngFile()], ['Accept' => 'application/json'])->assertCreated();

        expect(Storage::disk('local')->allFiles())->toBe([])
            ->and(DB::table('school_logos')->sole()->mime_type)->toBe('image/png');
    });

    it('refuses other file types, big files and too many logos', function () {
        $this->post('/api/school-profile/logos', ['logo' => UploadedFile::fake()->createWithContent('evil.svg', '<svg></svg>')], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['logo' => 'PNG or JPG']);

        $this->post('/api/school-profile/logos', ['logo' => UploadedFile::fake()->image('big.png')->size(3000)], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['logo' => '2 MB']);

        foreach (range(1, 4) as $number) {
            $this->post('/api/school-profile/logos', ['logo' => pngFile("{$number}.png")], ['Accept' => 'application/json'])->assertCreated();
        }

        $this->post('/api/school-profile/logos', ['logo' => pngFile('5.png')], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['logo' => 'up to 4']);
    });

    it('moves the next logo up when the first is removed', function () {
        $this->post('/api/school-profile/logos', ['logo' => pngFile('a.png')], ['Accept' => 'application/json']);
        $this->post('/api/school-profile/logos', ['logo' => pngFile('b.png')], ['Accept' => 'application/json']);
        $second = DB::table('school_logos')->orderByDesc('id')->value('id');

        $this->deleteJson('/api/school-profile/logos/0')->assertOk();

        expect(DB::table('school_logos')->pluck('id')->all())->toBe([$second]);
    });

    it('removes the one asked for', function () {
        $this->post('/api/school-profile/logos', ['logo' => pngFile('a.png')], ['Accept' => 'application/json']);
        $this->post('/api/school-profile/logos', ['logo' => pngFile('b.png')], ['Accept' => 'application/json']);
        $first = DB::table('school_logos')->orderBy('id')->value('id');

        $this->deleteJson('/api/school-profile/logos/1')->assertOk();

        expect(DB::table('school_logos')->pluck('id')->all())->toBe([$first]);
    });

    it('explains when the logo is already gone', function () {
        $this->deleteJson('/api/school-profile/logos/3')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('logo');
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
    Storage::fake('local');
    $this->putJson('/api/school-profile', profileBody(['school_name' => 'My School']));
    $this->post('/api/school-profile/logos', ['logo' => pngFile()], ['Accept' => 'application/json'])->assertCreated();
    $this->post('/api/school-profile/logos', ['logo' => pngFile('b.png')], ['Accept' => 'application/json'])->assertCreated();
    $this->putJson('/api/report-settings/documents', documentBody(['doc_ref_code' => 'REF-9']));
    $this->postJson("/api/terms/{$this->termIds[1]}/signatories", signatoryBody(['name' => 'Typed Head']));

    $section = Section::create([
        'school_year_id' => $this->yearId,
        'grade_level_id' => DB::table('grade_levels')->where('grade', 7)->value('id'),
        'name' => 'Honesty',
    ]);

    $data = app(ReportService::class)->classProgramData(SchoolTerm::find($this->termIds[1]), $section);

    expect($data['school']->school_name)->toBe('My School')
        ->and($data['logos'])->toHaveCount(2)
        ->and($data['settings']->doc_ref_code)->toBe('REF-9')
        ->and($data['signatories'][0]['name'])->toBe('Typed Head');
});
