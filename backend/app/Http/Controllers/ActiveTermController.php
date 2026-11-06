<?php

namespace App\Http\Controllers;

use App\Http\Resources\ActiveTermResource;
use App\Models\SchoolTerm;
use Illuminate\Http\JsonResponse;

class ActiveTermController extends Controller
{
    public function show(): ActiveTermResource|JsonResponse
    {
        $term = SchoolTerm::with('schoolYear')->where('is_active', true)->first();

        return $term ? new ActiveTermResource($term) : response()->json(['data' => null]);
    }
}
