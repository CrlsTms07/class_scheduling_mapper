<?php

namespace App\Http\Requests;

class StartSchoolYearRequest extends SaveSchoolYearRequest
{
    /**
     * With no choice sent, the latest year's subjects, class hours and signatories are copied
     * (beneficiary review, Nov 21, 2026: no "what to copy" step). Section names are not.
     */
    protected function prepareForValidation(): void
    {
        if (! $this->has('copy')) {
            $this->merge(['copy' => ['subjects' => true, 'time_slots' => true, 'signatories' => true, 'section_names' => false]]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'copy_from_id' => ['nullable', 'integer', 'exists:school_years,id'],
            'copy' => ['array'],
            'copy.subjects' => ['boolean'],
            'copy.time_slots' => ['boolean'],
            'copy.signatories' => ['boolean'],
            'copy.section_names' => ['boolean'],
        ];
    }
}
