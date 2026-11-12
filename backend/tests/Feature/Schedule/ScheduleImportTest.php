<?php

use App\Exports\ReportSheet;
use App\Models\ScheduleEntry;
use App\Models\SchoolTerm;
use App\Models\SectionSubject;
use App\Models\Teacher;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Http\UploadedFile;
use Maatwebsite\Excel\Excel as ExcelWriter;
use Maatwebsite\Excel\Facades\Excel;

beforeEach(function () {
    $this->withHeader('Referer', 'http://localhost:5173');
    $this->seed(DatabaseSeeder::class);
    $this->actingAs(User::where('email', 'glc@deped.gov.ph')->first());
    $this->term = SchoolTerm::where('is_active', true)->first();
    $this->third = SchoolTerm::where('name', 'Third Term')->first();
    $this->valuesTeacher = Teacher::find(SectionSubject::whereHas('subject', fn ($q) => $q->where('name', 'Values Education'))->value('teacher_id'))->printedName();
    $this->filipinoTeacher = Teacher::find(SectionSubject::whereHas('subject', fn ($q) => $q->where('name', 'Filipino'))->value('teacher_id'))->printedName();
});

function csvFile(array $rows): UploadedFile
{
    $lines = array_map(fn (array $row) => implode(',', array_map(fn ($cell) => '"'.$cell.'"', $row)), [
        ['Grade', 'Section', 'Day', 'Start', 'End', 'Subject', 'Teacher', 'Room'],
        ...$rows,
    ]);

    return UploadedFile::fake()->createWithContent('schedule.csv', "\xEF\xBB\xBF".implode("\n", $lines));
}

function importFile(object $test, UploadedFile $file, bool $preview = false, ?SchoolTerm $term = null)
{
    $term ??= $test->term;

    return $test->post("/api/terms/{$term->id}/schedule-import", ['file' => $file, 'preview' => $preview ? '1' : '0'], ['Accept' => 'application/json']);
}

it('gives a template with the headings and a sample row', function () {
    $response = $this->get("/api/terms/{$this->term->id}/schedule-import/template.csv")->assertOk();

    expect($response->getContent())->toContain('"Grade","Section","Day","Start","End","Subject","Teacher","Room"');
    $this->get("/api/terms/{$this->term->id}/schedule-import/template.xlsx")->assertOk();
});

it('checks every row in a preview, saving nothing', function () {
    $response = importFile($this, csvFile([
        [7, 'Sample A', 'Monday', '7:15 AM', '8:00 AM', 'Values Education', '', ''],
        [7, 'Sample A', 'Tuesday', '7:15', '8:00', 'Filipino', '', '101'],
    ]), preview: true)->assertOk();

    expect($response->json('data.ok'))->toBe(2)
        ->and($response->json('data.errors'))->toBe(0)
        ->and(ScheduleEntry::count())->toBe(0);
});

it('saves the good rows as drafts, and says why each bad row was left out', function () {
    $response = importFile($this, csvFile([
        [7, 'Sample A', 'Monday', '7:15 AM', '8:00 AM', 'Values Education', $this->valuesTeacher, '101'],
        [7, 'Sample Z', 'Monday', '7:15 AM', '8:00 AM', 'Values Education', '', ''],
        [7, 'Sample A', 'Someday', '7:15 AM', '8:00 AM', 'Filipino', '', ''],
        [7, 'Sample A', 'Tuesday', '7:20 AM', '8:00 AM', 'Filipino', '', ''],
        [7, 'Sample A', 'Tuesday', '7:15 AM', '8:00 AM', 'Basket Weaving', '', ''],
        [7, 'Sample A', 'Tuesday', '7:15 AM', '8:00 AM', 'Filipino', 'Nobody Here', ''],
        [7, 'Sample B', 'Monday', '7:15 AM', '8:00 AM', 'Values Education', '', ''],
        [7, 'Sample A', 'Monday', '7:15 AM', '8:00 AM', 'Filipino', '', ''],
    ]))->assertOk();

    $messages = collect($response->json('data.rows'))->pluck('message', 'row');

    expect($response->json('data.ok'))->toBe(1)
        ->and($response->json('data.errors'))->toBe(7)
        ->and($messages[3])->toContain('no section with this name in Grade 7')
        ->and($messages[4])->toContain('Monday to Friday')
        ->and($messages[5])->toContain('No period')
        ->and($messages[6])->toContain('not offered')
        ->and($messages[7])->toContain('No active teacher')
        ->and($messages[8])->toContain('teacher is already teaching')
        ->and($messages[9])->toContain('section already has a class');

    $entry = ScheduleEntry::sole();
    expect($entry->status)->toBe('draft')
        ->and($entry->start_time)->toBe('07:15:00')
        ->and($entry->day_of_week)->toBe(1);
});

it('adds the teacher loading a subject is missing, from the teacher in the file', function () {
    $response = importFile($this, csvFile([
        [7, 'Sample A', 'Monday', '7:15 AM', '8:00 AM', 'Filipino', $this->filipinoTeacher, '101'],
        [7, 'Sample A', 'Tuesday', '7:15 AM', '8:00 AM', 'Filipino', '', '101'],
    ]), term: $this->third)->assertOk();

    expect($response->json('data.rows.0.status'))->toBe('ok')
        ->and($response->json('data.rows.1.message'))->toContain('Write the teacher')
        ->and(SectionSubject::where('term_id', $this->third->id)->count())->toBe(1)
        ->and(ScheduleEntry::where('term_id', $this->third->id)->count())->toBe(1);
});

it('places activities named in the file', function () {
    importFile($this, csvFile([[7, 'Sample A', 'Friday', '7:10 AM', '7:50 AM', 'Catch-up Friday', '', '']]))->assertOk()->assertJsonPath('data.ok', 1);

    expect(ScheduleEntry::sole()->activity_id)->not->toBeNull();
});

it('reads XLSX files too', function () {
    $sheet = new ReportSheet('x', [
        ['Grade', 'Section', 'Day', 'Start', 'End', 'Subject', 'Teacher', 'Room'],
        [7, 'Sample A', 'Monday', '7:15 AM', '8:00 AM', 'Values Education', '', ''],
    ]);
    $file = UploadedFile::fake()->createWithContent('schedule.xlsx', Excel::raw($sheet, ExcelWriter::XLSX));

    importFile($this, $file)->assertOk()->assertJsonPath('data.ok', 1);
});

it('refuses a file that is not the template', function () {
    $file = UploadedFile::fake()->createWithContent('schedule.csv', "Name,Time\nMath,7:00");

    importFile($this, $file)->assertUnprocessable()->assertJsonValidationErrors('file');
});

it('explains a workbook that is not the template, without failing', function () {
    $sheet = new ReportSheet('Budget', [
        ['EMMANUEL RESURRECCION CONGRESSIONAL INTEGRATED HIGH SCHOOL', '', ''],
        ['TIME', 'MONDAY', 'TUESDAY'],
        ['7:00 - 8:00', 'Gen Bio', 'Gen Math'],
    ]);
    $file = UploadedFile::fake()->createWithContent('class-program.xlsx', Excel::raw($sheet, ExcelWriter::XLSX));

    importFile($this, $file)
        ->assertUnprocessable()
        ->assertJsonPath('errors.file.0', fn (string $message) => str_contains($message, 'No schedule was found'));
});

it('is not for teachers', function () {
    $this->actingAs(User::where('email', 'teacher@deped.gov.ph')->first());

    importFile($this, csvFile([[7, 'Sample A', 'Monday', '7:15 AM', '8:00 AM', 'Values Education', '', '']]))->assertForbidden();
});
