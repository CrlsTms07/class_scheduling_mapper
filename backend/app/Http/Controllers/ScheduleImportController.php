<?php

namespace App\Http\Controllers;

use App\Http\Requests\ImportScheduleRequest;
use App\Models\SchoolTerm;
use App\Services\ScheduleImportService;
use Illuminate\Http\JsonResponse;

class ScheduleImportController extends Controller
{
    /** With preview, only checks the rows. Otherwise saves the good ones as drafts. With set_up, first creates what the file names but the system lacks. */
    public function store(ImportScheduleRequest $request, SchoolTerm $term, ScheduleImportService $import): JsonResponse
    {
        return response()->json([
            'data' => $import->import($term, $request->file('file'), $request->user(), $request->boolean('preview'), $request->boolean('set_up')),
        ]);
    }
}
