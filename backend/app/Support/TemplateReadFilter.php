<?php

namespace App\Support;

use PhpOffice\PhpSpreadsheet\Reader\IReadFilter;

/**
 * Reads only the template's columns (A to H) and as many rows as an import allows, so a big
 * workbook with many sheets, styles or pictures cannot use up the server's memory.
 */
class TemplateReadFilter implements IReadFilter
{
    public function __construct(private int $maxRow) {}

    public function readCell(string $columnAddress, int $row, string $worksheetName = ''): bool
    {
        return $row <= $this->maxRow && strlen($columnAddress) === 1 && $columnAddress <= 'H';
    }
}
