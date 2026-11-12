<?php

namespace App\Http\Requests;

use App\Models\SchoolYear;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * The rules shared by the Start New School Year wizard and Calendar settings.
 * Terms are sent in order: the first one is term 1, the second is term 2, and so on.
 */
class SaveSchoolYearRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('manage', SchoolYear::class);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => [
                'required',
                'regex:/^\d{4}-\d{4}$/',
                Rule::unique('school_years', 'name')->ignore($this->route('schoolYear')),
            ],
            'start_date' => ['required', 'date_format:Y-m-d'],
            'end_date' => ['required', 'date_format:Y-m-d', 'after:start_date'],
            'term_label' => ['required', 'string', 'max:20'],
            'terms' => ['required', 'array', 'min:1', 'max:4'],
            'terms.*.name' => ['required', 'string', 'max:30', 'distinct:ignore_case'],
            'terms.*.start_date' => ['required', 'date_format:Y-m-d'],
            'terms.*.end_date' => ['required', 'date_format:Y-m-d'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.regex' => 'Write the school year like 2027-2028.',
            'name.unique' => 'This school year already exists.',
            'end_date.after' => 'The school year must end after it starts.',
            'terms.*.name.distinct' => 'Each one needs its own name.',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'terms.*.name' => 'name',
            'terms.*.start_date' => 'start date',
            'terms.*.end_date' => 'end date',
        ];
    }

    public function after(): array
    {
        return [
            fn (Validator $validator) => $this->validateYearName($validator),
            fn (Validator $validator) => $this->validateNoOverlapWithOtherYears($validator),
            fn (Validator $validator) => $this->validateTermDates($validator),
        ];
    }

    private function validateYearName(Validator $validator): void
    {
        if ($validator->errors()->has('name')) {
            return;
        }

        [$first, $second] = explode('-', $this->input('name'));

        if ((int) $second !== (int) $first + 1) {
            $validator->errors()->add('name', 'Write the school year like 2027-2028, one year apart.');
        }
    }

    private function validateNoOverlapWithOtherYears(Validator $validator): void
    {
        if ($validator->errors()->hasAny(['start_date', 'end_date'])) {
            return;
        }

        $overlapping = SchoolYear::where('start_date', '<=', $this->input('end_date'))
            ->where('end_date', '>=', $this->input('start_date'))
            ->when($this->route('schoolYear'), fn ($query, $year) => $query->whereKeyNot($year->id))
            ->value('name');

        if ($overlapping) {
            $validator->errors()->add('start_date', "These dates overlap school year {$overlapping}.");
        }
    }

    private function validateTermDates(Validator $validator): void
    {
        if ($validator->errors()->isNotEmpty()) {
            return;
        }

        // Dates are written as YYYY-MM-DD, so comparing them as text also compares them by date.
        $previousEnd = null;

        foreach ($this->input('terms') as $index => $term) {
            $problem = match (true) {
                $term['end_date'] <= $term['start_date'] => 'must end after it starts',
                $term['start_date'] < $this->input('start_date') => 'starts before the school year',
                $term['end_date'] > $this->input('end_date') => 'ends after the school year',
                $previousEnd !== null && $term['start_date'] <= $previousEnd => 'must start after the previous one ends',
                default => null,
            };

            if ($problem) {
                $validator->errors()->add("terms.{$index}.start_date", "{$term['name']} {$problem}.");

                return;
            }

            $previousEnd = $term['end_date'];
        }
    }
}
