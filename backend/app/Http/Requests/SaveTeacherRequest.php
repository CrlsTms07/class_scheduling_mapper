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
            'personnel_type' => ['required', Rule::in(['teaching'])],
            'first_name' => ['required', 'string', 'max:60'],
            'middle_name' => ['nullable', 'string', 'max:60'],
            'last_name' => ['required', 'string', 'max:60'],
            'suffix' => ['nullable', 'string', 'max:10'],
            // Every teacher belongs to one department (beneficiary review, Nov 21, 2026).
            'department_id' => ['required', 'integer', 'exists:departments,id'],
            // The Admin's "Department of": gives a department with no level yet its level.
            'department_level' => ['nullable', Rule::in(['JHS', 'SHS'])],
            'designation_id' => ['required', 'integer', 'exists:designations,id'],
            'shift' => ['required', Rule::in(['AM', 'PM', 'WHOLE_DAY', 'PART_TIME'])],
            'is_active' => ['required', 'boolean'],
            'task_ids' => ['present', 'array'],
            'task_ids.*' => ['integer', 'distinct', 'exists:teaching_tasks,id'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'department_id.required' => 'Choose the department. Every teacher belongs to one.',
            'designation_id.required' => 'Choose the designation, like Teacher I or Master Teacher I.',
        ];
    }

    /**
     * Only teaching personnel are in the system (team decision, Nov 21, 2026: class scheduling is
     * its only focus; non-teaching personnel are out of scope).
     */
    protected function prepareForValidation(): void
    {
        $this->merge(['personnel_type' => 'teaching']);
    }

    public function after(): array
    {
        return [function (\Illuminate\Validation\Validator $validator) {
            $own = $this->user()->departmentsInScope();
            if ($own === null || $validator->errors()->has('department_id')) {
                return;
            }
            $level = \Illuminate\Support\Facades\DB::table('departments')->where('id', $this->integer('department_id'))->value('level');
            if ($level !== null && ! in_array($level, $own, true)) {
                $validator->errors()->add('department_id', 'Choose a department of your own level.');
            }
        }];
    }
}
