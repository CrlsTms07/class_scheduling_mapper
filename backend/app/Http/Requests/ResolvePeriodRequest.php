<?php

namespace App\Http\Requests;

use App\Models\DayPattern;
use Illuminate\Foundation\Http\FormRequest;

/**
 * A typed time for a section: the period it matches, or a new period or break of the bell
 * schedule. Who plots the section and may change its department's bell schedules can do this.
 */
class ResolvePeriodRequest extends FormRequest
{
    public function authorize(): bool
    {
        $section = $this->route('section');

        return $this->user()->can('plot', $section)
            && $this->user()->can('manage', [DayPattern::class, $section->gradeLevel->level]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'days' => ['required', 'array', 'min:1', 'max:5'],
            'days.*' => ['integer', 'distinct', 'between:1,5'],
            'start_time' => ['required', 'date_format:H:i'],
            'end_time' => ['required', 'date_format:H:i', 'after:start_time'],
            'is_break' => ['sometimes', 'boolean'],
            'label' => ['nullable', 'string', 'max:40'],
        ];
    }

    public function messages(): array
    {
        return ['end_time.after' => 'The end time must be after the start time.'];
    }
}
