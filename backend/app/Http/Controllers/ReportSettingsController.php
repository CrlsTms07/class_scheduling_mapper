<?php

namespace App\Http\Controllers;

use App\Http\Requests\SaveDocumentSettingRequest;
use App\Http\Requests\SaveSchoolProfileRequest;
use App\Http\Requests\SaveSignatoryRequest;
use App\Models\SchoolTerm;
use App\Services\ReportSettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class ReportSettingsController extends Controller
{
    public function index(ReportSettingsService $service): JsonResponse
    {
        Gate::authorize('manage-reports');

        $profile = \App\Support\SchoolProfile::current();

        return response()->json(['data' => [
            // Fixed details (config/school.php) and the three the Admin keeps up to date.
            'school' => [
                'school_name' => $profile->school_name,
                'school_id' => $profile->school_id,
                'address' => $profile->address,
                'region' => $profile->region,
                'division' => $profile->division,
                'phone' => $profile->phone,
                'email' => $profile->email,
                'facebook_url' => $profile->facebook_url,
                'logo' => \App\Support\SchoolProfile::logoDataUri(),
            ],
            'documents' => DB::table('report_settings')->orderBy('id')->get(),
        ]]);
    }

    public function saveProfile(SaveSchoolProfileRequest $request, ReportSettingsService $service): JsonResponse
    {
        $service->saveProfile($request->validated(), $request->user());

        return response()->json(['message' => 'The school profile was saved.']);
    }

    public function saveDocument(SaveDocumentSettingRequest $request, ReportSettingsService $service): JsonResponse
    {
        $service->saveDocument($request->validated(), $request->user());

        return response()->json(['message' => 'The document settings were saved.']);
    }

    public function signatories(SchoolTerm $term): JsonResponse
    {
        Gate::authorize('manage-reports');

        return response()->json(['data' => DB::table('report_signatories')
            ->where('term_id', $term->id)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()]);
    }

    public function saveSignatorySlots(\App\Http\Requests\SaveSignatorySlotsRequest $request, SchoolTerm $term, ReportSettingsService $service): JsonResponse
    {
        $service->saveSlots($term, $request->validated(), $request->user());

        return response()->json(['message' => "The signatories of {$term->name} were saved."]);
    }

    public function addSignatory(SaveSignatoryRequest $request, SchoolTerm $term, ReportSettingsService $service): JsonResponse
    {
        $id = $service->addSignatory($term, $request->validated(), $request->user());

        return response()->json(['data' => ['id' => $id]], 201);
    }

    public function updateSignatory(SaveSignatoryRequest $request, int $signatory, ReportSettingsService $service): JsonResponse
    {
        abort_unless(DB::table('report_signatories')->where('id', $signatory)->exists(), 404);

        $service->updateSignatory($signatory, $request->validated(), $request->user());

        return response()->json(['message' => 'The signatory was saved.']);
    }

    public function deleteSignatory(Request $request, int $signatory, ReportSettingsService $service): JsonResponse
    {
        Gate::authorize('manage-reports');
        abort_unless(DB::table('report_signatories')->where('id', $signatory)->exists(), 404);

        $service->deleteSignatory($signatory, $request->user());

        return response()->json(['message' => 'The signatory was removed.']);
    }

    public function moveSignatory(Request $request, int $signatory, ReportSettingsService $service): JsonResponse
    {
        Gate::authorize('manage-reports');
        abort_unless(DB::table('report_signatories')->where('id', $signatory)->exists(), 404);

        $direction = $request->validate(['direction' => ['required', Rule::in(['up', 'down'])]])['direction'];

        $service->moveSignatory($signatory, $direction, $request->user());

        return response()->json(['message' => 'The order was saved.']);
    }

    public function copySignatories(Request $request, SchoolTerm $term, ReportSettingsService $service): JsonResponse
    {
        Gate::authorize('manage-reports');

        $count = $service->copyToOtherTerms($term, $request->user());

        return response()->json(['data' => ['terms' => $count]]);
    }
}
