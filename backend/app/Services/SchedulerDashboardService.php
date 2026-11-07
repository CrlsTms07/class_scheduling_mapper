<?php

namespace App\Services;

use App\Models\DayPattern;
use App\Models\SchoolTerm;
use App\Models\Section;
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
            'progress' => $this->dashboard->progress($sections),
            'overloaded_teachers' => $this->dashboard->overloadedTeachers($term, $teacherIds),
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
