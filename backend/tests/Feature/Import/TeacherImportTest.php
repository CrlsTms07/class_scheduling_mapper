<?php

use App\Models\User;
use App\Services\Import\ImportRows;
use Illuminate\Support\Facades\DB;

require_once __DIR__.'/ImportHelpers.php';

const TEACHER_HEADERS = ['Employee ID', 'Last Name', 'First Name', 'Middle Name', 'Email', 'Department', 'Personnel Type'];

beforeEach(function () {
    importSetUp($this);
    $this->mathId = DB::table('departments')->insertGetId(['name' => 'Mathematics']);
});

it('normalizes headers and cells the way people type them', function () {
    expect(ImportRows::normalizeHeader(' Employee ID '))->toBe('employee_id')
        ->and(ImportRows::normalizeHeader('co-adviser employee id'))->toBe('co_adviser_employee_id')
        ->and(ImportRows::cell(4512301.0))->toBe('4512301')
        ->and(ImportRows::cell("  Ana   Reyes "))->toBe('Ana Reyes')
        ->and(ImportRows::repeatedKeys([['row_number' => 2, 'k' => 'a'], ['row_number' => 3, 'k' => 'b'], ['row_number' => 5, 'k' => 'a']], fn ($row) => $row['k']))
        ->toBe([2 => [5], 5 => [2]])
        ->and(ImportRows::summary([['status' => 'new'], ['status' => 'new'], ['status' => 'error']]))
        ->toBe(['total' => 3, 'new' => 2, 'update' => 0, 'skip' => 0, 'error' => 1]);
});

it('previews without saving, and the import does exactly what the preview said', function () {
    $file = fn () => importFile(TEACHER_HEADERS, [
        ['4512301', 'Dela Cruz', 'Juan', 'Santos', 'juan.delacruz@deped.gov.ph', 'mathematics', ''],
        ['4512302', 'Reyes', 'Ana', '', '', 'Mathematics', 'teaching'],
        ['4512303', 'Lopez', 'Rina', '', '', 'TLE-ICTT', ''],
    ]);

    $preview = sendImport($this, 'teachers', $file())->assertOk()->json('data');

    expect($preview['mode'])->toBe('preview')
        ->and(collect($preview['rows'])->pluck('status')->all())->toBe(['new', 'new', 'error'])
        ->and($preview['rows'][2]['messages'][0])->toBe('Row 4: department "TLE-ICTT" does not exist. Add it on the Teachers page (Edit lists) or fix the spelling.')
        ->and($preview['rows'][0]['label'])->toBe('Juan Dela Cruz (4512301)')
        ->and(DB::table('teachers')->count())->toBe(0)
        ->and(DB::table('users')->where('email', 'juan.delacruz@deped.gov.ph')->exists())->toBeFalse();

    $done = sendImport($this, 'teachers', $file(), 'commit')->assertOk()->json('data');

    expect(collect($done['rows'])->pluck('status')->all())->toBe(collect($preview['rows'])->pluck('status')->all())
        ->and([$done['added'], $done['updated'], $done['skipped'], $done['errors']])->toBe([2, 0, 0, 1]);

    $juan = DB::table('teachers')->where('employee_id', '4512301')->first();
    $account = User::find($juan->user_id);
    expect($juan->department_id)->toBe($this->mathId)
        ->and($juan->middle_name)->toBe('Santos')
        ->and($account->status)->toBe('active')
        ->and($account->hasRole('teacher'))->toBeTrue()
        ->and(DB::table('teachers')->where('employee_id', '4512302')->value('user_id'))->toBeNull()
        ->and(DB::table('audit_logs')->where('action', 'import')->where('table_name', 'teachers')->exists())->toBeTrue();
});

it('skips or updates a teacher already listed, by employee ID in any case', function () {
    DB::table('teachers')->insert(['employee_id' => 'EMP-1', 'first_name' => 'Ana', 'last_name' => 'Reyes']);
    $file = fn () => importFile(TEACHER_HEADERS, [['emp-1', 'Reyes-Cruz', 'Ana', '', '', 'Mathematics', '']]);

    $skipped = sendImport($this, 'teachers', $file(), 'commit', ['on_duplicate' => 'skip'])->json('data');
    expect($skipped['rows'][0]['status'])->toBe('skip')
        ->and(DB::table('teachers')->where('employee_id', 'EMP-1')->value('last_name'))->toBe('Reyes');

    $updated = sendImport($this, 'teachers', $file(), 'commit', ['on_duplicate' => 'update'])->json('data');
    expect($updated['rows'][0]['status'])->toBe('update')
        ->and(DB::table('teachers')->count())->toBe(1)
        ->and(DB::table('teachers')->value('last_name'))->toBe('Reyes-Cruz')
        ->and(DB::table('teachers')->value('department_id'))->toBe($this->mathId);
});

it('gives the employee ID to a teacher encoded by hand with the same name, instead of adding them twice', function () {
    $id = DB::table('teachers')->insertGetId(['first_name' => 'Ana', 'last_name' => 'Reyes']);

    $done = sendImport($this, 'teachers', importFile(TEACHER_HEADERS, [['4512302', 'reyes', 'ana', '', '', 'Mathematics', '']]), 'commit', ['on_duplicate' => 'update'])->json('data');

    expect($done['rows'][0]['status'])->toBe('update')
        ->and(DB::table('teachers')->count())->toBe(1)
        ->and(DB::table('teachers')->where('id', $id)->value('employee_id'))->toBe('4512302');
});

it('calls a key that repeats in the file an error on both rows', function () {
    $data = sendImport($this, 'teachers', importFile(TEACHER_HEADERS, [
        ['4512301', 'Dela Cruz', 'Juan', '', '', 'Mathematics', ''],
        ['4512302', 'Reyes', 'Ana', '', '', 'Mathematics', ''],
        ['4512301', 'Cruz', 'Juana', '', '', 'Mathematics', ''],
    ]), 'commit')->json('data');

    expect(collect($data['rows'])->pluck('status')->all())->toBe(['error', 'new', 'error'])
        ->and($data['rows'][0]['messages'][0])->toBe('Row 2: employee ID "4512301" is also on row 4. Keep only one row for it.')
        ->and(DB::table('teachers')->count())->toBe(1);
});

it('names what is wrong with a row: empty fields, a bad email, an email already used', function () {
    $owner = User::factory()->create(['email' => 'taken@deped.gov.ph']);
    DB::table('teachers')->insert(['first_name' => 'Owner', 'last_name' => 'Person', 'user_id' => $owner->id]);

    $rows = sendImport($this, 'teachers', importFile(TEACHER_HEADERS, [
        ['', 'Dela Cruz', 'Juan', '', '', 'Mathematics', ''],
        ['4512302', 'Reyes', 'Ana', '', 'ana@gmail.com', 'Mathematics', ''],
        ['4512303', 'Lopez', 'Rina', '', 'TAKEN@deped.gov.ph', 'Mathematics', ''],
        ['45 12', 'Diaz', 'Leo', '', '', 'Mathematics', 'janitor'],
    ]))->json('data.rows');

    expect($rows[0]['messages'])->toBe(['Row 2: employee id is empty. Fill it in.'])
        ->and($rows[1]['messages'][0])->toContain('is not an official DepEd email')
        ->and($rows[2]['messages'][0])->toBe('Row 4: email taken@deped.gov.ph is already the account of Owner Person.')
        ->and($rows[3]['messages'])->toHaveCount(2);
});

it('takes only xlsx files with the template headers, and says to use Excel for a PDF', function () {
    $pdf = new \Illuminate\Http\UploadedFile(tempnam(sys_get_temp_dir(), 'pdf'), 'teachers.pdf', 'application/pdf', null, true);
    sendImport($this, 'teachers', $pdf)->assertUnprocessable()
        ->assertJsonValidationErrors(['file' => 'Reading a PDF is not supported yet. Download the Excel template, fill it in and upload it.']);

    sendImport($this, 'teachers', importFile(['Name', 'Department'], [['Ana', 'Mathematics']]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['file' => 'The file has no "employee_id", "last_name", "first_name" column.']);

    $csv = new \Illuminate\Http\UploadedFile(tempnam(sys_get_temp_dir(), 'csv'), 'teachers.csv', 'text/csv', null, true);
    sendImport($this, 'teachers', $csv)->assertUnprocessable()->assertJsonValidationErrors('file');
});

it('lets only the Admin import or download a template', function (string $role) {
    $this->actingAs(User::factory()->create()->assignRole($role));

    sendImport($this, 'teachers', importFile(TEACHER_HEADERS, [['4512301', 'Dela Cruz', 'Juan', '', '', 'Mathematics', '']]), 'commit')->assertForbidden();
    $this->get('/api/imports/teachers/template.xlsx')->assertForbidden();
    expect(DB::table('teachers')->count())->toBe(0);
})->with(['glc', 'master_teacher', 'teacher']);

it('downloads a template with the exact headers and one example row', function () {
    $response = $this->get('/api/imports/teachers/template.xlsx')->assertOk();
    $path = tempnam(sys_get_temp_dir(), 'tpl').'.xlsx';
    file_put_contents($path, $response->streamedContent());

    $sheet = \PhpOffice\PhpSpreadsheet\IOFactory::load($path)->getSheet(0)->toArray();

    expect($sheet[0])->toBe(['employee_id', 'last_name', 'first_name', 'middle_name', 'email', 'department', 'personnel_type'])
        ->and($sheet[1][0])->toBe('4512301');

    $this->get('/api/imports/schedules/template.xlsx')->assertNotFound();
});
