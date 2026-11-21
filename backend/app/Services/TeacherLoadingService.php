<?php

namespace App\Services;

use App\Models\ScheduleEntry;
use App\Models\SchoolTerm;
use App\Models\Section;
use App\Models\SectionSubject;
use App\Models\Subject;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Teacher loading: who teaches which subject to which section, per term.
 *
 * Plotted entries copy the teacher of their loading, and the database carries a change of
 * teacher into them. So a change is refused when it would break a locked schedule or
 * make the new teacher be in two places at once.
 */
class TeacherLoadingService
{
    private const EXCLUSION_VIOLATION = '23P01';

    public function __construct(private ConflictService $conflicts, private AuditLogger $audit) {}

    /**
     * @return array<string, mixed>
     */
    public function forSection(SchoolTerm $term, Section $section): array
    {
        $section->loadMissing(['gradeLevel', 'track', 'adviser']);

        return [
            'section' => [
                'id' => $section->id,
                'label' => $section->label(),
                'level' => $section->gradeLevel->level,
                'shift' => $section->shift,
                'track' => $section->track?->name,
                'adviser' => $section->adviser?->printedName(),
            ],
            'rows' => $this->rows($term, $section),
            'addable' => $this->addable($term, $section),
            'teachers' => $this->teacherChoices($term),
        ];
    }

    /**
     * One row per subject this section takes in this term, loaded or not.
     *
     * @return array<int, array<string, mixed>>
     */
    private function rows(SchoolTerm $term, Section $section): array
    {
        $loading = SectionSubject::with('teacher')
            ->where('term_id', $term->id)
            ->where('section_id', $section->id)
            ->get()
            ->keyBy('subject_id');

        $entries = ScheduleEntry::where('term_id', $term->id)
            ->where('section_id', $section->id)
            ->whereNotNull('section_subject_id')
            ->get()
            ->groupBy('section_subject_id');

        return $this->subjectsOf($term, $section, $loading->keys()->all())
            ->map(function (Subject $subject) use ($loading, $entries) {
                $item = $loading->get($subject->id);
                $placed = $item ? ($entries[$item->id] ?? collect()) : collect();

                return [
                    'subject_id' => $subject->id,
                    'subject' => $subject->name,
                    'code' => $subject->code,
                    // Counted from the schedule, never typed (beneficiary review, Nov 21, 2026).
                    'scheduled_minutes' => (int) $placed->sum(fn (ScheduleEntry $entry) => \App\Support\ScheduleFormat::minutesBetween($entry->start_time, $entry->end_time)),
                    'is_priority' => (bool) $subject->is_priority,
                    'is_active' => (bool) $subject->is_active,
                    'teacher_id' => $item?->teacher_id,
                    'teacher' => $item?->teacher->printedName(),
                    'placed_entries' => $placed->count(),
                    'locked_reason' => $this->lockReason($placed),
                ];
            })
            ->values()
            ->all();
    }

    /**
     * The subjects this section takes: those added to it (with their teacher), plus the offered
     * subjects made for its grade before Nov 21, 2026. A subject for every grade (no grade) is
     * listed only once it is added to the section, with "Add subject".
     *
     * @param  array<int, int>  $loadedSubjectIds
     */
    private function subjectsOf(SchoolTerm $term, Section $section, array $loadedSubjectIds)
    {
        return Subject::query()
            ->where('school_year_id', $section->school_year_id)
            ->where(fn ($query) => $query
                ->whereIn('id', $loadedSubjectIds)
                ->orWhere(fn ($offered) => $offered
                    ->where('grade_level_id', $section->grade_level_id)
                    ->where(fn ($inner) => $this->offeredTo($inner, $term, $section))))
            ->orderByDesc('is_priority')
            ->orderBy('name')
            ->get();
    }

    /**
     * What "Add subject" offers this section: subjects of the year that are offered now and not
     * listed yet (one form: subject, section, teacher, as the beneficiary explained).
     *
     * @return array<int, array{id: int, name: string, code: string|null}>
     */
    private function addable(SchoolTerm $term, Section $section): array
    {
        $listed = SectionSubject::where('term_id', $term->id)->where('section_id', $section->id)->pluck('subject_id');

        return Subject::query()
            ->where('school_year_id', $section->school_year_id)
            ->whereNull('grade_level_id')
            // Only subjects of the section's own level (or with no level yet).
            ->where(fn ($query) => $query->where('level', $section->gradeLevel->level)->orWhereNull('level'))
            ->whereNotIn('id', $listed)
            ->where(fn ($query) => $this->offeredTo($query, $term, $section))
            ->orderBy('name')
            ->get(['id', 'name', 'code'])
            ->map(fn (Subject $subject) => ['id' => $subject->id, 'name' => $subject->name, 'code' => $subject->code])
            ->all();
    }

    private function offeredTo($query, SchoolTerm $term, Section $section): void
    {
        $query->where('is_active', true)
            ->where(fn ($inTerm) => $inTerm->whereNull('term_no')->orWhere('term_no', $term->term_no))
            ->where(fn ($inTrack) => $inTrack->whereNull('track_id')->orWhere('track_id', $section->track_id));
    }

    /**
     * Active teaching personnel, with how much they already carry in this term.
     *
     * @return array<int, array<string, mixed>>
     */
    private function teacherChoices(SchoolTerm $term): array
    {
        $loads = DB::table('section_subjects')
            ->where('term_id', $term->id)
            ->selectRaw('teacher_id, COUNT(*) AS assigned')
            ->groupBy('teacher_id')
            ->pluck('assigned', 'teacher_id');

        // A Chairperson or Master Teacher picks from the teachers of their own level (Nov 21, 2026),
        // plus anyone already teaching a class in this term in their grade levels.
        $own = auth()->user()?->departmentsInScope();
        $departmentLevels = DB::table('departments')->pluck('level', 'id');
        $departmentNames = DB::table('departments')->pluck('name', 'id');
        $teachingHere = $own === null ? collect() : DB::table('section_subjects')
            ->join('sections', 'sections.id', '=', 'section_subjects.section_id')
            ->where('section_subjects.term_id', $term->id)
            ->whereIn('sections.grade_level_id', auth()->user()->gradeLevelIdsInScope())
            ->pluck('section_subjects.teacher_id')
            ->flip();

        return Teacher::where('personnel_type', 'teaching')
            ->where('is_active', true)
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get()
            // Teachers of the other level may be borrowed (Nov 21, 2026): they come last, marked.
            ->map(fn (Teacher $teacher) => [$teacher, $own !== null
                && ($departmentLevels[$teacher->department_id] ?? null) !== null
                && ! in_array($departmentLevels[$teacher->department_id], $own, true)
                && ! $teachingHere->has($teacher->id)])
            ->sortBy(fn (array $pair) => $pair[1] ? 1 : 0)
            ->values()
            ->map(fn (array $pair) => [...$this->teacherChoice($pair[0], $loads, $departmentNames), 'from_level' => $pair[1] ? $departmentLevels[$pair[0]->department_id] : null])
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function teacherChoice(Teacher $teacher, $loads, $departmentNames): array
    {
        return [
            'id' => $teacher->id,
            'name' => $teacher->printedName(),
            'shift' => $teacher->shift,
            'assigned' => (int) ($loads[$teacher->id] ?? 0),
            'limit' => $teacher->max_subjects,
            'department' => $departmentNames[$teacher->department_id] ?? null,
        ];
    }

    /**
     * Gives a subject to a teacher, or changes its teacher.
     */
    public function assign(SchoolTerm $term, Section $section, Subject $subject, int $teacherId, User $user): void
    {
        $existing = $this->loadingOf($term, $section, $subject);

        if ($existing?->teacher_id === $teacherId) {
            return;
        }

        if (! $existing) {
            $this->ensureOffered($term, $section, $subject);
        }

        $this->stopIfFullLoad($term, $teacherId);

        try {
            DB::transaction(function () use ($existing, $term, $section, $subject, $teacherId, $user) {
                if ($existing) {
                    $this->changeTeacher($existing, $teacherId, $user);

                    return;
                }

                $created = SectionSubject::create([
                    'term_id' => $term->id,
                    'section_id' => $section->id,
                    'subject_id' => $subject->id,
                    'teacher_id' => $teacherId,
                ]);

                $this->audit->log($user, 'create', 'section_subjects', $created->id, null, ['subject' => $subject->name, 'teacher_id' => $teacherId]);
            });
        } catch (QueryException $exception) {
            if ($exception->getCode() !== self::EXCLUSION_VIOLATION) {
                throw $exception;
            }

            // Someone else plotted this teacher after the check above.
            throw ValidationException::withMessages([
                'teacher_id' => 'This teacher was just scheduled at the same time. Please try again.',
            ]);
        }
    }

    private function changeTeacher(SectionSubject $loading, int $teacherId, User $user): void
    {
        $entries = ScheduleEntry::where('section_subject_id', $loading->id)->get();

        $reason = $this->lockReason($entries);
        if ($reason !== null) {
            throw ValidationException::withMessages(['teacher_id' => $reason]);
        }

        $clashes = $this->conflicts->teacherClashes($loading->term_id, $teacherId, $entries);
        if ($clashes !== []) {
            throw ValidationException::withMessages(['teacher_id' => implode(' ', $clashes)]);
        }

        $before = $loading->teacher_id;
        $loading->update(['teacher_id' => $teacherId]);

        $this->audit->log($user, 'update', 'section_subjects', $loading->id, ['teacher_id' => $before], ['teacher_id' => $teacherId]);
    }

    /**
     * Takes a subject back from its teacher. Anything already plotted must be cleared first,
     * so a schedule never silently loses periods.
     */
    public function remove(SchoolTerm $term, Section $section, Subject $subject, User $user): void
    {
        $loading = $this->loadingOf($term, $section, $subject);

        if (! $loading) {
            return;
        }

        $entries = ScheduleEntry::where('section_subject_id', $loading->id)->get();

        if ($entries->isNotEmpty()) {
            throw ValidationException::withMessages([
                'teacher_id' => $this->lockReason($entries)
                    ?? 'This subject is already on the schedule. Clear it in the plotter first.',
            ]);
        }

        DB::transaction(function () use ($loading, $subject, $user) {
            $before = $loading->only(['term_id', 'section_id', 'teacher_id']);
            $loading->delete();

            $this->audit->log($user, 'delete', 'section_subjects', $loading->id, [...$before, 'subject' => $subject->name]);
        });
    }

    /**
     * Copies teachers from another term of the year, for subjects taught in both. What this
     * term already has is never overwritten, and only active teaching personnel carry over.
     *
     * @param  array<int, int>|null  $sectionIds  only these sections, when given
     * @return array{copied: int, already_set: int, not_offered: int, teacher_unavailable: int, full_load: int}
     */
    public function copyFromTerm(SchoolTerm $term, SchoolTerm $from, ?array $sectionIds, User $user): array
    {
        $result = ['copied' => 0, 'already_set' => 0, 'not_offered' => 0, 'teacher_unavailable' => 0, 'full_load' => 0];

        return DB::transaction(function () use ($term, $from, $sectionIds, $user, $result) {
            $sections = Section::visibleTo($user)
                ->where('school_year_id', $term->school_year_id)
                ->when($sectionIds !== null, fn ($query) => $query->whereKey($sectionIds))
                ->get()
                ->keyBy('id');

            $sources = SectionSubject::with(['subject', 'teacher'])
                ->where('term_id', $from->id)
                ->whereIn('section_id', $sections->keys())
                ->get();

            $existing = SectionSubject::where('term_id', $term->id)
                ->whereIn('section_id', $sections->keys())
                ->get()
                ->map(fn (SectionSubject $row) => "{$row->section_id}|{$row->subject_id}")
                ->flip();
            $loads = $this->loadsIn($term);

            foreach ($sources as $source) {
                $section = $sections[$source->section_id];

                $outcome = match (true) {
                    $existing->has("{$source->section_id}|{$source->subject_id}") => 'already_set',
                    ! $this->isOfferedTo($source->subject, $term, $section) => 'not_offered',
                    $source->teacher->personnel_type !== 'teaching' || ! $source->teacher->is_active => 'teacher_unavailable',
                    ($loads[$source->teacher_id] ?? 0) >= $source->teacher->max_subjects => 'full_load',
                    default => 'copied',
                };

                $result[$outcome]++;

                if ($outcome === 'copied') {
                    $loads[$source->teacher_id] = ($loads[$source->teacher_id] ?? 0) + 1;
                    SectionSubject::create([
                        'term_id' => $term->id,
                        'section_id' => $source->section_id,
                        'subject_id' => $source->subject_id,
                        'teacher_id' => $source->teacher_id,
                    ]);
                }
            }

            $this->audit->log($user, 'copy', 'section_subjects', $term->id, null, [
                'from_term_id' => $from->id,
                'section_ids' => $sectionIds,
                ...$result,
            ]);

            return $result;
        });
    }

    /**
     * How many subjects each teacher already has in this term.
     *
     * @return array<int, int>
     */
    public function loadsIn(SchoolTerm $term): array
    {
        return DB::table('section_subjects')
            ->where('term_id', $term->id)
            ->selectRaw('teacher_id, COUNT(*) AS assigned')
            ->groupBy('teacher_id')
            ->pluck('assigned', 'teacher_id')
            ->map(fn ($count) => (int) $count)
            ->all();
    }

    /**
     * A teacher carries at most max_subjects (5) subjects a term: the next one is refused with
     * "Full load" (beneficiary review, Nov 21, 2026; it was only a flag before).
     */
    private function stopIfFullLoad(SchoolTerm $term, int $teacherId): void
    {
        $teacher = Teacher::find($teacherId);
        if (! $teacher) {
            return;
        }

        $assigned = $this->loadsIn($term)[$teacherId] ?? 0;

        if ($assigned >= $teacher->max_subjects) {
            throw ValidationException::withMessages([
                'teacher_id' => "Full load: {$teacher->printedName()} already has {$assigned} subjects this term, the most a teacher can carry. Choose another teacher.",
            ]);
        }
    }

    private function isOfferedTo(Subject $subject, SchoolTerm $term, Section $section): bool
    {
        return Subject::whereKey($subject->id)
            ->where(fn ($query) => $this->offeredTo($query, $term, $section))
            ->exists();
    }

    private function loadingOf(SchoolTerm $term, Section $section, Subject $subject): ?SectionSubject
    {
        return SectionSubject::where('term_id', $term->id)
            ->where('section_id', $section->id)
            ->where('subject_id', $subject->id)
            ->first();
    }

    private function ensureOffered(SchoolTerm $term, Section $section, Subject $subject): void
    {
        $isOffered = $subject->school_year_id === $section->school_year_id
            && ($subject->level === null || $subject->level === $section->gradeLevel->level)
            && ($subject->grade_level_id === null || $subject->grade_level_id === $section->grade_level_id)
            && Subject::whereKey($subject->id)
                ->where(fn ($query) => $this->offeredTo($query, $term, $section))
                ->exists();

        if (! $isOffered) {
            throw ValidationException::withMessages([
                'teacher_id' => 'This subject is not offered to this section at this time.',
            ]);
        }
    }

    /**
     * A schedule waiting for the Admin, or already approved, cannot change underneath them.
     */
    private function lockReason($entries): ?string
    {
        if ($entries->contains('status', 'approved')) {
            return 'This subject is on an approved schedule. The Admin must reopen it first.';
        }

        if ($entries->contains('status', 'pending')) {
            return 'This subject is on a schedule waiting for approval. It is locked until the Admin acts on it.';
        }

        return null;
    }
}
