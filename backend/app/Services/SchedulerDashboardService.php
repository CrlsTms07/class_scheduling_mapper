<?php

namespace App\Services;

use App\Models\Activity;
use App\Models\DayPattern;
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
            'steps' => $this->steps($term, $scope, $sections),
            'progress' => $this->dashboard->progress($sections),
            'overloaded_teachers' => $this->dashboard->overloadedTeachers($term, $teacherIds),
        ];
    }

    /**
     * The four steps of making a schedule, each with how far along it is:
     * 1 Subjects and sections, 2 Teachers, 3 Load Distribution, 4 Plot.
     *
     * @param  array<int, int>  $scope
     * @return array<int, array{key: string, done: bool, counts: array<string, int>}>
     */
    private function steps(SchoolTerm $term, array $scope, $sections): array
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

        return [
            [
                'key' => 'subjects',
                'done' => $subjects->isNotEmpty() && $models->isNotEmpty(),
                'counts' => [
                    'subjects' => $subjects->count(),
                    'activities' => Activity::where('school_year_id', $term->school_year_id)->count(),
                    'sections' => $models->count(),
                ],
            ],
            ['key' => 'teachers', 'done' => $teachers > 0, 'counts' => ['teachers' => $teachers]],
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
