<?php

namespace App\Http\Requests;

use App\Models\DayPattern;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * A whole bell schedule at once, from a preset (8, 10, 14 or 16 rows). Only for a bell
 * schedule that has no periods yet, so nothing already plotted can change.
 */
class PresetSlotsRequest extends FormRequest
{
    public function authorize(): bool
    {
        $pattern = $this->route('dayPattern') ?? $this->route('timeSlot')?->dayPattern;

        return $this->user()->can('manage', [DayPattern::class, $pattern?->level]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'slots' => ['required', 'array', 'min:1', 'max:20'],
            'slots.*.is_break' => ['required', 'boolean'],
            'slots.*.label' => ['nullable', 'string', 'max:40'],
            'slots.*.start_time' => ['required', 'date_format:H:i'],
            'slots.*.end_time' => ['required', 'date_format:H:i'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            if ($this->route('dayPattern')->timeSlots()->exists()) {
                $validator->errors()->add('slots', 'This bell schedule already has periods. A preset is only for an empty one.');

                return;
            }

            $previousEnd = '00:00';

            foreach ($this->input('slots') as $index => $slot) {
                if ($slot['end_time'] <= $slot['start_time']) {
                    $validator->errors()->add("slots.{$index}.end_time", 'Each row must end after it starts.');
                }
                if ($slot['start_time'] < $previousEnd) {
                    $validator->errors()->add("slots.{$index}.start_time", 'Rows must follow each other without overlapping.');
                }
                if ($slot['is_break'] && blank($slot['label'] ?? null)) {
                    $validator->errors()->add("slots.{$index}.label", 'Name each break, like Recess or Lunch.');
                }

                $previousEnd = $slot['end_time'];
            }
        }];
    }
}
