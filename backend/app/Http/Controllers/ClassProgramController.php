<?php

namespace App\Http\Controllers;

use App\Models\SchoolTerm;
use App\Models\Section;
use App\Services\ReportService;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class ClassProgramController extends Controller
{
    public function show(SchoolTerm $term, Section $section, ReportService $reports): Response
    {
        Gate::authorize('view', $section);
        abort_unless($term->school_year_id === $section->school_year_id, 404);

        $fileName = Str::slug("class-program-{$section->label()}-{$term->name}").'.pdf';

        return response($reports->classProgramPdf($term, $section), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$fileName.'"',
        ]);
    }
}
