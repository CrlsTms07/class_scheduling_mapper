<?php

namespace App\Services;

use App\Models\DayPattern;
use App\Models\SchoolTerm;
use App\Models\Section;
use App\Models\Teacher;
use App\Models\User;
use App\Support\ScheduleFormat;
use Illuminate\Support\Facades\DB;

/**
 * What the Admin needs to see first: what is waiting, what needs checking,
 * and what is still missing before schedules can be made.
 */
class AdminDashboardService
{
    public function __construct(private ApprovalService $approvals) {}

    /**
     * @return array<string, mixed>
     */
    public function overview(SchoolTerm $term): array
    {
        $sections = collect($this->approvals->overview($term));
        $flags = $sections->flatMap(fn (array $section) => $section['flags']);

        return [
            'pending_sections' => $sections->where('status', 'pending')->count(),
            'pending_accounts' => User::where('status', 'pending')->count(),
            'flags' => [
                'total' => $flags->count(),
                'urgent' => $flags->where('severity', 'red')->count(),
                'sections' => $sections->filter(fn (array $section) => $section['flags'] !== [])->count(),
            ],
            'progress' => $this->progress($sections),
            'overloaded_teachers' => $this->overloadedTeachers($term),
            'checklist' => $this->checklist($term),
        ];
    }

    /**
     * How many sections of each grade are at each stage.
     *
     * @return array<int, array<string, mixed>>
     */
    private function progress($sections): array
    {
        return $sections
            ->groupBy('grade')
            ->map(fn ($group, $grade) => [
                'grade' => $grade,
                'level' => $group->first()['level'],
                'sections' => $group->count(),
                'not_started' => $group->where('status', 'not_started')->count(),
                'draft' => $group->where('status', 'draft')->count(),
                'pending' => $group->where('status', 'pending')->count(),
                'approved' => $group->where('status', 'approved')->count(),
                'rejected' => $group->where('status', 'rejected')->count(),
            ])
            ->sortBy('grade')
            ->values()
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function overloadedTeachers(SchoolTerm $term): array
    {
        $rows = DB::table('teacher_load')
            ->where('term_id', $term->id)
            ->where('is_overloaded', true)
            ->orderByDesc('subject_count')
            ->get();

        $teachers = Teacher::whereIn('id', $rows->pluck('teacher_id'))->get()->keyBy('id');

        return $rows->map(fn ($row) => [
            'id' => $row->teacher_id,
            'name' => $teachers[$row->teacher_id]->printedName(),
            'assigned' => (int) $row->subject_count,
            'limit' => (int) $row->max_subjects,
        ])->all();
    }

    /**
     * The setup of the school year, in the order it is best done.
     *
     * @return array<int, array{key: string, title: string, done: bool, detail: string}>
     */
    private function checklist(SchoolTerm $term): array
    {
        return [
            $this->calendarItem(),
            $this->schoolProfileItem(),
            $this->timeSlotsItem($term),
            $this->sectionsItem($term),
            $this->signatoriesItem($term),
            $this->schedulersItem(),
        ];
    }

    private function calendarItem(): array
    {
        $active = SchoolTerm::with('schoolYear')->where('is_active', true)->first();

        return [
            'key' => 'calendar',
            'title' => 'School year and active term',
            'done' => $active !== null,
            'detail' => $active
                ? "{$active->name}, SY {$active->schoolYear->name} is active."
                : 'No term is active yet.',
        ];
    }

    private function schoolProfileItem(): array
    {
        $profile = DB::table('school_profile')->first();

        return [
            'key' => 'school_profile',
            'title' => 'School profile',
            'done' => $profile !== null,
            'detail' => $profile ? $profile->school_name : 'The printed forms need the school details.',
        ];
    }

    /**
     * Every department and shift that has sections needs a bell schedule for all five days.
     */
    private function timeSlotsItem(SchoolTerm $term): array
    {
        $patterns = DayPattern::withCount('timeSlots')
            ->where('school_year_id', $term->school_year_id)
            ->get();

        $needed = Section::with('gradeLevel')
            ->where('school_year_id', $term->school_year_id)
            ->get()
            ->map(fn (Section $section) => ['level' => $section->gradeLevel->level, 'shift' => $section->shift])
            ->unique()
            ->values();

        $problems = [];

        foreach ($needed as ['level' => $level, 'shift' => $shift]) {
            $covered = $patterns
                ->where('level', $level)
                ->where('shift', $shift)
                ->where('time_slots_count', '>', 0)
                ->flatMap(fn (DayPattern $pattern) => $pattern->day_numbers);

            $missing = collect(range(1, 5))->diff($covered);

            if ($missing->isNotEmpty()) {
                $days = $missing->map(fn (int $day) => ScheduleFormat::dayName($day))->join(', ');
                $problems[] = "{$level} ".str_replace('_', ' ', $shift).": no periods on {$days}";
            }
        }

        if ($patterns->isEmpty()) {
            $problems = $problems === [] ? ['No bell schedule yet.'] : $problems;
        }

        return [
            'key' => 'time_slots',
            'title' => 'Time slots and breaks',
            'done' => $problems === [],
            'detail' => $problems === []
                ? $patterns->count().' '.($patterns->count() === 1 ? 'bell schedule' : 'bell schedules').' ready.'
                : implode('. ', $problems),
        ];
    }

    private function sectionsItem(SchoolTerm $term): array
    {
        $sections = Section::where('school_year_id', $term->school_year_id);
        $total = (clone $sections)->count();
        $withoutAdviser = (clone $sections)->whereNull('adviser_id')->count();

        $detail = match (true) {
            $total === 0 => 'No sections yet.',
            $withoutAdviser > 0 => "{$total} encoded, {$withoutAdviser} without an adviser.",
            default => "{$total} encoded, all with advisers.",
        };

        return [
            'key' => 'sections',
            'title' => 'Sections and advisers',
            'done' => $total > 0 && $withoutAdviser === 0,
            'detail' => $detail,
        ];
    }

    private function signatoriesItem(SchoolTerm $term): array
    {
        $hasSignatories = DB::table('report_signatories')->where('term_id', $term->id)->exists();

        return [
            'key' => 'signatories',
            'title' => 'Report signatories',
            'done' => $hasSignatories,
            'detail' => $hasSignatories
                ? "Set for {$term->name}."
                : "None for {$term->name} yet.",
        ];
    }

    private function schedulersItem(): array
    {
        $schedulers = User::role(['glc', 'master_teacher'])->where('status', 'active')->count();

        return [
            'key' => 'schedulers',
            'title' => 'Chairpersons and Master Teachers',
            'done' => $schedulers > 0,
            'detail' => $schedulers > 0
                ? "{$schedulers} active ".($schedulers === 1 ? 'account' : 'accounts').' can make schedules.'
                : 'No one can make schedules yet. Activate their accounts.',
        ];
    }
}
