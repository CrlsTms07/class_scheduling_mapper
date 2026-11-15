<?php

namespace App\Http\Controllers;

use App\Http\Resources\ActiveTermResource;
use App\Models\SchoolTerm;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class TermController extends Controller
{
    /**
     * Every term, newest school year first, for the term selector.
     */
    public function index(): AnonymousResourceCollection
    {
        $terms = SchoolTerm::with('schoolYear')
            ->join('school_years', 'school_years.id', '=', 'school_terms.school_year_id')
            ->orderByDesc('school_years.start_date')
            ->orderBy('school_terms.term_no')
            ->select('school_terms.*')
            ->get();

        return ActiveTermResource::collection($terms);
    }
}
