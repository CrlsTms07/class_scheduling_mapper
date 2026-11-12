<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * One worksheet of a report. The report decides the rows and which cells stand out,
 * so every XLSX in the system looks the same.
 */
class ReportSheet implements FromArray, WithStyles, WithTitle
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

    public function array(): array
    {
        return $this->rows;
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
