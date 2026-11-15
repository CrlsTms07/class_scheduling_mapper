<?php

namespace App\Http\Controllers;

use App\Http\Requests\CopyScheduleRequest;
use App\Models\SchoolTerm;
use App\Services\TermCopyService;
use Illuminate\Http\JsonResponse;

class TermCopyController extends Controller
{
    public function store(CopyScheduleRequest $request, SchoolTerm $term, TermCopyService $copy): JsonResponse
    {
        $result = $copy->copy(
            $term,
            SchoolTerm::find($request->integer('from_term_id')),
            $request->input('section_id'),
            $request->input('grade'),
            $request->boolean('fill_subjects'),
            $request->boolean('preview'),
            $request->user(),
        );

        return response()->json(['data' => $result]);
    }
}
