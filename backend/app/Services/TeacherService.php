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

        return Teacher::orderBy('last_name')
            ->orderBy('first_name')
            ->get()
            ->map(fn (Teacher $teacher) => [
                'id' => $teacher->id,
                'personnel_type' => $teacher->personnel_type,
                'first_name' => $teacher->first_name,
                'middle_name' => $teacher->middle_name,
                'last_name' => $teacher->last_name,
                'suffix' => $teacher->suffix,
                'display_name' => $teacher->display_name,
                'printed_name' => $teacher->printedName(),
                'department_id' => $teacher->department_id,
                'department' => $departments[$teacher->department_id] ?? null,
                'designation_id' => $teacher->designation_id,
                'designation' => $designations[$teacher->designation_id] ?? null,
                'shift' => $teacher->shift,
                'max_subjects' => $teacher->max_subjects,
                'max_hours_per_week' => $teacher->max_hours_per_week,
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
    public function options(): array
    {
        return [
            'departments' => DB::table('departments')->orderBy('name')->get(['id', 'name']),
            'designations' => DB::table('designations')->orderBy('name')->get(['id', 'name']),
            'tasks' => DB::table('teaching_tasks')->orderBy('name')->get(['id', 'name']),
        ];
    }

    /**
     * @return array{id: int, name: string}
     */
    public function addOption(string $type, string $name, User $user): array
    {
        $table = self::OPTION_TABLES[$type];
        $name = trim($name);
        $id = DB::table($table)->insertGetId(['name' => $name]);

        $this->audit->log($user, 'create', $table, $id, null, ['name' => $name]);

        return ['id' => $id, 'name' => $name];
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
    private function stopIfTeachingWork(Teacher $teacher): void
    {
        $hasWork = DB::table('sections')->where('adviser_id', $teacher->id)->orWhere('co_adviser_id', $teacher->id)->exists()
            || DB::table('section_subjects')->where('teacher_id', $teacher->id)->exists();

        if ($hasWork) {
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
        DB::table('teacher_qualifications')->where('teacher_id', $teacher->id)->delete();

        foreach ($data['qualifications'] as $qualification) {
            DB::table('teacher_qualifications')->insert([
                'teacher_id' => $teacher->id,
                'degree_level' => $qualification['degree_level'],
                'degree' => $qualification['degree'],
                'major' => $qualification['major'] ?? null,
                'school' => $qualification['school'] ?? null,
                'year_completed' => $qualification['year_completed'] ?? null,
            ]);
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
        return [...collect($data)->except(['qualifications', 'task_ids', 'max_subjects'])->all(), 'max_subjects' => (int) config('school.max_subjects')];
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
