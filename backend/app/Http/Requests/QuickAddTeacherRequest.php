<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Validator;

/**
 * "+ Add new teacher" while loading: a name only, to be completed later on the Teachers page.
 */
class QuickAddTeacherRequest extends FormRequest
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
        return [
            'first_name' => ['required', 'string', 'max:60'],
            'last_name' => ['required', 'string', 'max:60'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $exists = DB::table('teachers')
                ->whereRaw('LOWER(first_name) = LOWER(?)', [trim($this->input('first_name'))])
                ->whereRaw('LOWER(last_name) = LOWER(?)', [trim($this->input('last_name'))])
                ->exists();

            if ($exists) {
                $validator->errors()->add('first_name', 'This person is already in the list.');
            }
        }];
    }
}
