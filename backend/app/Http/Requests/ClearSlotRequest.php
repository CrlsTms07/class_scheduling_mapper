<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\ValidatesSlotDays;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class ClearSlotRequest extends FormRequest
{
    use ValidatesSlotDays;

    public function authorize(): bool
    {
        return $this->user()->can('plot', $this->route('section'));
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'days' => ['required', 'array', 'min:1'],
            'days.*' => ['integer', 'distinct', 'between:1,5'],
        ];
    }

    public function after(): array
    {
        return [fn (Validator $validator) => $this->validateSlotAndDays($validator)];
    }
}
