<?php

namespace App\Http\Controllers;

use App\Http\Requests\MasterDataImportRequest;
use App\Models\SchoolYear;
use App\Services\MasterDataImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Symfony\Component\HttpFoundation\StreamedResponse;

class MasterDataImportController extends Controller
{
    /** With mode=preview, only says what each row would do; mode=commit saves it. */
    public function store(MasterDataImportRequest $request, SchoolYear $schoolYear, string $type, MasterDataImportService $imports): JsonResponse
    {
        return response()->json(['data' => $imports->run(
            $type,
            $request->file('file'),
            $request->input('on_duplicate'),
            $request->input('mode') === 'commit',
            $schoolYear,
            $request->user(),
        )]);
    }

    public function template(string $type, MasterDataImportService $imports): StreamedResponse
    {
        Gate::authorize('import-master-data');

        $book = $imports->template($type);

        return response()->streamDownload(
            fn () => IOFactory::createWriter($book, 'Xlsx')->save('php://output'),
            "{$type}-template.xlsx",
            ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        );
    }
}
