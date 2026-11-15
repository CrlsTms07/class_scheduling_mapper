<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class ChangeUserStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('activate', $this->route('user'));
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return ['status' => ['required', Rule::in(['active', 'inactive'])]];
    }

    /**
     * A pending account has no role yet, so it goes through activation instead.
     */
    public function after(): array
    {
        return [function (Validator $validator) {
            if ($this->route('user')->status === 'pending') {
                $validator->errors()->add('status', 'This account has not been activated yet.');
            }
        }];
    }
}
