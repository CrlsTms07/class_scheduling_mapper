<?php

namespace App\Services;

use App\Models\Activity;
use App\Models\Building;
use App\Models\Room;
use App\Models\SchoolTerm;
use App\Models\Section;
use App\Models\Subject;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * What a Chairperson or Master Teacher should do next, for their own grade levels only.
 */
class SchedulerDashboardService
{
    public function __construct(
        private ApprovalService $approvals,
        private AdminDashboardService $dashboard,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function overview(SchoolTerm $term, User $user): array
    {
        $scope = $user->gradeLevelIdsInScope();
        $sections = collect($this->approvals->overview($term, $scope));
        $flags = $sections->flatMap(fn (array $section) => $section['flags']);

        $loadedSectionIds = DB::table('section_subjects')
            ->where('term_id', $term->id)
            ->whereIn('section_id', $sections->pluck('id'))
            ->pluck('section_id')
            ->unique()
            ->all();

        $teacherIds = DB::table('section_subjects')
            ->where('term_id', $term->id)
            ->whereIn('section_id', $sections->pluck('id'))
            ->pluck('teacher_id')
            ->unique()
            ->all();

        return [
            'has_scope' => $scope !== [],
            'sections' => $sections->count(),
            'pending_sections' => $sections->where('status', 'pending')->count(),
            'approved_sections' => $sections->where('status', 'approved')->count(),
            'flags' => [
                'total' => $flags->count(),
                'urgent' => $flags->where('severity', 'red')->count(),
                'sections' => $sections->filter(fn (array $section) => $section['flags'] !== [])->count(),
            ],
            'next_steps' => $this->nextSteps($term, $sections, $loadedSectionIds),
            'steps' => $this->steps($term, $scope, $sections, $user),
            'progress' => $this->dashboard->progress($sections),
            'overloaded_teachers' => $this->dashboard->overloadedTeachers($term, $teacherIds),
        ];
    }

    /**
     * The steps of making a schedule, in the order of the Setup menu, each with how far along it is
     * (one order everywhere, after the beneficiary's review, Nov 21, 2026): 1 Teachers, 2 Subjects,
     * 3 Sections, 4 Rooms, 5 Teacher Loading, 6 Plot and submit. The class times are chosen while
     * plotting, so the bell schedule is not a step of its own.
     *
     * @param  array<int, int>  $scope
     * @return array<int, array{key: string, done: bool, counts: array<string, int>}>
     */
    private function steps(SchoolTerm $term, array $scope, $sections, User $user): array
    {
        $models = Section::whereIn('id', $sections->pluck('id'))->get();

        $subjects = Subject::where('school_year_id', $term->school_year_id)
            ->where(fn ($query) => $query->whereNull('grade_level_id')->orWhereIn('grade_level_id', $scope))
            ->where('is_active', true)
            ->where(fn ($query) => $query->whereNull('term_no')->orWhere('term_no', $term->term_no))
            ->get();

        // What each section should have this term: the subjects made for its grade (before Nov 21,
        // 2026) plus those added to it. Done when every section has subjects and all have a teacher.
        $loadedRows = DB::table('section_subjects')
            ->join('subjects', 'subjects.id', '=', 'section_subjects.subject_id')
            ->where('section_subjects.term_id', $term->id)
            ->whereIn('section_subjects.section_id', $models->pluck('id'))
            ->get(['section_subjects.section_id', 'subjects.grade_level_id']);
        $needed = $models->sum(fn (Section $section) => $subjects
            ->where('grade_level_id', $section->grade_level_id)
            ->filter(fn (Subject $subject) => $subject->track_id === null || $subject->track_id === $section->track_id)
            ->count()) + $loadedRows->whereNull('grade_level_id')->count();
        $loaded = $loadedRows->count();
        $everySectionLoaded = $models->every(fn (Section $section) => $loadedRows->contains('section_id', $section->id));

        $teachers = Teacher::where('personnel_type', 'teaching')->where('is_active', true)->count();
        $started = $sections->where('status', '<>', 'not_started')->count();
        $submitted = $sections->whereIn('status', ['pending', 'approved'])->count();

        $rooms = [
            'key' => 'rooms',
            'done' => Room::where('is_active', true)->visibleTo($user)->exists(),
            'counts' => [
                'rooms' => Room::where('is_active', true)->visibleTo($user)->count(),
                'buildings' => Building::visibleTo($user)->count(),
            ],
        ];

        return [
            ['key' => 'teachers', 'done' => $teachers > 0, 'counts' => ['teachers' => $teachers]],
            [
                'key' => 'subjects',
                'done' => $subjects->isNotEmpty(),
                'counts' => [
                    'subjects' => $subjects->count(),
                    'activities' => Activity::where('school_year_id', $term->school_year_id)->visibleTo($user)->count(),
                ],
            ],
            [
                'key' => 'sections',
                'done' => $models->isNotEmpty() && $models->every(fn (Section $section) => $section->adviser_id !== null),
                'counts' => ['sections' => $models->count(), 'without_adviser' => $models->whereNull('adviser_id')->count()],
            ],
            $rooms,
            [
                'key' => 'loading',
                'done' => $models->isNotEmpty() && $everySectionLoaded && $loaded >= $needed,
                'counts' => ['loaded' => $loaded, 'needed' => $needed],
            ],
            [
                'key' => 'plot',
                'done' => $models->isNotEmpty() && $submitted === $models->count(),
                'counts' => ['sections' => $models->count(), 'started' => $started, 'submitted' => $submitted],
            ],
        ];
    }

    /**
     * Each section appears once, at the first thing it needs.
     *
     * @return array<int, array{key: string, sections: array<int, array{id: int, label: string}>}>
     */
    private function nextSteps(SchoolTerm $term, $sections, array $loadedSectionIds): array
    {
        $models = Section::with('gradeLevel')->whereIn('id', $sections->pluck('id'))->get()->keyBy('id');

        $grouped = $sections->groupBy(function (array $section) use ($models, $loadedSectionIds) {
            return match (true) {
                $section['status'] === 'rejected' => 'revise',
                $section['status'] === 'draft' => 'submit',
                $section['status'] !== 'not_started' => 'none',
                ! in_array($section['id'], $loadedSectionIds, true) => 'add_loading',
                default => 'plot',
            };
        });

        return collect(['revise', 'add_loading', 'plot', 'submit'])
            ->filter(fn (string $key) => $grouped->has($key))
            ->map(fn (string $key) => [
                'key' => $key,
                'sections' => $grouped[$key]
                    ->map(fn (array $section) => ['id' => $section['id'], 'label' => $section['label']])
                    ->values()
                    ->all(),
            ])
            ->values()
            ->all();
    }
}
