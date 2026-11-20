<?php

namespace App\Http\Requests;

use App\Models\Teacher;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class SaveTeacherRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('manage-school-records');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'personnel_type' => ['required', Rule::in(['teaching', 'non_teaching'])],
            'employee_id' => ['nullable', 'string', 'max:20', 'regex:/^[0-9A-Za-z-]+$/'],
            'first_name' => ['required', 'string', 'max:60'],
            'middle_name' => ['nullable', 'string', 'max:60'],
            'last_name' => ['required', 'string', 'max:60'],
            'suffix' => ['nullable', 'string', 'max:10'],
            // Every teacher belongs to one department (beneficiary review, Nov 21, 2026).
            'department_id' => ['required', 'integer', 'exists:departments,id'],
            'designation_id' => ['nullable', 'integer', 'exists:designations,id'],
            'shift' => ['required', Rule::in(['AM', 'PM', 'WHOLE_DAY'])],
            'is_active' => ['required', 'boolean'],
            'qualifications' => ['present', 'array', 'max:10'],
            'qualifications.*.degree_level' => ['required', 'string', 'max:30'],
            'qualifications.*.degree' => ['required', 'string', 'max:120'],
            'qualifications.*.major' => ['nullable', 'string', 'max:120'],
            'qualifications.*.school' => ['nullable', 'string', 'max:150'],
            'qualifications.*.year_completed' => ['nullable', 'integer', 'between:1950,2100'],
            'task_ids' => ['present', 'array'],
            'task_ids.*' => ['integer', 'distinct', 'exists:teaching_tasks,id'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'qualifications.*.degree_level' => 'level',
            'qualifications.*.degree' => 'degree',
            'qualifications.*.year_completed' => 'year completed',
            'employee_id' => 'employee ID',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'employee_id.regex' => 'The employee ID can have only letters, numbers and dashes.',
            'department_id.required' => 'Choose the department. Every teacher belongs to one.',
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('employee_id')) {
            $id = trim((string) $this->input('employee_id'));
            $this->merge(['employee_id' => $id === '' ? null : $id]);
        }
    }

    /**
     * One employee ID per person, in any letter case.
     */
    public function after(): array
    {
        return [function (Validator $validator) {
            $id = $this->input('employee_id');
            if ($id === null || $validator->errors()->has('employee_id')) {
                return;
            }

            $editing = $this->route('teacher');
            $owner = Teacher::whereRaw('LOWER(employee_id) = LOWER(?)', [$id])
                ->when($editing, fn ($query) => $query->whereKeyNot($editing->id))
                ->first();

            if ($owner) {
                $validator->errors()->add('employee_id', "This employee ID already belongs to {$owner->printedName()}.");
            }
        }];
    }
}
