<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UploadLogoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('manage-reports');
    }

    /**
     * PNG and JPG only. SVG can carry scripts, and the PDF library cannot rely on it.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return ['logo' => ['required', 'file', 'mimes:png,jpg,jpeg', 'max:2048']];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'logo.mimes' => 'Use a PNG or JPG image.',
            'logo.max' => 'The image must be 2 MB or smaller.',
        ];
    }
}
