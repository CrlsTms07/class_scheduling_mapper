<?php

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;

class ImportScheduleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->hasAnyRole([User::ROLE_ADMIN, 'glc', 'master_teacher']);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'file' => ['required', 'file', 'mimes:xlsx,xls,pdf,csv,txt', 'max:5120'],
            'preview' => ['sometimes', 'boolean'],
            'set_up' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return ['file.mimes' => 'Upload an Excel workbook (.xlsx or .xls).', 'file.max' => 'The file must be 5 MB or smaller.'];
    }
}
