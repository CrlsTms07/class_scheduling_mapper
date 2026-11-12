<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\ValidatesSlotDays;
use App\Models\DayPattern;
use App\Models\TimeSlot;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class MoveEntryRequest extends FormRequest
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
            'from_slot_id' => ['required', 'integer', Rule::exists('time_slots', 'id')],
            'from_days' => ['required', 'array', 'min:1'],
            'from_days.*' => ['integer', 'distinct', 'between:1,5'],
            'days' => ['required', 'array', 'min:1'],
            'days.*' => ['integer', 'distinct', 'between:1,5'],
        ];
    }

    public function after(): array
    {
        return [
            fn (Validator $validator) => $this->validateSlotAndDays($validator),
            function (Validator $validator) {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                if (count($this->input('from_days')) !== count($this->input('days'))) {
                    $validator->errors()->add('days', 'Each day moved needs a day to go to.');

                    return;
                }

                $pattern = DayPattern::forSection($this->route('section'))->find($this->fromSlot()->day_pattern_id);

                if (! $pattern || array_diff($this->input('from_days'), $pattern->day_numbers) !== []) {
                    $validator->errors()->add('from_slot_id', "This class is not in this section's bell schedule.");
                }
            },
        ];
    }

    public function fromSlot(): TimeSlot
    {
        return TimeSlot::findOrFail($this->integer('from_slot_id'));
    }
}
