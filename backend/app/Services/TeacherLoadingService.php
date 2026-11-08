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
                    'minutes_per_week' => $subject->minutes_per_week,
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
     * Offered subjects of this grade for this term and track, plus any already loaded,
     * so old loading stays visible even if the subject has since been withdrawn.
     *
     * @param  array<int, int>  $loadedSubjectIds
     */
    private function subjectsOf(SchoolTerm $term, Section $section, array $loadedSubjectIds)
    {
        return Subject::query()
            ->where('school_year_id', $section->school_year_id)
            ->where('grade_level_id', $section->grade_level_id)
            ->where(fn ($query) => $query
                ->whereIn('id', $loadedSubjectIds)
                ->orWhere(fn ($offered) => $this->offeredTo($offered, $term, $section)))
            ->orderByDesc('is_priority')
            ->orderBy('name')
            ->get();
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

        return Teacher::where('personnel_type', 'teaching')
            ->where('is_active', true)
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get()
            ->map(fn (Teacher $teacher) => [
                'id' => $teacher->id,
                'name' => $teacher->printedName(),
                'shift' => $teacher->shift,
                'assigned' => (int) ($loads[$teacher->id] ?? 0),
                'limit' => $teacher->max_subjects,
            ])
            ->all();
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
     * @return array{copied: int, already_set: int, not_offered: int, teacher_unavailable: int}
     */
    public function copyFromTerm(SchoolTerm $term, SchoolTerm $from, ?array $sectionIds, User $user): array
    {
        $result = ['copied' => 0, 'already_set' => 0, 'not_offered' => 0, 'teacher_unavailable' => 0];

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

            foreach ($sources as $source) {
                $section = $sections[$source->section_id];

                $outcome = match (true) {
                    $existing->has("{$source->section_id}|{$source->subject_id}") => 'already_set',
                    ! $this->isOfferedTo($source->subject, $term, $section) => 'not_offered',
                    $source->teacher->personnel_type !== 'teaching' || ! $source->teacher->is_active => 'teacher_unavailable',
                    default => 'copied',
                };

                $result[$outcome]++;

                if ($outcome === 'copied') {
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
            && $subject->grade_level_id === $section->grade_level_id
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
