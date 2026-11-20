<?php

namespace App\Services;

use App\Models\SchoolYear;
use App\Models\User;
use App\Services\Import\ImportRows;
use App\Services\Import\MasterDataImporter;
use App\Services\Import\RoomImporter;
use App\Services\Import\SectionImporter;
use App\Services\Import\SubjectImporter;
use App\Services\Import\TeacherImporter;
use Illuminate\Database\QueryException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\Spreadsheet;

/**
 * Master-data import (teachers, subjects, rooms, sections) from the Excel template, so a school
 * does not type 80+ records every year. Schedules are never imported: they are made in the system.
 *
 * A preview and the import run the same code inside one transaction: the preview is rolled back,
 * the import is kept. Every row is checked again on import, rows with errors are left out, and a
 * key that appears twice in one file is an error on both rows.
 */
class MasterDataImportService
{
    public const TYPES = [
        'teachers' => TeacherImporter::class,
        'subjects' => SubjectImporter::class,
        'rooms' => RoomImporter::class,
        'sections' => SectionImporter::class,
    ];

    public function __construct(private AuditLogger $audit) {}

    public function importer(string $type): MasterDataImporter
    {
        return app(self::TYPES[$type]);
    }

    /**
     * @return array<string, mixed>
     */
    public function run(string $type, UploadedFile $file, string $onDuplicate, bool $commit, SchoolYear $year, User $user): array
    {
        $importer = $this->importer($type);
        $rows = ImportRows::read($file, $importer->columns());
        $results = [];

        DB::beginTransaction();

        try {
            $importer->start($year, $user, $onDuplicate);
            $repeated = ImportRows::repeatedKeys($rows, fn (array $row) => $importer->key($row));

            foreach ($rows as $row) {
                $results[] = ImportRows::result($row['row_number'], $importer->label($row), ...$this->check($importer, $row, $repeated));
            }

            $summary = ImportRows::summary($results);

            if ($commit) {
                $this->audit->log($user, 'import', $importer->table(), null, null, [
                    'file' => $file->getClientOriginalName(), 'school_year_id' => $year->id, 'on_duplicate' => $onDuplicate, ...$summary,
                ]);
            }

            $commit ? DB::commit() : DB::rollBack();
        } catch (\Throwable $exception) {
            DB::rollBack();

            throw $exception;
        }

        return [
            'mode' => $commit ? 'commit' : 'preview',
            'rows' => $results,
            'summary' => $summary,
            'added' => $summary['new'],
            'updated' => $summary['update'],
            'skipped' => $summary['skip'],
            'errors' => $summary['error'],
        ];
    }

    /**
     * @param  array<string, mixed>  $row
     * @param  array<int, array<int, int>>  $repeated
     * @return array{0: string, 1: array<int, string>}
     */
    private function check(MasterDataImporter $importer, array $row, array $repeated): array
    {
        $empty = array_keys(array_filter($importer->columns(), fn ($required, $column) => $required && $row[$column] === '', ARRAY_FILTER_USE_BOTH));
        if ($empty !== []) {
            return ['error', array_map(fn ($column) => str_replace('_', ' ', $column).' is empty. Fill it in.', $empty)];
        }

        if (isset($repeated[$row['row_number']])) {
            $others = implode(', ', $repeated[$row['row_number']]);

            return ['error', ["{$importer->describeKey($row)} is also on row {$others}. Keep only one row for it."]];
        }

        try {
            // A savepoint per row: a row the database refuses is left out, the others stay.
            return DB::transaction(fn () => $importer->handle($row));
        } catch (QueryException $exception) {
            report($exception);

            return ['error', ['this row could not be saved. Check its values against the template.']];
        }
    }

    public function template(string $type): Spreadsheet
    {
        $importer = $this->importer($type);

        return ImportRows::template(ucfirst($type), $importer->columns(), $importer->example(), $importer->notes());
    }
}
