<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SaveBuildingRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:80', Rule::unique('buildings', 'name')->ignore($this->route('building'))],
            // Junior High, Senior High, or empty for shared (the Admin's choice).
            'department' => ['nullable', Rule::in(['JHS', 'SHS'])],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        // A building of the other department is not listed for this user, so say where it is.
        return ['name.unique' => 'There is already a building with this name. If both departments use it, ask the Admin to make it shared.'];
    }
}
