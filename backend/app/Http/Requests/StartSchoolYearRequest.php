<?php

namespace App\Http\Requests;

class StartSchoolYearRequest extends SaveSchoolYearRequest
{
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
