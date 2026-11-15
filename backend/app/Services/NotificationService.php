<?php

namespace App\Services;

use App\Models\Section;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * What each person should know about, worked out from what is in the system now and from the
 * Admin's recent decisions. Nothing is stored, so a notification can never go out of date.
 */
class NotificationService
{
    private const DAYS_KEPT = 30;

    private const LIMIT = 20;

    /**
     * @return array<int, array{key: string, title: string, body: string, link: string, at: string}>
     */
    public function for(User $user): array
    {
        $items = match (true) {
            $user->hasRole(User::ROLE_ADMIN) => $this->forAdmin(),
            $user->hasAnyRole(['glc', 'master_teacher']) => $this->forScheduler($user),
            $user->hasRole('teacher') => $this->forTeacher($user),
            default => collect(),
        };

        return $items->sortByDesc('at')->take(self::LIMIT)->values()->all();
    }

    private function forAdmin(): Collection
    {
        $pending = DB::table('schedule_entries')
            ->join('school_terms', 'school_terms.id', '=', 'schedule_entries.term_id')
            ->where('schedule_entries.status', 'pending')
            ->groupBy('school_terms.id', 'school_terms.name')
            ->selectRaw('school_terms.id, school_terms.name, COUNT(DISTINCT schedule_entries.section_id) AS sections, MAX(schedule_entries.updated_at) AS at')
            ->get()
            ->map(fn ($row) => [
                'key' => "pending:{$row->id}",
                'title' => "{$row->sections} ".((int) $row->sections === 1 ? 'section is' : 'sections are').' waiting for approval',
                'body' => "Submitted for {$row->name}. Review them in Approvals.",
                'link' => '/approvals',
                'at' => $this->time($row->at),
            ]);

        $accounts = DB::table('users')->where('status', 'pending')->selectRaw('COUNT(*) AS total, MAX(created_at) AS at')->first();

        $signUps = (int) $accounts->total === 0 ? collect() : collect([[
            'key' => 'accounts',
            'title' => "{$accounts->total} ".((int) $accounts->total === 1 ? 'account is' : 'accounts are').' waiting to be activated',
            'body' => 'Activate them and give each a role in Users.',
            'link' => '/users',
            'at' => $this->time($accounts->at),
        ]]);

        return $pending->concat($signUps);
    }

    /**
     * The Admin's decisions on the sections this person schedules.
     */
    private function forScheduler(User $user): Collection
    {
        $scope = Section::whereIn('grade_level_id', $user->gradeLevelIdsInScope())->pluck('id');

        return $this->recentReviews()->flatMap(function ($review) use ($scope) {
            $sectionIds = $this->sectionsOf($review)->intersect($scope);

            if ($sectionIds->isEmpty()) {
                return [];
            }

            $labels = $this->labels($sectionIds);
            $verb = ['approve' => 'Approved', 'reject' => 'Rejected', 'reopen' => 'Reopened'][$review->action];
            $note = match ($review->action) {
                'approve' => 'Teachers and guests can now see it.',
                'reject' => "Remarks: {$review->remarks} Open it, revise, then submit again.",
                'reopen' => "Reason: {$review->remarks} It is a draft again.",
            };

            return [[
                'key' => "review:{$review->id}",
                'title' => "{$verb}: {$labels}",
                'body' => "{$review->term_name}. {$note}",
                'link' => $sectionIds->count() === 1 ? "/schedule/sections/{$sectionIds->first()}" : '/schedule',
                'at' => $this->time($review->created_at),
            ]];
        });
    }

    /**
     * A teacher hears when their own classes become final, or are opened again.
     */
    private function forTeacher(User $user): Collection
    {
        $teacherId = $user->teacher?->id;

        if ($teacherId === null) {
            return collect();
        }

        return $this->recentReviews()
            ->whereIn('action', ['approve', 'reopen'])
            ->flatMap(function ($review) use ($teacherId) {
                $sectionIds = DB::table('schedule_entries')
                    ->where('review_id', $review->id)
                    ->where('teacher_id', $teacherId)
                    ->distinct()
                    ->pluck('section_id');

                if ($sectionIds->isEmpty()) {
                    return [];
                }

                return [[
                    'key' => "review:{$review->id}",
                    'title' => $review->action === 'approve' ? 'Your schedule was approved' : 'Your schedule is being updated',
                    'body' => "{$review->term_name}: {$this->labels($sectionIds)}.",
                    'link' => '/my-schedule',
                    'at' => $this->time($review->created_at),
                ]];
            });
    }

    private function recentReviews(): Collection
    {
        return DB::table('schedule_reviews')
            ->join('school_terms', 'school_terms.id', '=', 'schedule_reviews.term_id')
            ->where('schedule_reviews.created_at', '>=', now()->subDays(self::DAYS_KEPT))
            ->orderByDesc('schedule_reviews.created_at')
            ->limit(self::LIMIT * 2)
            ->get(['schedule_reviews.*', 'school_terms.name as term_name']);
    }

    private function sectionsOf(object $review): Collection
    {
        return DB::table('schedule_entries')->where('review_id', $review->id)->distinct()->pluck('section_id');
    }

    private function labels(Collection $sectionIds): string
    {
        $labels = Section::with('gradeLevel')->whereIn('id', $sectionIds)->get()
            ->sortBy(fn (Section $section) => [$section->gradeLevel->grade, $section->name])
            ->map(fn (Section $section) => $section->label())
            ->values();

        return $labels->count() > 3
            ? $labels->take(3)->join(', ').' and '.($labels->count() - 3).' more'
            : $labels->join(', ');
    }

    private function time(?string $value): string
    {
        return $value ? date(DATE_ATOM, strtotime($value)) : now()->toAtomString();
    }
}
