<?php

namespace App\Http\Requests;

use App\Models\Activity;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Activities belong to a school year and are shared by every grade level. */
class SaveActivityRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->hasAnyRole(['glc', 'master_teacher']);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        /** @var Activity|null $activity */
        $activity = $this->route('activity');
        $yearId = $activity?->school_year_id ?? $this->route('schoolYear')->id;

        return [
            'code' => ['nullable', 'string', 'max:20'],
            'name' => [
                'required', 'string', 'max:100',
                Rule::unique('activities', 'name')->where('school_year_id', $yearId)->ignore($activity?->id),
            ],
        ];
    }

    public function messages(): array
    {
        return ['name.unique' => 'This school year already has an activity with this name.'];
    }
}
