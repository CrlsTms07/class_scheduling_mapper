<?php

namespace App\Http\Controllers;

use App\Http\Requests\ImportPreviousRequest;
use App\Models\SchoolTerm;
use App\Services\ImportService;
use Illuminate\Http\JsonResponse;

class ImportController extends Controller
{
    /** With preview, only says what would be copied. */
    public function store(ImportPreviousRequest $request, SchoolTerm $term, ImportService $import): JsonResponse
    {
        $from = SchoolTerm::find($request->integer('from_term_id'));

        return response()->json([
            'data' => $import->importLoading($term, $from, $request->user(), $request->boolean('preview')),
        ]);
    }
}
