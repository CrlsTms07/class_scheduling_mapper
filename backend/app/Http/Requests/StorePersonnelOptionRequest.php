<?php

namespace App\Http\Requests;

use App\Services\TeacherService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * A new department, designation or teaching task, added from the teacher form.
 */
class StorePersonnelOptionRequest extends FormRequest
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
        $table = TeacherService::OPTION_TABLES[$this->route('type')];

        return ['name' => ['required', 'string', 'max:60', Rule::unique($table, 'name')]];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['name.unique' => 'This already exists in the list.'];
    }
}
