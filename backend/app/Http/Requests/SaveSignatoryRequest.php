<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class SaveSignatoryRequest extends FormRequest
{
    // A name filled in by the system only makes sense on the document that has that person.
    private const AUTO_SOURCE_DOCUMENT = [
        'section_adviser' => 'class_program',
        'teacher' => 'teacher_program',
    ];

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
            'report_type' => ['nullable', Rule::in(['class_program', 'teacher_program', 'room_schedule'])],
            'level' => ['nullable', Rule::in(['JHS', 'SHS'])],
            'label' => ['required', 'string', 'max:40'],
            'name' => ['nullable', 'string', 'max:120', 'required_without:auto_source'],
            'position' => ['nullable', 'string', 'max:120'],
            'auto_source' => ['nullable', Rule::in(array_keys(self::AUTO_SOURCE_DOCUMENT))],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['name.required_without' => 'Enter the name to print.'];
    }

    public function after(): array
    {
        return [function (Validator $validator) {
            $source = $this->input('auto_source');

            if ($source && $this->input('report_type') !== self::AUTO_SOURCE_DOCUMENT[$source]) {
                $validator->errors()->add('auto_source', 'This automatic name does not fit the chosen document.');
            }
        }];
    }
}
