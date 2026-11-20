<?php

use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;

/**
 * An .xlsx upload with the given header row and rows.
 *
 * @param  array<int, string>  $headers
 * @param  array<int, array<int, mixed>>  $rows
 */
function importFile(array $headers, array $rows, string $name = 'import.xlsx'): UploadedFile
{
    $book = new Spreadsheet;
    $book->getActiveSheet()->fromArray([$headers, ...$rows], null, 'A1', true);
    $path = tempnam(sys_get_temp_dir(), 'import').'.xlsx';
    IOFactory::createWriter($book, 'Xlsx')->save($path);

    return new UploadedFile($path, $name, null, null, true);
}

/**
 * Sends a file to the import of the given kind.
 *
 * @param  array<string, string>  $fields
 */
function sendImport(object $test, string $type, UploadedFile $file, string $mode = 'preview', array $fields = [])
{
    return $test->post("/api/school-years/{$test->yearId}/imports/{$type}?mode={$mode}", ['file' => $file, ...$fields], ['Accept' => 'application/json']);
}

/** An Admin with a school year and one active term. */
function importSetUp(object $test): void
{
    $test->withHeader('Referer', 'http://localhost:5173');
    $test->seed(\Database\Seeders\ReferenceDataSeeder::class);
    $test->admin = User::factory()->create()->assignRole('super_admin');
    $test->actingAs($test->admin);

    $test->yearId = DB::table('school_years')->insertGetId([
        'name' => '2026-2027', 'start_date' => '2026-06-01', 'end_date' => '2027-03-31',
    ]);
    $test->termId = DB::table('school_terms')->insertGetId([
        'school_year_id' => $test->yearId, 'term_no' => 1, 'name' => 'First',
        'start_date' => '2026-06-01', 'end_date' => '2026-09-30', 'is_active' => true,
    ]);
}
