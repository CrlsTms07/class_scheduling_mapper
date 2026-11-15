<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SaveDocumentSettingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('manage-reports');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'report_type' => ['required', Rule::in(['class_program', 'teacher_program', 'room_schedule'])],
            'level' => ['nullable', Rule::in(['JHS', 'SHS'])],
            'title_format' => ['required', 'string', 'max:150'],
            'doc_ref_code' => ['nullable', 'string', 'max:40'],
            'revision_no' => ['nullable', 'string', 'max:10'],
            'effectivity_date' => ['nullable', 'date_format:Y-m-d'],
            'reference_note' => ['nullable', 'string', 'max:150'],
        ];
    }
}
