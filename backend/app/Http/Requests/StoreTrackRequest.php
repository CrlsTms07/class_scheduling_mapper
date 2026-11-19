<?php

namespace App\Http\Requests;

use App\Rules\ReadableName;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\DB;

class StoreTrackRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('manage-school-records');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return ['name' => ['required', 'string', 'max:80', new ReadableName, function (string $attribute, mixed $value, \Closure $fail) {
            // "academic" and "Academic" are the same track.
            if (DB::table('tracks')->whereRaw('LOWER(name) = LOWER(?)', [trim((string) $value)])->exists()) {
                $fail('This track already exists.');
            }
        }]];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [];
    }
}
