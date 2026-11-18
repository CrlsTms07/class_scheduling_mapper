<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithCustomValueBinder;
use Maatwebsite\Excel\Concerns\WithStrictNullComparison;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Cell\Cell;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Cell\DefaultValueBinder;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * One worksheet of a report. The report decides the rows and which cells stand out,
 * so every XLSX in the system looks the same.
 *
 * Reports are exported as CSV; the import template is the only XLSX (team decision, Nov 18, 2026).
 */
class ReportSheet extends DefaultValueBinder implements FromArray, WithCustomValueBinder, WithStrictNullComparison, WithStyles, WithTitle
{
    /**
     * @param  array<int, array<int, mixed>>  $rows
     * @param  array<int, string>  $merged  ranges to merge, like "A1:F1"
     * @param  array<int, string>  $centered  ranges of title text
     * @param  array<int, string>  $bordered  ranges with a thin border
     * @param  array<int, string>  $headers  ranges of column headers
     * @param  array<int, string>  $shaded  ranges of breaks and lunches
     * @param  array<int, float>  $columnWidths  width of each column, in order
     */
    public function __construct(
        private string $title,
        private array $rows,
        private array $merged = [],
        private array $centered = [],
        private array $bordered = [],
        private array $headers = [],
        private array $shaded = [],
        private array $columnWidths = [],
    ) {}

    /**
     * Text that looks like a formula ("=...") is written as plain text, so a typed name can never
     * run as a formula in the template. Everything else is written as usual.
     */
    public function bindValue(Cell $cell, mixed $value): bool
    {
        if (is_string($value) && str_starts_with($value, '=')) {
            $cell->setValueExplicit($value, DataType::TYPE_STRING);

            return true;
        }

        return parent::bindValue($cell, $value);
    }

    /**
     * The rows as they go into the file. A blank row stays a blank row (Laravel Excel would drop
     * an empty one, and every row below would move up, away from its borders and formulas), an
     * empty text becomes an empty cell, and a 0 is written as 0 instead of being left out.
     */
    public function array(): array
    {
        return array_map(
            fn (array $row) => $row === [] ? [null] : array_map(fn ($value) => $value === '' ? null : $value, $row),
            $this->rows,
        );
    }

    public function title(): string
    {
        // Excel allows up to 31 characters, and none of these: \ / ? * [ ] :
        return mb_substr(preg_replace('/[\\\\\/?*\[\]:]/', ' ', $this->title), 0, 31);
    }

    public function styles(Worksheet $sheet): ?array
    {
        $sheet->getStyle($sheet->calculateWorksheetDimension())->getAlignment()
            ->setWrapText(true)
            ->setVertical(Alignment::VERTICAL_TOP);

        foreach ($this->columnWidths as $index => $width) {
            $sheet->getColumnDimensionByColumn($index + 1)->setWidth($width);
        }

        foreach ($this->merged as $range) {
            $sheet->mergeCells($range);
        }

        foreach ($this->centered as $range) {
            $style = $sheet->getStyle($range);
            $style->getFont()->setBold(true);
            $style->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        }

        foreach ($this->bordered as $range) {
            $sheet->getStyle($range)->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
        }

        foreach ($this->headers as $range) {
            $style = $sheet->getStyle($range);
            $style->getFont()->setBold(true);
            $style->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $this->fill($sheet, $range, 'D0D0D0');
        }

        foreach ($this->shaded as $range) {
            $sheet->getStyle($range)->getFont()->setBold(true);
            $this->fill($sheet, $range, 'C4C4C4');
        }

        return null;
    }

    private function fill(Worksheet $sheet, string $range, string $color): void
    {
        $sheet->getStyle($range)->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB($color);
    }
}
