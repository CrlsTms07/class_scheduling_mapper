<?php

namespace App\Services\Import;

use App\Support\TemplateReadFilter;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\ValidationException;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;

/**
 * Shared – reading an import file and shaping its results, for every master-data import
 * (teachers, subjects, rooms, sections). Each row result is
 * {row_number, label, status: new|update|skip|error, messages[]}, with a summary of the counts.
 */
class ImportRows
{
    public const MAX_ROWS = 2000;

    public const STATUSES = ['new', 'update', 'skip', 'error'];

    /**
     * A header as typed by a person ("Employee ID", "employee-id ") in the form the code uses.
     */
    public static function normalizeHeader(mixed $header): string
    {
        $text = strtolower(trim((string) $header));
        $text = preg_replace('/[^a-z0-9]+/', '_', $text);

        return trim($text, '_');
    }

    /**
     * A cell value as text: trimmed, and a whole number from Excel (4512301.0) without ".0".
     */
    public static function cell(mixed $value): string
    {
        if (is_float($value) && floor($value) === $value && abs($value) < 1e15) {
            return (string) (int) $value;
        }

        return trim(preg_replace('/\s+/u', ' ', (string) $value));
    }

    /**
     * Reads the first sheet. Row 1 holds the headers; empty rows are left out.
     * Only the given columns are kept, and every row keeps its sheet row number.
     *
     * @param  array<string, bool>  $columns  column => required
     * @return array<int, array<string, string|int>>
     */
    public static function read(UploadedFile $file, array $columns): array
    {
        if (strtolower($file->getClientOriginalExtension()) === 'pdf') {
            throw ValidationException::withMessages([
                'file' => 'Reading a PDF is not supported yet. Download the Excel template, fill it in and upload it.',
            ]);
        }

        try {
            $reader = IOFactory::createReader('Xlsx');
            $reader->setReadDataOnly(true);
            $reader->setReadFilter(new TemplateReadFilter(self::MAX_ROWS + 2));
            $sheet = $reader->load($file->getRealPath())->getSheet(0);
        } catch (\Throwable) {
            throw ValidationException::withMessages(['file' => 'The file could not be read. Save it as an Excel workbook (.xlsx) and try again.']);
        }

        $table = $sheet->toArray(null, true, false, false);
        $headers = array_map(fn ($header) => self::normalizeHeader($header), array_shift($table) ?? []);

        $missing = array_keys(array_filter($columns, fn ($required, $column) => $required && ! in_array($column, $headers, true), ARRAY_FILTER_USE_BOTH));
        if ($missing !== []) {
            throw ValidationException::withMessages([
                'file' => 'The file has no '.implode(', ', array_map(fn ($column) => "\"{$column}\"", $missing)).' column. Use the headers of the template on row 1.',
            ]);
        }

        $rows = [];
        foreach ($table as $index => $cells) {
            $row = ['row_number' => $index + 2];
            foreach ($headers as $position => $header) {
                if (array_key_exists($header, $columns)) {
                    $row[$header] = self::cell($cells[$position] ?? '');
                }
            }

            if (collect($row)->except('row_number')->every(fn ($value) => $value === '')) {
                continue;
            }

            $rows[] = $row + array_fill_keys(array_keys($columns), '');
        }

        if ($rows === []) {
            throw ValidationException::withMessages(['file' => 'The file has no rows to import under the headers.']);
        }

        if (count($rows) > self::MAX_ROWS) {
            throw ValidationException::withMessages(['file' => 'The file has more than '.self::MAX_ROWS.' rows. Split it into smaller files.']);
        }

        return $rows;
    }

    /**
     * Rows whose key is also on another row of the same file: row number => the other row numbers.
     *
     * @param  array<int, array<string, mixed>>  $rows
     * @param  callable(array<string, mixed>): ?string  $key
     * @return array<int, array<int, int>>
     */
    public static function repeatedKeys(array $rows, callable $key): array
    {
        $byKey = [];
        foreach ($rows as $row) {
            $value = $key($row);
            if ($value !== null && $value !== '') {
                $byKey[$value][] = $row['row_number'];
            }
        }

        $repeated = [];
        foreach ($byKey as $numbers) {
            if (count($numbers) > 1) {
                foreach ($numbers as $number) {
                    $repeated[$number] = array_values(array_diff($numbers, [$number]));
                }
            }
        }

        return $repeated;
    }

    /**
     * @param  array<int, string>  $messages
     * @return array{row_number: int, label: string, status: string, messages: array<int, string>}
     */
    public static function result(int $rowNumber, string $label, string $status, array $messages = []): array
    {
        return [
            'row_number' => $rowNumber,
            'label' => $label,
            'status' => $status,
            'messages' => array_map(fn ($message) => "Row {$rowNumber}: {$message}", $messages),
        ];
    }

    /**
     * @param  array<int, array{status: string}>  $results
     * @return array{total: int, new: int, update: int, skip: int, error: int}
     */
    public static function summary(array $results): array
    {
        $counts = array_fill_keys(self::STATUSES, 0);
        foreach ($results as $result) {
            $counts[$result['status']]++;
        }

        return ['total' => count($results), ...$counts];
    }

    /**
     * The template: the exact headers and one example row on the first sheet, every cell kept as
     * text (so an employee ID keeps its leading zeros), and what each column takes on a second sheet.
     *
     * @param  array<string, bool>  $columns
     * @param  array<string, string>  $example
     * @param  array<string, string>  $notes
     */
    public static function template(string $title, array $columns, array $example, array $notes): Spreadsheet
    {
        $book = new Spreadsheet;
        $sheet = $book->getActiveSheet();
        $sheet->setTitle(substr($title, 0, 31));

        foreach (array_keys($columns) as $index => $column) {
            $letter = chr(ord('A') + $index);
            $sheet->getStyle("{$letter}1:{$letter}".(self::MAX_ROWS + 1))->getNumberFormat()->setFormatCode(NumberFormat::FORMAT_TEXT);
            $sheet->setCellValueExplicit("{$letter}1", $column, \PhpOffice\PhpSpreadsheet\Cell\DataType::TYPE_STRING);
            $sheet->setCellValueExplicit("{$letter}2", $example[$column] ?? '', \PhpOffice\PhpSpreadsheet\Cell\DataType::TYPE_STRING);
            $sheet->getColumnDimension($letter)->setWidth(max(16, strlen($column) + 4));
        }
        $sheet->getStyle('A1:'.chr(ord('A') + count($columns) - 1).'1')->getFont()->setBold(true);
        $sheet->freezePane('A2');

        $help = $book->createSheet();
        $help->setTitle('How to fill in');
        $help->fromArray([['Column', 'Required', 'What to type']], null, 'A1');
        $line = 2;
        foreach ($columns as $column => $required) {
            $help->fromArray([[$column, $required ? 'Yes' : 'No', $notes[$column] ?? '']], null, "A{$line}");
            $line++;
        }
        $help->fromArray([['Replace the example row with your own rows. Keep the headers on row 1.']], null, 'A'.($line + 1));
        $help->getStyle('A1:C1')->getFont()->setBold(true);
        $help->getColumnDimension('A')->setWidth(26);
        $help->getColumnDimension('B')->setWidth(10);
        $help->getColumnDimension('C')->setWidth(90);
        $book->setActiveSheetIndex(0);

        return $book;
    }
}
