<?php

namespace App\Services;

use App\Models\AutoFillRun;
use App\Models\DayPattern;
use App\Models\Room;
use App\Models\ScheduleEntry;
use App\Models\SchoolTerm;
use App\Models\Section;
use App\Models\SectionSubject;
use App\Models\Teacher;
use App\Models\User;
use App\Support\ScheduleFormat;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

/**
 * Auto-fill: places the remaining minutes of each teacher loading into free periods.
 *
 * It is a simple, predictable greedy method, not an optimizer:
 *  1. What is already on a schedule stays where it is (it is "pinned").
 *  2. The hardest loadings go first: priority subjects (PE, Homeroom), then the teachers
 *     with the most hours, then the subjects with the most minutes left. Ties go by section,
 *     subject and id, so the same data always gives the same result.
 *  3. A subject is spread over the week: one period a day until every day has one.
 *     JHS first tries the same period on every day of a bell schedule, like a real class program.
 *  4. A period is used only if the section, the teacher and (SHS) a room are all free, and
 *     it is inside the teacher's shift. Saving checks again with ConflictService, the same
 *     check as placing by hand, and the database constraints stay as the last guard.
 *  5. Anything that does not fit is listed with the reason. Nothing is dropped quietly.
 */
class AutoFillService
{
    private const DAYS = [1, 2, 3, 4, 5];

    /** @var array<string, array<int, array<int, array{0: int, 1: int}>>> busy times: "kind:id" => day => [[start, end], ...] */
    private array $busy = [];

    /** @var array<int, int> minutes a week of each teacher's whole loading in the term */
    private array $teacherMinutes = [];

    /** @var array<string, array<int, array<int, array{0: int, 1: int}>>> "level|shift" => day => periods */
    private array $shiftPeriods = [];

    public function __construct(private ConflictService $conflicts, private AuditLogger $audit) {}

    /**
     * What auto-fill would do, without saving anything.
     *
     * @return array<string, mixed>
     */
    public function preview(SchoolTerm $term, Section $from, string $scope, User $user): array
    {
        $plan = $this->plan($term, $from, $scope, $user);

        return $this->summary($plan);
    }

    /**
     * Saves the plan in one transaction, as drafts tagged with a new run. The plan is made
     * again first: if anything changed since the preview, nothing is saved.
     *
     * @return array<string, mixed>
     */
    public function apply(SchoolTerm $term, Section $from, string $scope, string $planHash, User $user): array
    {
        $plan = $this->plan($term, $from, $scope, $user);

        if ($plan['hash'] !== $planHash) {
            throw new ConflictHttpException('The schedules changed since the preview. Please review the auto-fill again.');
        }

        if ($plan['placements'] === []) {
            throw ValidationException::withMessages(['scope' => 'There is nothing to place.']);
        }

        $run = DB::transaction(function () use ($term, $from, $scope, $plan, $user) {
            $run = AutoFillRun::create([
                'term_id' => $term->id,
                'scope' => $scope,
                'scope_ref_id' => $scope === 'section' ? $from->id : ($scope === 'grade' ? $from->grade_level_id : null),
                'created_by' => $user->id,
            ]);

            foreach ($plan['placements'] as $placement) {
                $section = $plan['sectionModels'][$placement['section_id']];

                // The same check as a placement by hand.
                $clashes = $this->conflicts->findConflicts(
                    $term->id, $section, $placement['teacher_id'], $placement['room_id'],
                    [$placement['day']], $placement['start_time'], $placement['end_time'],
                );

                if ($clashes !== []) {
                    throw new ConflictHttpException("Not saved: {$clashes[0]['message']} Please review the auto-fill again.");
                }

                ScheduleEntry::create([
                    'term_id' => $term->id,
                    'section_id' => $placement['section_id'],
                    'section_subject_id' => $placement['loading_id'],
                    'teacher_id' => $placement['teacher_id'],
                    'room_id' => $placement['room_id'],
                    'day_of_week' => $placement['day'],
                    'start_time' => $placement['start_time'],
                    'end_time' => $placement['end_time'],
                    'created_by' => $user->id,
                    'auto_fill_run_id' => $run->id,
                ]);
            }

            $this->audit->log($user, 'auto_fill', 'schedule_entries', $run->id, null, [
                'term_id' => $term->id,
                'scope' => $scope,
                'placed' => count($plan['placements']),
                'unplaced' => count($plan['unplaced']),
            ]);

            return $run;
        });

        return ['run_id' => $run->id, ...$this->summary($plan)];
    }

    /**
     * Removes only the entries of this run that are still drafts. Anything changed by hand
     * since then is no longer part of the run, so it stays.
     *
     * @return array{removed: int, kept_locked: int}
     */
    public function undo(AutoFillRun $run, User $user): array
    {
        $visible = Section::visibleTo($user)->pluck('id');

        return DB::transaction(function () use ($run, $user, $visible) {
            $entries = ScheduleEntry::where('auto_fill_run_id', $run->id)->whereIn('section_id', $visible);
            $locked = (clone $entries)->where('status', '<>', 'draft')->count();
            $removed = (clone $entries)->where('status', 'draft')->delete();

            $run->update(['undone_at' => now()]);
            $this->audit->log($user, 'undo_auto_fill', 'schedule_entries', $run->id, null, ['removed' => $removed]);

            return ['removed' => $removed, 'kept_locked' => $locked];
        });
    }

    /**
     * @return array<string, mixed>
     */
    private function plan(SchoolTerm $term, Section $from, string $scope, User $user): array
    {
        $sections = $this->targets($term, $from, $scope, $user);
        $this->loadBusyTimes($term);
        $this->loadShiftPeriods($term);

        $status = DB::table('section_term_status')
            ->where('term_id', $term->id)
            ->whereIn('section_id', $sections->pluck('id'))
            ->pluck('status', 'section_id');

        $skipped = [];
        $editable = $sections->filter(function (Section $section) use ($status, &$skipped) {
            $state = $status[$section->id] ?? 'not_started';
            if (! in_array($state, ['not_started', 'draft'], true)) {
                $skipped[] = ['section' => $section->label(), 'reason' => "The schedule is {$state}, so it cannot change now."];

                return false;
            }

            return true;
        });

        $periods = $editable->mapWithKeys(fn (Section $section) => [$section->id => $this->periodsOf($section)]);
        $rooms = Room::where('is_active', true)->orderBy('room_number')->orderBy('id')->get(['id', 'room_number']);

        $placements = [];
        $unplaced = [];

        foreach ($this->tasks($term, $editable) as $task) {
            $result = $this->placeTask($task, $periods[$task['section']->id], $rooms);
            array_push($placements, ...$result['placements']);

            if ($result['left'] > 0) {
                $unplaced[] = [
                    'section_id' => $task['section']->id,
                    'section' => $task['section']->label(),
                    'subject' => $task['subject'],
                    'teacher' => $task['teacher']->printedName(),
                    'minutes_left' => $result['left'],
                    'reason' => $result['reason'],
                ];
            }
        }

        return [
            'sections' => $editable->values(),
            'sectionModels' => $editable->keyBy('id'),
            'skipped' => $skipped,
            'placements' => $placements,
            'unplaced' => $unplaced,
            'hash' => sha1(json_encode($placements)),
        ];
    }

    /**
     * One task per teacher loading that still has minutes to place, hardest first.
     *
     * @return array<int, array<string, mixed>>
     */
    private function tasks(SchoolTerm $term, Collection $sections): array
    {
        $loadings = SectionSubject::with(['subject', 'teacher'])
            ->where('term_id', $term->id)
            ->whereIn('section_id', $sections->pluck('id'))
            ->get();

        $scheduled = DB::table('subject_minutes_check')
            ->where('term_id', $term->id)
            ->whereIn('section_id', $sections->pluck('id'))
            ->pluck('scheduled_minutes', 'section_subject_id');

        $placedDays = ScheduleEntry::where('term_id', $term->id)
            ->whereIn('section_subject_id', $loadings->pluck('id'))
            ->where('status', '<>', 'rejected')
            ->get(['section_subject_id', 'day_of_week'])
            ->groupBy('section_subject_id')
            ->map(fn (Collection $entries) => $entries->countBy('day_of_week')->all());

        return $loadings
            ->map(fn (SectionSubject $loading) => [
                'loading_id' => $loading->id,
                'section' => $sections->firstWhere('id', $loading->section_id),
                'subject' => $loading->subject->name,
                'is_priority' => (bool) $loading->subject->is_priority,
                'teacher' => $loading->teacher,
                'left' => $loading->subject->minutes_per_week - (int) ($scheduled[$loading->id] ?? 0),
                'per_day' => $placedDays[$loading->id] ?? [],
            ])
            ->filter(fn (array $task) => $task['left'] > 0)
            ->sort(fn (array $a, array $b) => [
                $b['is_priority'], $this->teacherMinutes[$b['teacher']->id] ?? 0, $b['left'],
                $a['section']->gradeLevel->grade, $a['section']->name, $a['subject'], $a['loading_id'],
            ] <=> [
                $a['is_priority'], $this->teacherMinutes[$a['teacher']->id] ?? 0, $a['left'],
                $b['section']->gradeLevel->grade, $b['section']->name, $b['subject'], $b['loading_id'],
            ])
            ->values()
            ->all();
    }

    /**
     * @param  array<int, array{day: int, start: int, end: int, days: array<int, int>, slot: int}>  $periods
     * @return array{placements: array<int, array<string, mixed>>, left: int, reason: ?string}
     */
    private function placeTask(array $task, array $periods, Collection $rooms): array
    {
        $section = $task['section'];
        $teacher = $task['teacher'];
        $left = $task['left'];
        $perDay = $task['per_day'];
        $placements = [];
        $isJhs = $section->gradeLevel->level === 'JHS';

        if ($isJhs && ! $section->home_room_id) {
            return ['placements' => [], 'left' => $left, 'reason' => 'The section has no home room yet.'];
        }

        $schoolDays = collect($periods)->pluck('day')->unique()->count();

        // JHS: the same period on every day of a bell schedule, while the minutes allow.
        if ($isJhs) {
            foreach (collect($periods)->groupBy('slot') as $group) {
                $minutes = ($group[0]['end'] - $group[0]['start']) * count($group);
                $fresh = $group->every(fn ($period) => ($perDay[$period['day']] ?? 0) === 0);

                if ($minutes > $left || ! $fresh || $group->count() < 2) {
                    continue;
                }

                $room = $section->home_room_id;
                $isFree = $group->every(fn ($period) => $this->canUse($section, $teacher, $room, $period));

                if ($isFree) {
                    foreach ($group as $period) {
                        $placements[] = $this->take($task, $teacher, $room, $period);
                        $perDay[$period['day']] = ($perDay[$period['day']] ?? 0) + 1;
                    }
                    $left -= $minutes;
                    break;
                }
            }
        }

        // Then one period at a time, on the days that have the fewest of this subject.
        $reason = null;
        while ($left > 0) {
            $placed = array_sum($perDay);
            $cap = $placed < $schoolDays ? 1 : intdiv($placed, max($schoolDays, 1)) + 1;

            $candidates = collect($periods)
                ->filter(fn ($period) => $period['end'] - $period['start'] <= $left && ($perDay[$period['day']] ?? 0) < $cap)
                ->sortBy([
                    fn ($a, $b) => ($perDay[$a['day']] ?? 0) <=> ($perDay[$b['day']] ?? 0),
                    fn ($a, $b) => $a['day'] <=> $b['day'],
                    fn ($a, $b) => $a['start'] <=> $b['start'],
                ]);

            $choice = null;
            foreach ($candidates as $period) {
                $room = $this->roomFor($section, $teacher, $period, $rooms);
                if ($room !== null) {
                    $choice = [$period, $room];
                    break;
                }
            }

            if ($choice === null) {
                $reason = $this->whyNot($section, $teacher, $periods, $left, $perDay, $cap, $rooms);
                break;
            }

            [$period, $room] = $choice;
            $placements[] = $this->take($task, $teacher, $room, $period);
            $perDay[$period['day']] = ($perDay[$period['day']] ?? 0) + 1;
            $left -= $period['end'] - $period['start'];
        }

        return ['placements' => $placements, 'left' => $left, 'reason' => $reason];
    }

    /** A free room for this period: the home room for JHS, and for SHS the usual room first. */
    private function roomFor(Section $section, Teacher $teacher, array $period, Collection $rooms): ?int
    {
        if (! $this->sectionAndTeacherFree($section, $teacher, $period)) {
            return null;
        }

        if ($section->gradeLevel->level === 'JHS') {
            return $this->isFree("room:{$section->home_room_id}", $period) ? $section->home_room_id : null;
        }

        $choices = $section->home_room_id
            ? collect([$section->home_room_id])->merge($rooms->pluck('id')->reject(fn ($id) => $id === $section->home_room_id))
            : $rooms->pluck('id');

        return $choices->first(fn ($id) => $this->isFree("room:{$id}", $period));
    }

    private function canUse(Section $section, Teacher $teacher, int $room, array $period): bool
    {
        return $this->sectionAndTeacherFree($section, $teacher, $period) && $this->isFree("room:{$room}", $period);
    }

    private function sectionAndTeacherFree(Section $section, Teacher $teacher, array $period): bool
    {
        return $this->isFree("section:{$section->id}", $period)
            && $this->isFree("teacher:{$teacher->id}", $period)
            && $this->inTeacherShift($section, $teacher, $period);
    }

    /** The first thing that stops this loading, in plain words. */
    private function whyNot(Section $section, Teacher $teacher, array $periods, int $left, array $perDay, int $cap, Collection $rooms): string
    {
        $fitting = collect($periods)->filter(fn ($period) => $period['end'] - $period['start'] <= $left);

        if ($fitting->isEmpty()) {
            return "The {$left} minutes left do not match the length of any period.";
        }

        $open = $fitting->filter(fn ($period) => $this->isFree("section:{$section->id}", $period));
        if ($open->isEmpty()) {
            return 'The section has no free period left.';
        }

        $spread = $open->filter(fn ($period) => ($perDay[$period['day']] ?? 0) < $cap);
        if ($spread->isEmpty()) {
            return 'The only free periods are on days that already have this subject.';
        }

        $teacherFree = $spread->filter(fn ($period) => $this->isFree("teacher:{$teacher->id}", $period));
        if ($teacherFree->isEmpty()) {
            return "{$teacher->printedName()} has no free period that matches the section's free periods.";
        }

        $inShift = $teacherFree->filter(fn ($period) => $this->inTeacherShift($section, $teacher, $period));
        if ($inShift->isEmpty()) {
            return "The section's free periods are outside {$teacher->printedName()}'s {$teacher->shift} shift.";
        }

        return "No room is free at the section's free periods in the {$section->shift} shift.";
    }

    /** @return array<string, mixed> */
    private function take(array $task, Teacher $teacher, int $room, array $period): array
    {
        foreach (["section:{$task['section']->id}", "teacher:{$teacher->id}", "room:{$room}"] as $key) {
            $this->busy[$key][$period['day']][] = [$period['start'], $period['end']];
        }

        return [
            'section_id' => $task['section']->id,
            'loading_id' => $task['loading_id'],
            'teacher_id' => $teacher->id,
            'room_id' => $room,
            'day' => $period['day'],
            'start_time' => $this->clock($period['start']),
            'end_time' => $this->clock($period['end']),
        ];
    }

    private function isFree(string $key, array $period): bool
    {
        foreach ($this->busy[$key][$period['day']] ?? [] as [$start, $end]) {
            if ($start < $period['end'] && $end > $period['start']) {
                return false;
            }
        }

        return true;
    }

    private function inTeacherShift(Section $section, Teacher $teacher, array $period): bool
    {
        if ($teacher->shift === 'WHOLE_DAY') {
            return true;
        }

        foreach ($this->shiftPeriods["{$section->gradeLevel->level}|{$teacher->shift}"][$period['day']] ?? [] as [$start, $end]) {
            if ($start <= $period['start'] && $end >= $period['end']) {
                return true;
            }
        }

        return false;
    }

    /**
     * The class periods of a section's bell schedules, one per day.
     *
     * @return array<int, array{day: int, start: int, end: int, slot: int}>
     */
    private function periodsOf(Section $section): array
    {
        $periods = [];

        foreach (DayPattern::forSection($section)->with('timeSlots')->orderBy('id')->get() as $pattern) {
            foreach ($pattern->timeSlots->where('is_break', false)->sortBy('start_time') as $slot) {
                foreach ($pattern->day_numbers as $day) {
                    $periods[] = [
                        'day' => (int) $day,
                        'start' => $this->minutes($slot->start_time),
                        'end' => $this->minutes($slot->end_time),
                        'slot' => $slot->id,
                    ];
                }
            }
        }

        return $periods;
    }

    private function loadBusyTimes(SchoolTerm $term): void
    {
        $this->busy = [];

        $entries = ScheduleEntry::where('term_id', $term->id)
            ->where('status', '<>', 'rejected')
            ->get(['section_id', 'teacher_id', 'room_id', 'day_of_week', 'start_time', 'end_time']);

        foreach ($entries as $entry) {
            $range = [$this->minutes($entry->start_time), $this->minutes($entry->end_time)];
            $this->busy["section:{$entry->section_id}"][$entry->day_of_week][] = $range;
            if ($entry->teacher_id) {
                $this->busy["teacher:{$entry->teacher_id}"][$entry->day_of_week][] = $range;
            }
            if ($entry->room_id) {
                $this->busy["room:{$entry->room_id}"][$entry->day_of_week][] = $range;
            }
        }

        $this->teacherMinutes = DB::table('section_subjects')
            ->join('subjects', 'subjects.id', '=', 'section_subjects.subject_id')
            ->where('section_subjects.term_id', $term->id)
            ->groupBy('section_subjects.teacher_id')
            ->selectRaw('section_subjects.teacher_id, SUM(subjects.minutes_per_week) AS minutes')
            ->pluck('minutes', 'teacher_id')
            ->map(fn ($minutes) => (int) $minutes)
            ->all();
    }

    private function loadShiftPeriods(SchoolTerm $term): void
    {
        $this->shiftPeriods = [];

        foreach (DayPattern::with('timeSlots')->where('school_year_id', $term->school_year_id)->get() as $pattern) {
            foreach ($pattern->day_numbers as $day) {
                foreach ($pattern->timeSlots->where('is_break', false) as $slot) {
                    $this->shiftPeriods["{$pattern->level}|{$pattern->shift}"][(int) $day][] = [
                        $this->minutes($slot->start_time),
                        $this->minutes($slot->end_time),
                    ];
                }
            }
        }
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
            ->get()
            ->sortBy(fn (Section $section) => [$section->gradeLevel->grade, $section->name])
            ->values();
    }

    /**
     * @return array<string, mixed>
     */
    private function summary(array $plan): array
    {
        $placed = collect($plan['placements'])->groupBy('section_id');
        $unplaced = collect($plan['unplaced'])->groupBy('section_id');

        return [
            'plan_hash' => $plan['hash'],
            'placed' => count($plan['placements']),
            'unplaced_count' => count($plan['unplaced']),
            'sections' => $plan['sections']->map(fn (Section $section) => [
                'id' => $section->id,
                'label' => $section->label(),
                'placed' => $placed->get($section->id, collect())->count(),
                'minutes' => $placed->get($section->id, collect())
                    ->sum(fn (array $placement) => ScheduleFormat::minutesBetween($placement['start_time'], $placement['end_time'])),
                'unplaced' => $unplaced->get($section->id, collect())->count(),
            ])->values()->all(),
            'unplaced' => collect($plan['unplaced'])->map(fn (array $item) => collect($item)->except('section_id')->all())->all(),
            'skipped' => $plan['skipped'],
        ];
    }

    private function minutes(string $time): int
    {
        return (int) substr($time, 0, 2) * 60 + (int) substr($time, 3, 2);
    }

    private function clock(int $minutes): string
    {
        return sprintf('%02d:%02d', intdiv($minutes, 60), $minutes % 60);
    }
}
