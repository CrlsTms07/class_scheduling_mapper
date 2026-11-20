<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class MasterDataImportRequest extends FormRequest
{
    /** Only the Admin imports master data (team decision, Nov 21, 2026). */
    public function authorize(): bool
    {
        return $this->user()->can('import-master-data');
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'mode' => $this->query('mode', $this->input('mode', 'preview')),
            'on_duplicate' => $this->input('on_duplicate', 'skip'),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'file' => ['required', 'file', 'max:2048', 'extensions:xlsx,pdf'],
            'mode' => ['required', Rule::in(['preview', 'commit'])],
            'on_duplicate' => ['required', Rule::in(['skip', 'update'])],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'file.required' => 'Choose the Excel file to import.',
            'file.extensions' => 'Choose an Excel workbook (.xlsx) made from the template, or a PDF.',
            'file.max' => 'The file is larger than 2 MB. Split it into smaller files.',
        ];
    }
}
