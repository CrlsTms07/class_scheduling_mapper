<?php

namespace App\Http\Requests;

use App\Rules\DepEdEmail;
use Illuminate\Foundation\Http\FormRequest;

class LoginRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge(['email' => strtolower(trim((string) $this->input('email')))]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'email' => ['required', 'email', new DepEdEmail],
            'password' => ['required', 'string'],
        ];
    }
}
