<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AutoFillRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('plot', $this->route('section'));
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'scope' => ['required', Rule::in(['section', 'grade', 'all'])],
            // Given when confirming: the plan the user saw in the preview.
            'plan_hash' => ['sometimes', 'string', 'size:40'],
        ];
    }
}
