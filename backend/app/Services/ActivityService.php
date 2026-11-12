<?php

namespace App\Services;

use App\Models\Activity;
use App\Models\DayPattern;
use App\Models\ScheduleEntry;
use App\Models\SchoolTerm;
use App\Models\SchoolYear;
use App\Models\Section;
use App\Models\TimeSlot;
use App\Models\User;
use App\Support\ScheduleFormat;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Activities (Flag Ceremony, Catch-up Friday...) and placing them on many sections at once.
 *
 * An activity that takes the place of a class removes that class from the schedule only.
 * Its teacher loading stays, so the class shows again as minutes still to place (Unplaced).
 */
class ActivityService
{
    public function __construct(private AuditLogger $audit) {}

    /**
     * @return array<int, array{id: int, code: ?string, name: string, in_use: bool}>
     */
    public function listFor(SchoolYear $year): array
    {
        $used = ScheduleEntry::whereNotNull('activity_id')->distinct()->pluck('activity_id')->flip();

        return Activity::where('school_year_id', $year->id)
            ->orderBy('name')
            ->get()
            ->map(fn (Activity $activity) => [
                'id' => $activity->id,
                'code' => $activity->code,
                'name' => $activity->name,
                'in_use' => $used->has($activity->id),
            ])
            ->all();
    }

    /**
     * @param  array{code?: ?string, name: string}  $data
     */
    public function create(SchoolYear $year, array $data, User $user): Activity
    {
        $activity = Activity::create(['school_year_id' => $year->id, 'code' => $data['code'] ?? null, 'name' => $data['name']]);
        $this->audit->log($user, 'create', 'activities', $activity->id, null, $activity->toArray());

        return $activity;
    }

    /**
     * @param  array{code?: ?string, name: string}  $data
     */
    public function update(Activity $activity, array $data, User $user): void
    {
        $old = $activity->toArray();
        $activity->update(['code' => $data['code'] ?? null, 'name' => $data['name']]);
        $this->audit->log($user, 'update', 'activities', $activity->id, $old, $activity->toArray());
    }

    public function delete(Activity $activity, User $user): void
    {
        $uses = ScheduleEntry::where('activity_id', $activity->id)->count();

        if ($uses > 0) {
            throw ValidationException::withMessages([
                'activity' => "{$activity->name} is on {$uses} ".($uses === 1 ? 'period' : 'periods').' of a schedule. Remove it there first.',
            ]);
        }

        $this->audit->log($user, 'delete', 'activities', $activity->id, $activity->toArray());
        $activity->delete();
    }

    /**
     * Puts an activity at the time of $slot, on $days, for one section, its grade level or all
     * sections in the user's scope. With $isPreview, nothing is saved: the reply says what
     * would happen. Either every section is saved, or none.
     *
     * @param  array<int, int>  $days
     * @return array<string, mixed>
     */
    public function place(SchoolTerm $term, Section $from, TimeSlot $slot, Activity $activity, array $days, string $scope, User $user, bool $isPreview): array
    {
        $plans = $this->targets($term, $from, $scope, $user)
            ->map(fn (Section $section) => $this->planFor($term, $section, $slot, $days))
            ->values();

        $summary = [
            'activity' => $activity->name,
            'time' => ScheduleFormat::time($slot->start_time).' – '.ScheduleFormat::time($slot->end_time),
            'sections' => $plans->map(fn (array $plan) => [
                'id' => $plan['section']->id,
                'label' => $plan['section']->label(),
                'days' => $plan['days'],
                'skipped' => $plan['skipped'],
                'unplaced' => $plan['unplaced'],
            ])->all(),
            'placed_sections' => $plans->whereNull('skipped')->count(),
            'unplaced_classes' => $plans->whereNull('skipped')->sum(fn (array $plan) => count($plan['unplaced'])),
        ];

        if ($isPreview || $summary['placed_sections'] === 0) {
            return $summary;
        }

        DB::transaction(function () use ($term, $plans, $slot, $activity, $user, $summary) {
            foreach ($plans->whereNull('skipped') as $plan) {
                $plan['replaced']->each->delete();

                foreach ($plan['days'] as $day) {
                    ScheduleEntry::create([
                        'term_id' => $term->id,
                        'section_id' => $plan['section']->id,
                        'activity_id' => $activity->id,
                        'day_of_week' => $day,
                        'start_time' => $slot->start_time,
                        'end_time' => $slot->end_time,
                        'created_by' => $user->id,
                    ]);
                }
            }

            $this->audit->log($user, 'place_activity', 'schedule_entries', $activity->id, null, [
                'term_id' => $term->id,
                'sections' => $summary['placed_sections'],
                'unplaced_classes' => $summary['unplaced_classes'],
            ]);
        });

        return $summary;
    }

    /**
     * @return Collection<int, Section>
     */
    private function targets(SchoolTerm $term, Section $from, string $scope, User $user): Collection
    {
        if ($scope === 'section') {
            return collect([$from->loadMissing('gradeLevel')]);
        }

        return Section::visibleTo($user)
            ->with('gradeLevel')
            ->where('school_year_id', $term->school_year_id)
            ->when($scope === 'grade', fn ($query) => $query->where('grade_level_id', $from->grade_level_id))
            ->join('grade_levels', 'grade_levels.id', '=', 'sections.grade_level_id')
            ->orderBy('grade_levels.grade')
            ->orderBy('sections.name')
            ->select('sections.*')
            ->get();
    }

    /**
     * What placing the activity means for one section: on which days it fits its own bell
     * schedule, which classes it takes the place of, or why the section is left out.
     *
     * @param  array<int, int>  $days
     * @return array<string, mixed>
     */
    private function planFor(SchoolTerm $term, Section $section, TimeSlot $slot, array $days): array
    {
        $plan = ['section' => $section, 'days' => [], 'skipped' => null, 'unplaced' => [], 'replaced' => collect()];

        $status = DB::table('section_term_status')
            ->where('term_id', $term->id)
            ->where('section_id', $section->id)
            ->value('status');

        if (! in_array($status, ['not_started', 'draft'], true)) {
            $plan['skipped'] = "The schedule is {$status}, so it cannot change now.";

            return $plan;
        }

        // Sections on another bell schedule get it only where they have the same period.
        $patterns = DayPattern::forSection($section)->with('timeSlots')->get();
        $plan['days'] = array_values(array_filter($days, fn (int $day) => $patterns->contains(
            fn (DayPattern $pattern) => in_array($day, $pattern->day_numbers)
                && $pattern->timeSlots->contains(fn (TimeSlot $own) => ! $own->is_break
                    && $own->start_time === $slot->start_time
                    && $own->end_time === $slot->end_time),
        )));

        if ($plan['days'] === []) {
            $plan['skipped'] = 'Its bell schedule has no period at this time.';

            return $plan;
        }

        $plan['replaced'] = ScheduleEntry::with(['sectionSubject.subject', 'activity'])
            ->where('term_id', $term->id)
            ->where('section_id', $section->id)
            ->where('status', '<>', 'rejected')
            ->whereIn('day_of_week', $plan['days'])
            ->where('start_time', '<', $slot->end_time)
            ->where('end_time', '>', $slot->start_time)
            ->orderBy('day_of_week')
            ->get();

        $plan['unplaced'] = $plan['replaced']
            ->filter(fn (ScheduleEntry $entry) => $entry->section_subject_id !== null)
            ->groupBy(fn (ScheduleEntry $entry) => $entry->subjectName())
            ->map(fn (Collection $entries, string $subject) => $subject.' ('.$entries
                ->map(fn (ScheduleEntry $entry) => ScheduleFormat::dayName($entry->day_of_week))
                ->implode(', ').')')
            ->values()
            ->all();

        return $plan;
    }
}
