<?php

namespace App\Http\Controllers;

use App\Http\Requests\ReviewScheduleRequest;
use App\Models\SchoolTerm;
use App\Models\Section;
use App\Services\ApprovalService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class ApprovalController extends Controller
{
    public function index(SchoolTerm $term, ApprovalService $approvals): JsonResponse
    {
        Gate::authorize('review', Section::class);

        return response()->json(['data' => $approvals->overview($term)]);
    }

    public function store(ReviewScheduleRequest $request, SchoolTerm $term, ApprovalService $approvals): JsonResponse
    {
        $result = $approvals->review(
            $term,
            $request->input('scope'),
            $request->scopeRefId(),
            $request->input('action'),
            $request->input('remarks'),
            $request->user(),
        );

        return response()->json(['data' => $result]);
    }
}
