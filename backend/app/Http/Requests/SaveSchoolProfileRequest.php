<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SaveSchoolProfileRequest extends FormRequest
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
        // Only what changes; the school's name, ID, region, division and address are fixed in
        // config/school.php (team decision, Nov 21, 2026).
        return [
            'phone' => ['required', 'string', 'max:50', 'regex:/^[0-9()+\-\/ ]{7,}$/'],
            'email' => ['required', 'email', 'max:150'],
            'facebook_url' => ['required', 'url', 'max:255', 'regex:/^https?:\/\/(www\.|m\.)?facebook\.com\//i'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'phone.regex' => 'Write the phone number with digits, like (046) 894-1463.',
            'facebook_url.regex' => 'Use the link of the school\'s Facebook page, like https://www.facebook.com/DepEdTayoERCIHS301179.',
            'facebook_url.url' => 'Use the full link, starting with https://.',
        ];
    }
}
