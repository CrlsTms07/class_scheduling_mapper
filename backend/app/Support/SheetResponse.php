<?php

namespace App\Support;

use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Maatwebsite\Excel\Excel as ExcelWriter;
use Maatwebsite\Excel\Facades\Excel;

/**
 * A report sheet as a download: XLSX for spreadsheets, or CSV for raw data. Both are made
 * from the same sheet, so they always hold the same rows. The CSV starts with a byte order
 * mark, so Excel reads names like "Grade 7 – Hope" correctly.
 */
class SheetResponse
{
    public const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    public static function make(object $sheet, string $fileName, string $format): Response
    {
        if ($format === 'csv') {
            return response("\xEF\xBB\xBF".Excel::raw($sheet, ExcelWriter::CSV), 200, [
                'Content-Type' => 'text/csv; charset=UTF-8',
                'Content-Disposition' => 'attachment; filename="'.$fileName.'.csv"',
            ]);
        }

        return response(Excel::raw($sheet, ExcelWriter::XLSX), 200, [
            'Content-Type' => self::XLSX,
            'Content-Disposition' => 'attachment; filename="'.$fileName.'.xlsx"',
        ]);
    }

    /** The format the address asks for: anything ending in .csv is CSV. */
    public static function formatOf(Request $request): string
    {
        return str_ends_with($request->path(), '.csv') ? 'csv' : 'xlsx';
    }
}
