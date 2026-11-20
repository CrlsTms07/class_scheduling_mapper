<?php

namespace App\Services;

use App\Models\Activity;
use App\Models\Building;
use App\Models\DayPattern;
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
     * 3 Sections, 4 Rooms, 5 Time Slots (bell schedule), 6 Teacher Loading, 7 Plot and submit.
     *
     * @param  array<int, int>  $scope
     * @return array<int, array{key: string, done: bool, counts: array<string, int>}>
     */
    private function steps(SchoolTerm $term, array $scope, $sections, User $user): array
    {
        $models = Section::whereIn('id', $sections->pluck('id'))->get();

        $subjects = Subject::where('school_year_id', $term->school_year_id)
            ->whereIn('grade_level_id', $scope)
            ->where('is_active', true)
            ->where(fn ($query) => $query->whereNull('term_no')->orWhere('term_no', $term->term_no))
            ->get();

        // Every subject each section should have this term, against those with a teacher.
        $needed = $models->sum(fn (Section $section) => $subjects
            ->where('grade_level_id', $section->grade_level_id)
            ->filter(fn (Subject $subject) => $subject->track_id === null || $subject->track_id === $section->track_id)
            ->count());
        $loaded = DB::table('section_subjects')
            ->where('term_id', $term->id)
            ->whereIn('section_id', $models->pluck('id'))
            ->count();

        $teacherIds = DB::table('section_subjects')
            ->where('term_id', $term->id)
            ->whereIn('section_id', $models->pluck('id'))
            ->distinct()
            ->pluck('teacher_id');
        $overHours = DB::table('section_subjects')
            ->join('subjects', 'subjects.id', '=', 'section_subjects.subject_id')
            ->join('teachers', 'teachers.id', '=', 'section_subjects.teacher_id')
            ->where('section_subjects.term_id', $term->id)
            ->whereIn('section_subjects.teacher_id', $teacherIds)
            ->groupBy('teachers.id', 'teachers.max_hours_per_week')
            ->havingRaw('SUM(subjects.minutes_per_week) > teachers.max_hours_per_week * 60')
            ->select('teachers.id')
            ->get()
            ->count();

        $teachers = Teacher::where('personnel_type', 'teaching')->where('is_active', true)->count();
        $started = $sections->where('status', '<>', 'not_started')->count();
        $submitted = $sections->whereIn('status', ['pending', 'approved'])->count();

        // The bell schedules of the departments in the user's scope (JHS, SHS), with their periods.
        // Like the Admin's setup checklist, only a department that has sections needs one; before any
        // section exists, every department in scope is counted.
        $levels = DB::table('grade_levels')->whereIn('id', $scope)->distinct()->pluck('level');
        $levelsWithSections = DB::table('sections')
            ->join('grade_levels', 'grade_levels.id', '=', 'sections.grade_level_id')
            ->where('sections.school_year_id', $term->school_year_id)
            ->whereIn('sections.grade_level_id', $scope)
            ->distinct()
            ->pluck('grade_levels.level');
        $levels = $levelsWithSections->isNotEmpty() ? $levelsWithSections : $levels;
        $patterns = DayPattern::where('school_year_id', $term->school_year_id)->whereIn('level', $levels)->withCount('timeSlots')->get();
        $bellLevels = $patterns->where('time_slots_count', '>', 0)->pluck('level')->unique();

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
                'key' => 'bell',
                'done' => $levels->isNotEmpty() && $levels->diff($bellLevels)->isEmpty(),
                'counts' => ['patterns' => $patterns->count(), 'departments' => $levels->count(), 'ready' => $bellLevels->count()],
            ],
            [
                'key' => 'loading',
                'done' => $needed > 0 && $loaded >= $needed,
                'counts' => ['loaded' => $loaded, 'needed' => $needed, 'over_hours' => $overHours],
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
                ! DayPattern::forSection($models[$section['id']])->exists() => 'no_bell_schedule',
                ! in_array($section['id'], $loadedSectionIds, true) => 'add_loading',
                default => 'plot',
            };
        });

        return collect(['revise', 'no_bell_schedule', 'add_loading', 'plot', 'submit'])
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
