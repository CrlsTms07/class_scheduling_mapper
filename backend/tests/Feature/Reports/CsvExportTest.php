<?php

use App\Models\Section;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Support\Facades\DB;

/*
 * Every spreadsheet download also comes as CSV, made from the same sheet.
 */

beforeEach(function () {
    $this->withHeader('Referer', 'http://localhost:5173');
    $this->seed(DatabaseSeeder::class);
    $this->actingAs(User::where('email', 'glc@deped.gov.ph')->first());
    $this->termId = DB::table('school_terms')->where('is_active', true)->value('id');
    $this->section = Section::where('name', 'Sample A')->first();
});

it('downloads a class program as CSV that Excel reads correctly', function () {
    $response = $this->get("/api/terms/{$this->termId}/sections/{$this->section->id}/class-program.csv")->assertOk();

    expect($response->headers->get('Content-Type'))->toStartWith('text/csv')
        ->and($response->headers->get('Content-Disposition'))->toContain('.csv"')
        ->and(substr($response->getContent(), 0, 3))->toBe("\xEF\xBB\xBF")
        ->and($response->getContent())->toContain('GRADE 7 – SAMPLE A');
});

it('downloads the summary reports as CSV too', function (string $path) {
    $response = $this->get("/api/terms/{$this->termId}/reports/{$path}")->assertOk();

    expect($response->headers->get('Content-Type'))->toStartWith('text/csv');
})->with(['teacher-load.csv', 'room-usage.csv', 'grades/7/timetable.csv', 'validation.csv']);

it('still downloads XLSX as before', function () {
    $response = $this->get("/api/terms/{$this->termId}/reports/teacher-load.xlsx")->assertOk();

    expect($response->headers->get('Content-Type'))->toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
});

it('keeps the same rules as the other formats', function () {
    $this->actingAs(User::where('email', 'teacher@deped.gov.ph')->first());

    $this->get("/api/terms/{$this->termId}/reports/teacher-load.csv")->assertForbidden();
    $this->get("/api/terms/{$this->termId}/my-schedule/program.csv")->assertOk();
});
