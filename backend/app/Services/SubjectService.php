<?php

namespace App\Services;

use App\Models\SchoolYear;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Subjects belong to one school year, so changing the curriculum never alters past records.
 */
class SubjectService
{
    // These decide where a subject's teacher loading belongs, so they stay once it has some.
    private const FIXED_ONCE_LOADED = ['grade_level_id', 'track_id', 'term_no'];

    public function __construct(private AuditLogger $audit) {}

    /**
     * The subjects of a year that this user may see.
     *
     * @return array<int, array<string, mixed>>
     */
    public function listFor(SchoolYear $year, User $user): array
    {
        $loadingCounts = DB::table('section_subjects')
            ->selectRaw('subject_id, COUNT(*) AS total')
            ->groupBy('subject_id')
            ->pluck('total', 'subject_id');

        return DB::table('subjects')
            ->join('grade_levels', 'grade_levels.id', '=', 'subjects.grade_level_id')
            ->leftJoin('tracks', 'tracks.id', '=', 'subjects.track_id')
            ->where('subjects.school_year_id', $year->id)
            ->whereIn('subjects.grade_level_id', $user->gradeLevelIdsInScope())
            ->orderBy('grade_levels.grade')
            ->orderBy('subjects.name')
            ->select('subjects.*', 'grade_levels.grade', 'grade_levels.level', 'tracks.name as track')
            ->get()
            ->map(fn ($subject) => [
                'id' => $subject->id,
                'grade_level_id' => $subject->grade_level_id,
                'grade' => $subject->grade,
                'level' => $subject->level,
                'track_id' => $subject->track_id,
                'track' => $subject->track,
                'term_no' => $subject->term_no,
                'code' => $subject->code,
                'name' => $subject->name,
                'subject_type' => $subject->subject_type,
                'minutes_per_week' => $subject->minutes_per_week,
                'is_priority' => (bool) $subject->is_priority,
                'is_active' => (bool) $subject->is_active,
                'locked_reason' => isset($loadingCounts[$subject->id])
                    ? 'This subject already has teacher loading.'
                    : null,
            ])
            ->all();
    }

    /**
     * What the subject form chooses from: only the grade levels this user may manage.
     *
     * @return array<string, mixed>
     */
    public function options(SchoolYear $year, User $user): array
    {
        return [
            'grade_levels' => DB::table('grade_levels')
                ->whereIn('id', $user->gradeLevelIdsInScope())
                ->orderBy('grade')
                ->get(['id', 'grade', 'level']),
            'tracks' => DB::table('tracks')->orderBy('name')->get(['id', 'name']),
            'terms' => DB::table('school_terms')
                ->where('school_year_id', $year->id)
                ->orderBy('term_no')
                ->get(['term_no', 'name']),
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(SchoolYear $year, array $data, User $user): Subject
    {
        return DB::transaction(function () use ($year, $data, $user) {
            $subject = Subject::create([...$data, 'name' => trim($data['name']), 'school_year_id' => $year->id]);

            $this->audit->log($user, 'create', 'subjects', $subject->id, null, $data);

            return $subject;
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(Subject $subject, array $data, User $user): Subject
    {
        return DB::transaction(function () use ($subject, $data, $user) {
            if ($this->hasLoading($subject)) {
                foreach (self::FIXED_ONCE_LOADED as $field) {
                    if ((string) ($data[$field] ?? '') !== (string) ($subject->{$field} ?? '')) {
                        throw ValidationException::withMessages([
                            $field => 'This cannot change, because this subject already has teacher loading.',
                        ]);
                    }
                }
            }

            $before = $subject->only(array_keys($data));
            $subject->update([...$data, 'name' => trim($data['name'])]);

            $this->audit->log($user, 'update', 'subjects', $subject->id, $before, $data);

            return $subject;
        });
    }

    public function delete(Subject $subject, User $user): void
    {
        if ($this->hasLoading($subject)) {
            throw ValidationException::withMessages([
                'subject' => 'This subject already has teacher loading. Mark it as not offered instead.',
            ]);
        }

        DB::transaction(function () use ($subject, $user) {
            $before = $subject->only(['name', 'school_year_id', 'grade_level_id']);
            $subject->delete();

            $this->audit->log($user, 'delete', 'subjects', $subject->id, $before);
        });
    }

    private function hasLoading(Subject $subject): bool
    {
        return DB::table('section_subjects')->where('subject_id', $subject->id)->exists();
    }
}
