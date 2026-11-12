<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\ValidatesSlotDays;
use App\Models\Activity;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class PlaceActivityRequest extends FormRequest
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
            'activity_id' => ['required', 'integer'],
            'scope' => ['required', Rule::in(['section', 'grade', 'all'])],
            'days' => ['required', 'array', 'min:1'],
            'days.*' => ['integer', 'distinct', 'between:1,5'],
            'preview' => ['sometimes', 'boolean'],
        ];
    }

    public function after(): array
    {
        return [
            fn (Validator $validator) => $this->validateSlotAndDays($validator),
            function (Validator $validator) {
                if (! $validator->errors()->has('activity_id') && ! $this->activity()) {
                    $validator->errors()->add('activity_id', 'This activity is not part of this school year.');
                }
            },
        ];
    }

    public function activity(): ?Activity
    {
        return Activity::where('id', $this->input('activity_id'))
            ->where('school_year_id', $this->route('section')->school_year_id)
            ->first();
    }
}
