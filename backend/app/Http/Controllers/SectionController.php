<?php

namespace App\Http\Controllers;

use App\Models\SchoolTerm;
use App\Models\Section;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SectionController extends Controller
{
    /**
     * The sections the user may see in a term's school year, with their schedule status.
     */
    public function index(Request $request, SchoolTerm $term): JsonResponse
    {
        $statuses = DB::table('section_term_status')->where('term_id', $term->id)->pluck('status', 'section_id');

        $sections = Section::visibleTo($request->user())
            ->with(['gradeLevel', 'adviser'])
            ->where('school_year_id', $term->school_year_id)
            ->get()
            ->sortBy(fn (Section $section) => [$section->gradeLevel->grade, $section->name])
            ->map(fn (Section $section) => [
                'id' => $section->id,
                'name' => $section->name,
                'grade' => $section->gradeLevel->grade,
                'level' => $section->gradeLevel->level,
                'adviser' => $section->adviser?->printedName(),
                'status' => $statuses[$section->id] ?? 'not_started',
            ])
            ->values();

        return response()->json(['data' => $sections]);
    }
}
