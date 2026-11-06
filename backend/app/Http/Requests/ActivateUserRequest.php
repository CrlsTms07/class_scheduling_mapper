<?php

namespace App\Http\Requests;

use App\Models\GradeLevel;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class ActivateUserRequest extends FormRequest
{
    // A scheduler may only be given grade levels of their own department.
    private const SCHEDULER_LEVELS = ['glc' => 'JHS', 'master_teacher' => 'SHS'];

    public function authorize(): bool
    {
        return $this->user()->can('activate', $this->route('user'));
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'role' => ['required', Rule::in(User::ROLES)],
            'grade_level_ids' => ['present', 'array'],
            'grade_level_ids.*' => ['integer', 'distinct', 'exists:grade_levels,id'],
            'teacher_id' => ['nullable', 'integer', 'exists:teachers,id'],
        ];
    }

    public function after(): array
    {
        return [
            fn (Validator $validator) => $this->validateScope($validator),
            fn (Validator $validator) => $this->validateTeacherLink($validator),
        ];
    }

    private function validateScope(Validator $validator): void
    {
        if ($validator->errors()->isNotEmpty()) {
            return;
        }

        $gradeLevelIds = $this->input('grade_level_ids');
        $requiredLevel = self::SCHEDULER_LEVELS[$this->input('role')] ?? null;

        if ($requiredLevel === null) {
            if ($gradeLevelIds !== []) {
                $validator->errors()->add('grade_level_ids', 'Only a GLC or Master Teacher can have grade levels.');
            }

            return;
        }

        if ($gradeLevelIds === []) {
            $validator->errors()->add('grade_level_ids', 'Select at least one grade level.');

            return;
        }

        $outsideDepartment = GradeLevel::whereIn('id', $gradeLevelIds)
            ->where('level', '<>', $requiredLevel)
            ->exists();

        if ($outsideDepartment) {
            $validator->errors()->add('grade_level_ids', "This role can only be given {$requiredLevel} grade levels.");
        }
    }

    private function validateTeacherLink(Validator $validator): void
    {
        $teacherId = $this->input('teacher_id');

        if ($teacherId === null || $validator->errors()->has('teacher_id')) {
            return;
        }

        $linkedUserId = DB::table('teachers')->where('id', $teacherId)->value('user_id');

        if ($linkedUserId !== null && (int) $linkedUserId !== $this->route('user')->id) {
            $validator->errors()->add('teacher_id', 'This personnel record already belongs to another account.');
        }
    }
}
