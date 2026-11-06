<?php

namespace App\Services;

use App\Models\ScheduleEntry;
use App\Models\SchoolTerm;
use App\Models\Section;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ApprovalService
{
    // Which entries each action works on, and what they become.
    private const TRANSITIONS = [
        'approve' => ['pending', 'approved'],
        'reject' => ['pending', 'rejected'],
        'reopen' => ['approved', 'draft'],
    ];

    public function __construct(private FlagService $flags, private AuditLogger $audit) {}

    /**
     * Every section of the term's school year with its status and flags, for the Approvals screen.
     *
     * @return array<int, array<string, mixed>>
     */
    public function overview(SchoolTerm $term): array
    {
        $counts = DB::table('section_term_status')->where('term_id', $term->id)->get()->keyBy('section_id');

        return Section::with(['gradeLevel', 'adviser'])
            ->where('school_year_id', $term->school_year_id)
            ->get()
            ->sortBy(fn (Section $section) => [$section->gradeLevel->grade, $section->name])
            ->map(fn (Section $section) => [
                'id' => $section->id,
                'name' => $section->name,
                'label' => $section->label(),
                'grade_level_id' => $section->grade_level_id,
                'grade' => $section->gradeLevel->grade,
                'level' => $section->gradeLevel->level,
                'adviser' => $section->adviser?->printedName(),
                'status' => $counts[$section->id]->status ?? 'not_started',
                'pending_count' => (int) ($counts[$section->id]->pending_count ?? 0),
                'approved_count' => (int) ($counts[$section->id]->approved_count ?? 0),
                'flags' => $this->flags->forSection($section, $term->id),
            ])
            ->values()
            ->all();
    }

    /**
     * One Admin click: one schedule_reviews row, and all matching entries updated in one transaction.
     *
     * @return array{entries: int, sections: int}
     */
    public function review(SchoolTerm $term, string $scope, ?int $scopeRefId, string $action, ?string $remarks, User $admin): array
    {
        [$from, $to] = self::TRANSITIONS[$action];

        return DB::transaction(function () use ($term, $scope, $scopeRefId, $action, $remarks, $admin, $from, $to) {
            $matching = fn () => ScheduleEntry::where('term_id', $term->id)
                ->where('status', $from)
                ->whereIn('section_id', $this->sectionsInScope($term, $scope, $scopeRefId)->select('sections.id'));

            $sections = $matching()->distinct()->count('section_id');

            if ($sections === 0) {
                throw ValidationException::withMessages(['scope' => "There are no {$from} schedules in this scope."]);
            }

            $reviewId = DB::table('schedule_reviews')->insertGetId([
                'term_id' => $term->id,
                'scope' => $scope,
                'scope_ref_id' => $scopeRefId,
                'action' => $action,
                'remarks' => $remarks,
                'reviewed_by' => $admin->id,
            ]);

            $entries = $matching()->update(['status' => $to, 'review_id' => $reviewId]);

            $this->audit->log($admin, $action, 'schedule_reviews', $reviewId, null, [
                'term_id' => $term->id,
                'scope' => $scope,
                'scope_ref_id' => $scopeRefId,
                'sections' => $sections,
                'entries' => $entries,
            ]);

            return ['entries' => $entries, 'sections' => $sections];
        });
    }

    private function sectionsInScope(SchoolTerm $term, string $scope, ?int $scopeRefId): Builder
    {
        $query = Section::where('school_year_id', $term->school_year_id);

        return match ($scope) {
            'section' => $query->where('id', $scopeRefId),
            'grade_level' => $query->where('grade_level_id', $scopeRefId),
            'JHS', 'SHS' => $query->whereHas('gradeLevel', fn (Builder $grade) => $grade->where('level', $scope)),
            'all' => $query,
        };
    }
}
