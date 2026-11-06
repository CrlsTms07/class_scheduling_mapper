<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SubmitScheduleRequest extends FormRequest
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
            'acknowledged_flags' => ['present', 'array'],
            'acknowledged_flags.*' => ['string', 'max:80'],
            'note' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
