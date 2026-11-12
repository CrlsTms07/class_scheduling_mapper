<?php

namespace App\Http\Controllers;

use App\Http\Requests\SaveDocumentSettingRequest;
use App\Http\Requests\SaveSchoolProfileRequest;
use App\Http\Requests\SaveSignatoryRequest;
use App\Http\Requests\UploadLogoRequest;
use App\Http\Requests\UploadSchoolPhotoRequest;
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

        $profile = DB::table('school_profile')->first();

        return response()->json(['data' => [
            'school' => $profile ? [
                'school_name' => $profile->school_name,
                'school_id' => $profile->school_id,
                'address' => $profile->address,
                'phone' => $profile->phone,
                'email' => $profile->email,
                'website' => $profile->website,
                'region' => $profile->region,
                'division' => $profile->division,
                'facebook_url' => $profile->facebook_url,
                'tagline' => $profile->tagline,
                'vision' => $profile->vision,
                'mission' => $profile->mission,
                'core_values' => $profile->core_values,
                'has_photo' => filled($profile->photo_base64),
            ] : null,
            'logos' => array_column($service->logoItems(), 'src'),
            // Where each logo is printed: at the top (the DepEd seal) or in the footer.
            'logo_items' => $service->logoItems(),
            'max_logos' => ReportSettingsService::MAX_LOGOS,
            'documents' => DB::table('report_settings')->orderBy('id')->get(),
        ]]);
    }

    public function saveProfile(SaveSchoolProfileRequest $request, ReportSettingsService $service): JsonResponse
    {
        $service->saveProfile($request->validated(), $request->user());

        return response()->json(['message' => 'The school profile was saved.']);
    }

    public function savePhoto(UploadSchoolPhotoRequest $request, ReportSettingsService $service): JsonResponse
    {
        $service->savePhoto($request->file('photo'), $request->user());

        return response()->json(['message' => 'The photo was saved.']);
    }

    public function removePhoto(Request $request, ReportSettingsService $service): JsonResponse
    {
        Gate::authorize('manage-reports');

        $service->removePhoto($request->user());

        return response()->json(['message' => 'The photo was removed.']);
    }

    public function addLogo(UploadLogoRequest $request, ReportSettingsService $service): JsonResponse
    {
        $service->addLogo($request->file('logo'), $request->user());

        return response()->json(['message' => 'The logo was added.'], 201);
    }

    public function placeLogo(Request $request, int $index, ReportSettingsService $service): JsonResponse
    {
        Gate::authorize('manage-reports');
        $data = $request->validate(['placement' => ['required', 'in:header,footer']]);

        $service->setLogoPlacement($index, $data['placement'], $request->user());

        return response()->json(['message' => 'The logo was moved.']);
    }

    public function removeLogo(Request $request, int $index, ReportSettingsService $service): JsonResponse
    {
        Gate::authorize('manage-reports');

        $service->removeLogo($index, $request->user());

        return response()->json(['message' => 'The logo was removed.']);
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
