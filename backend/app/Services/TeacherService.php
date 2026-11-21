<?php

namespace App\Services;

use App\Models\SchoolTerm;
use App\Models\Section;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Personnel records. A record may exist without a login account, and is reused across
 * school years. Teaching tasks and the current load are per term.
 */
class TeacherService
{
    // Which table each kind of option in the teacher form is kept in.
    public const OPTION_TABLES = [
        'departments' => 'departments',
        'designations' => 'designations',
        'teaching-tasks' => 'teaching_tasks',
    ];

    public function __construct(private AuditLogger $audit) {}

    /**
     * Everyone's records, with their load and tasks in this term.
     *
     * @return array<int, array<string, mixed>>
     */
    public function listFor(SchoolTerm $term, ?User $viewer = null): array
    {
        $viewer ??= auth()->user();
        $readOnly = $viewer ? $this->otherDepartmentOnly($term, $viewer)->flip() : collect();

        $loads = DB::table('section_subjects')
            ->where('term_id', $term->id)
            ->selectRaw('teacher_id, COUNT(*) AS assigned')
            ->groupBy('teacher_id')
            ->pluck('assigned', 'teacher_id');

        $tasks = DB::table('teacher_tasks')->where('term_id', $term->id)->get()->groupBy('teacher_id');
        $qualifications = DB::table('teacher_qualifications')->orderBy('id')->get()->groupBy('teacher_id');
        $departments = DB::table('departments')->pluck('name', 'id');
        $designations = DB::table('designations')->pluck('name', 'id');
        $accounts = User::whereIn('id', Teacher::whereNotNull('user_id')->pluck('user_id'))->pluck('email', 'id');
        $advisories = Section::with('gradeLevel')
            ->where('school_year_id', $term->school_year_id)
            ->whereNotNull('adviser_id')
            ->get()
            ->keyBy('adviser_id');

        // Junior High, Senior High or both: from this term's classes and this year's advisories.
        $levels = DB::table('section_subjects')
            ->join('sections', 'sections.id', '=', 'section_subjects.section_id')
            ->join('grade_levels', 'grade_levels.id', '=', 'sections.grade_level_id')
            ->where('section_subjects.term_id', $term->id)
            ->select('section_subjects.teacher_id', 'grade_levels.level')
            ->get()
            ->concat(DB::table('sections')
                ->join('grade_levels', 'grade_levels.id', '=', 'sections.grade_level_id')
                ->where('sections.school_year_id', $term->school_year_id)
                ->get(['sections.adviser_id', 'sections.co_adviser_id', 'grade_levels.level'])
                ->flatMap(fn ($row) => [
                    (object) ['teacher_id' => $row->adviser_id, 'level' => $row->level],
                    (object) ['teacher_id' => $row->co_adviser_id, 'level' => $row->level],
                ]))
            ->filter(fn ($row) => $row->teacher_id !== null)
            ->groupBy('teacher_id')
            ->map(fn ($rows) => $rows->pluck('level')->unique()->sort()->values()->all());

        $own = $viewer?->departmentsInScope();
        $departmentLevels = DB::table('departments')->pluck('level', 'id');

        // Teaching personnel only (team decision, Nov 21, 2026). A Chairperson or Master Teacher sees
        // the teachers of their own level: by department, or by classes or an advisory there, or
        // with no department level yet (Nov 21, 2026).
        return Teacher::where('personnel_type', 'teaching')
            ->get()
            ->filter(fn (Teacher $teacher) => $own === null
                || ($departmentLevels[$teacher->department_id] ?? null) === null
                || in_array($departmentLevels[$teacher->department_id], $own, true)
                || array_intersect($levels->get($teacher->id, []), $own) !== [])
            ->sortBy(fn (Teacher $teacher) => [$teacher->last_name, $teacher->first_name])
            ->values()
            ->map(fn (Teacher $teacher) => [
                'id' => $teacher->id,
                'personnel_type' => $teacher->personnel_type,
                'levels' => $levels->get($teacher->id, []),
                'first_name' => $teacher->first_name,
                'middle_name' => $teacher->middle_name,
                'last_name' => $teacher->last_name,
                'suffix' => $teacher->suffix,
                'printed_name' => $teacher->printedName(),
                'department_id' => $teacher->department_id,
                'department' => $departments[$teacher->department_id] ?? null,
                'department_level' => $departmentLevels[$teacher->department_id] ?? null,
                'designation_id' => $teacher->designation_id,
                'designation' => $designations[$teacher->designation_id] ?? null,
                'shift' => $teacher->shift,
                'max_subjects' => $teacher->max_subjects,
                'is_active' => $teacher->is_active,
                'account_email' => $accounts[$teacher->user_id] ?? null,
                'advisory' => $advisories->get($teacher->id)?->labelFor($viewer),
                // Only the Admin edits a teacher who teaches only in the other department.
                'can_edit' => ! $readOnly->has($teacher->id),
                'assigned' => (int) ($loads[$teacher->id] ?? 0),
                'task_ids' => ($tasks[$teacher->id] ?? collect())->pluck('task_id')->map(fn ($id) => (int) $id)->values(),
                'qualifications' => ($qualifications[$teacher->id] ?? collect())->map(fn ($row) => [
                    'degree_level' => $row->degree_level,
                    'degree' => $row->degree,
                    'major' => $row->major,
                    'school' => $row->school,
                    'year_completed' => $row->year_completed,
                ])->values(),
                'cannot_delete_reason' => $this->whyCannotDelete($teacher),
            ])
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    public function options(?User $viewer = null): array
    {
        $own = $viewer?->departmentsInScope();

        return [
            // A Chairperson or Master Teacher sees the departments of their own level (and any not
            // given a level yet); the Admin sees all, with their level (Nov 21, 2026).
            'departments' => DB::table('departments')
                ->when($own !== null, fn ($query) => $query->where(fn ($inner) => $inner->whereIn('level', $own)->orWhereNull('level')))
                ->orderBy('name')
                ->get(['id', 'name', 'level']),
            'designations' => DB::table('designations')->orderBy('name')->get(['id', 'name']),
            'tasks' => DB::table('teaching_tasks')->orderBy('name')->get(['id', 'name']),
        ];
    }

    /**
     * @return array{id: int, name: string}
     */
    public function addOption(string $type, string $name, User $user, ?string $level = null): array
    {
        $table = self::OPTION_TABLES[$type];
        $name = trim($name);
        $values = ['name' => $name, ...($type === 'departments' ? ['level' => $level] : [])];
        $id = DB::table($table)->insertGetId($values);

        $this->audit->log($user, 'create', $table, $id, null, $values);

        return ['id' => $id, ...$values];
    }

    /**
     * A Chairperson or Master Teacher changes only the departments of their own level.
     */
    public function ensureOwnDepartment(string $type, int $id, User $user): void
    {
        $own = $user->departmentsInScope();
        if ($type !== 'departments' || $own === null) {
            return;
        }

        $level = DB::table('departments')->where('id', $id)->value('level');
        abort_if($level !== null && ! in_array($level, $own, true), 403, 'This department belongs to the other department level. The Admin keeps it.');
    }

    /**
     * A minimal record with a name only, to be completed later. Teacher names are never
     * stored as free text on schedules, so even a quick one is a real record.
     */
    public function quickAdd(string $firstName, string $lastName, User $user): Teacher
    {
        return DB::transaction(function () use ($firstName, $lastName, $user) {
            $teacher = Teacher::create(['first_name' => trim($firstName), 'last_name' => trim($lastName)]);

            $this->audit->log($user, 'create', 'teachers', $teacher->id, null, $teacher->only(['first_name', 'last_name']));

            return $teacher;
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(SchoolTerm $term, array $data, User $user): Teacher
    {
        return DB::transaction(function () use ($term, $data, $user) {
            $teacher = Teacher::create($this->recordValues($data));
            $this->saveDetails($teacher, $term, $data);

            $this->audit->log($user, 'create', 'teachers', $teacher->id, null, $this->recordValues($data));

            return $teacher;
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(Teacher $teacher, SchoolTerm $term, array $data, User $user): Teacher
    {
        return DB::transaction(function () use ($teacher, $term, $data, $user) {
            if ($data['personnel_type'] !== 'teaching') {
                $this->stopIfTeachingWork($teacher);
            }

            $values = $this->recordValues($data);
            $before = $teacher->only(array_keys($values));

            $teacher->update($values);
            $this->saveDetails($teacher, $term, $data);

            $this->audit->log($user, 'update', 'teachers', $teacher->id, $before, $values);

            return $teacher;
        });
    }

    public function delete(Teacher $teacher, User $user): void
    {
        $reason = $this->whyCannotDelete($teacher);
        if ($reason !== null) {
            throw ValidationException::withMessages(['teacher' => $reason]);
        }

        DB::transaction(function () use ($teacher, $user) {
            $before = $teacher->only(['first_name', 'last_name']);
            $teacher->delete();

            $this->audit->log($user, 'delete', 'teachers', $teacher->id, $before);
        });
    }

    /**
     * A used record stays, so old schedules keep their teacher.
     */
    public function whyCannotDelete(Teacher $teacher): ?string
    {
        if ($teacher->user_id !== null) {
            return 'It is linked to a user account. The Admin can unlink it in Users.';
        }

        if (DB::table('sections')->where('adviser_id', $teacher->id)->orWhere('co_adviser_id', $teacher->id)->exists()) {
            return 'This person is the adviser or co-adviser of a section. Mark them as inactive instead.';
        }

        $hasWork = DB::table('section_subjects')->where('teacher_id', $teacher->id)->exists()
            || DB::table('schedule_entries')->where('teacher_id', $teacher->id)->exists();

        return $hasWork ? 'This person has teacher loading or schedules. Mark them as inactive instead.' : null;
    }

    /**
     * A misspelled department, designation or task can go, but not one that is in use.
     */
    /**
     * Renames a department, designation or task (fixes a typo everywhere it is used).
     *
     * @return array{id: int, name: string}
     */
    public function renameOption(string $type, int $id, string $name, User $user): array
    {
        $table = self::OPTION_TABLES[$type];
        $row = DB::table($table)->where('id', $id)->first();
        abort_unless($row, 404);

        $name = trim($name);
        DB::table($table)->where('id', $id)->update(['name' => $name]);
        $this->audit->log($user, 'update', $table, $id, ['name' => $row->name], ['name' => $name]);

        return ['id' => $id, 'name' => $name];
    }

    public function deleteOption(string $type, int $id, User $user): void
    {
        $table = self::OPTION_TABLES[$type];
        $row = DB::table($table)->where('id', $id)->first();

        abort_unless($row, 404);

        $uses = match ($type) {
            'departments' => DB::table('teachers')->where('department_id', $id)->count(),
            'designations' => DB::table('teachers')->where('designation_id', $id)->count(),
            'teaching-tasks' => DB::table('teacher_tasks')->where('task_id', $id)->count(),
        };

        if ($uses > 0) {
            throw ValidationException::withMessages([
                'option' => "{$row->name} is still in use by personnel records ({$uses}), so it stays.",
            ]);
        }

        DB::table($table)->where('id', $id)->delete();
        $this->audit->log($user, 'delete', $table, $id, ['name' => $row->name]);
    }

    /**
     * Only teaching personnel can have subjects or be advisers.
     */
    /**
     * An advisory or teacher loading: then the person must stay teaching personnel.
     */
    public function hasTeachingWork(Teacher $teacher): bool
    {
        return DB::table('sections')->where('adviser_id', $teacher->id)->orWhere('co_adviser_id', $teacher->id)->exists()
            || DB::table('section_subjects')->where('teacher_id', $teacher->id)->exists();
    }

    private function stopIfTeachingWork(Teacher $teacher): void
    {
        if ($this->hasTeachingWork($teacher)) {
            throw ValidationException::withMessages([
                'personnel_type' => 'This person has an advisory or teacher loading, so they must stay as teaching personnel.',
            ]);
        }
    }

    /**
     * Qualifications are replaced as a whole. Tasks are replaced for this term only.
     *
     * @param  array<string, mixed>  $data
     */
    private function saveDetails(Teacher $teacher, SchoolTerm $term, array $data): void
    {
        // A department made before levels takes the level the Admin chose for it (Nov 21, 2026).
        if (! empty($data['department_level'])) {
            DB::table('departments')->where('id', $data['department_id'])->whereNull('level')->update(['level' => $data['department_level']]);
        }

        DB::table('teacher_tasks')->where('teacher_id', $teacher->id)->where('term_id', $term->id)->delete();

        foreach ($data['task_ids'] as $taskId) {
            DB::table('teacher_tasks')->insert([
                'teacher_id' => $teacher->id,
                'task_id' => $taskId,
                'term_id' => $term->id,
            ]);
        }
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function recordValues(array $data): array
    {
        // The load limit is one for the whole school, not chosen per teacher.
        return [...collect($data)->except(['qualifications', 'task_ids', 'max_subjects', 'department_level'])->all(), 'max_subjects' => (int) config('school.max_subjects')];
    }

    /**
     * Teachers whose loading and advisory this school year are all in the other department.
     * For a Chairperson or Master Teacher they are view-only; the Admin edits everyone.
     *
     * @return \Illuminate\Support\Collection<int, int>
     */
    public function otherDepartmentOnly(SchoolTerm $term, User $viewer): \Illuminate\Support\Collection
    {
        $departments = $viewer->departmentsInScope();

        if ($departments === null) {
            return collect();
        }

        $sections = DB::table('sections')
            ->join('grade_levels', 'grade_levels.id', '=', 'sections.grade_level_id')
            ->where('sections.school_year_id', $term->school_year_id)
            ->get(['sections.id', 'grade_levels.level', 'sections.adviser_id', 'sections.co_adviser_id']);
        $isOwn = $sections->mapWithKeys(fn ($section) => [$section->id => in_array($section->level, $departments, true)]);

        $links = DB::table('section_subjects')
            ->whereIn('term_id', DB::table('school_terms')->where('school_year_id', $term->school_year_id)->select('id'))
            ->get(['teacher_id', 'section_id'])
            ->map(fn ($row) => [$row->teacher_id, $isOwn[$row->section_id] ?? false])
            ->concat($sections->flatMap(fn ($section) => [[$section->adviser_id, $isOwn[$section->id]], [$section->co_adviser_id, $isOwn[$section->id]]]))
            ->filter(fn ($link) => $link[0] !== null)
            ->groupBy(0);

        return $links
            ->filter(fn ($rows) => $rows->every(fn ($link) => ! $link[1]))
            ->keys();
    }
}
