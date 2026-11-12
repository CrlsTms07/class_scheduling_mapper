<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

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
            'first_name' => ['required', 'string', 'max:60'],
            'middle_name' => ['nullable', 'string', 'max:60'],
            'last_name' => ['required', 'string', 'max:60'],
            'suffix' => ['nullable', 'string', 'max:10'],
            'display_name' => ['nullable', 'string', 'max:80'],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'designation_id' => ['nullable', 'integer', 'exists:designations,id'],
            'shift' => ['required', Rule::in(['AM', 'PM', 'WHOLE_DAY'])],
            'max_hours_per_week' => ['sometimes', 'integer', 'between:1,60'],
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
        ];
    }
}
