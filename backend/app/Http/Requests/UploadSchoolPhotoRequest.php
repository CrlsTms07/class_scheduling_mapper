<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UploadSchoolPhotoRequest extends FormRequest
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
        return ['photo' => ['required', 'file', 'mimes:png,jpg,jpeg,webp', 'max:3072']];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'photo.mimes' => 'Use a PNG, JPG or WebP image.',
            'photo.max' => 'The photo must be 3 MB or smaller.',
        ];
    }
}
