<?php

namespace App\Http\Controllers;

use App\Http\Requests\SaveSectionRequest;
use App\Http\Requests\StoreTrackRequest;
use App\Http\Resources\ManagedSectionResource;
use App\Models\Room;
use App\Models\SchoolYear;
use App\Models\Section;
use App\Models\Teacher;
use App\Services\AuditLogger;
use App\Services\SectionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

/**
 * The Admin encodes sections once per school year.
 */
class ManagedSectionController extends Controller
{
    private const WITH = ['gradeLevel', 'track', 'adviser', 'coAdviser', 'homeRoom.building'];

    public function index(SchoolYear $schoolYear): AnonymousResourceCollection
    {
        Gate::authorize('manage', Section::class);

        $sections = Section::with(self::WITH)
            ->where('school_year_id', $schoolYear->id)
            ->get()
            ->sortBy(fn (Section $section) => [$section->gradeLevel->grade, $section->name])
            ->values();

        return ManagedSectionResource::collection($sections);
    }

    /**
     * The choices of the section form. A teacher who already advises a section says which.
     */
    public function options(SchoolYear $schoolYear): JsonResponse
    {
        Gate::authorize('manage', Section::class);

        $advisories = Section::with('gradeLevel')
            ->where('school_year_id', $schoolYear->id)
            ->whereNotNull('adviser_id')
            ->get()
            ->keyBy('adviser_id');

        $teachers = Teacher::where('personnel_type', 'teaching')
            ->where('is_active', true)
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get()
            ->map(fn (Teacher $teacher) => [
                'id' => $teacher->id,
                'name' => $teacher->printedName(),
                'advises_section_id' => $advisories->get($teacher->id)?->id,
                'advises' => $advisories->get($teacher->id)?->label(),
            ]);

        $rooms = Room::with('building')
            ->where('is_active', true)
            ->orderBy('building_id')
            ->orderBy('room_number')
            ->get()
            ->map(fn (Room $room) => ['id' => $room->id, 'label' => $room->label()]);

        return response()->json(['data' => [
            'grade_levels' => DB::table('grade_levels')->orderBy('grade')->get(['id', 'grade', 'level']),
            'tracks' => DB::table('tracks')->orderBy('name')->get(['id', 'name']),
            'teachers' => $teachers,
            'rooms' => $rooms,
        ]]);
    }

    public function store(SaveSectionRequest $request, SchoolYear $schoolYear, SectionService $service): JsonResponse
    {
        $section = $service->create($schoolYear, $request->validated(), $request->user());

        return (new ManagedSectionResource($section->load(self::WITH)))->response()->setStatusCode(201);
    }

    public function update(SaveSectionRequest $request, Section $section, SectionService $service): ManagedSectionResource
    {
        $updated = $service->update($section, $request->validated(), $request->user());

        return new ManagedSectionResource($updated->load(self::WITH));
    }

    public function destroy(Request $request, Section $section, SectionService $service): JsonResponse
    {
        Gate::authorize('manage', Section::class);

        $service->delete($section, $request->user());

        return response()->json(['message' => "{$section->name} was deleted."]);
    }

    /**
     * A misspelled track can go, but not one that sections or subjects are using.
     */
    public function destroyTrack(Request $request, int $track, AuditLogger $audit): JsonResponse
    {
        Gate::authorize('manage', Section::class);

        $row = DB::table('tracks')->where('id', $track)->first();
        abort_unless($row, 404);

        $sections = DB::table('sections')->where('track_id', $track)->count();
        $subjects = DB::table('subjects')->where('track_id', $track)->count();

        if ($sections + $subjects > 0) {
            throw ValidationException::withMessages([
                'track' => "{$row->name} is used by {$sections} sections and {$subjects} subjects, so it stays.",
            ]);
        }

        DB::table('tracks')->where('id', $track)->delete();
        $audit->log($request->user(), 'delete', 'tracks', $track, ['name' => $row->name]);

        return response()->json(['message' => 'The track was deleted.']);
    }

    public function storeTrack(StoreTrackRequest $request, AuditLogger $audit): JsonResponse
    {
        $name = trim($request->input('name'));
        $id = DB::table('tracks')->insertGetId(['name' => $name]);

        $audit->log($request->user(), 'create', 'tracks', $id, null, ['name' => $name]);

        return response()->json(['data' => ['id' => $id, 'name' => $name]], 201);
    }
}
