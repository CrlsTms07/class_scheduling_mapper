<?php

namespace App\Http\Controllers;

use App\Http\Requests\ImportScheduleRequest;
use App\Models\SchoolTerm;
use App\Models\User;
use App\Services\ScheduleImportService;
use App\Support\SheetResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class ScheduleImportController extends Controller
{
    /** The template to fill in, as CSV or XLSX. */
    public function template(Request $request, SchoolTerm $term, ScheduleImportService $import): Response
    {
        abort_unless($request->user()->hasAnyRole([User::ROLE_ADMIN, 'glc', 'master_teacher']), 403);

        return SheetResponse::make($import->template($term, $request->user()), 'schedule-import-template', SheetResponse::formatOf($request));
    }

    /** With preview, only checks the rows. Otherwise saves the good ones as drafts. With set_up, first creates what the file names but the system lacks. */
    public function store(ImportScheduleRequest $request, SchoolTerm $term, ScheduleImportService $import): JsonResponse
    {
        return response()->json([
            'data' => $import->import($term, $request->file('file'), $request->user(), $request->boolean('preview'), $request->boolean('set_up')),
        ]);
    }
}
