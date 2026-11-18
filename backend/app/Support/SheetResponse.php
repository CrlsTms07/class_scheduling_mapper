<?php

namespace App\Support;

use Illuminate\Http\Response;
use Maatwebsite\Excel\Excel as ExcelWriter;
use Maatwebsite\Excel\Facades\Excel;

/**
 * A sheet as a download. Every report is exported as CSV, with PDF beside it (team decision,
 * Nov 18, 2026). The CSV starts with a byte order mark, so Excel reads names like
 * "Grade 7 – Hope" correctly.
 */
class SheetResponse
{
    public static function csv(object $sheet, string $fileName): Response
    {
        return response("\xEF\xBB\xBF".Excel::raw($sheet, ExcelWriter::CSV), 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="'.$fileName.'.csv"',
        ]);
    }
}
