<?php

namespace App\Http\Requests;

use App\Models\SchoolYear;
use App\Models\TimeSlot;
use App\Support\ScheduleFormat;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class SaveTimeSlotRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('manage', SchoolYear::class);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'is_break' => ['required', 'boolean'],
            'label' => ['nullable', 'string', 'max:40', 'required_if_accepted:is_break'],
            'start_time' => ['required', 'date_format:H:i'],
            'end_time' => ['required', 'date_format:H:i', 'after:start_time'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'label.required_if_accepted' => 'Name this break, like Recess or Lunch.',
            'end_time.after' => 'The end time must be after the start time.',
        ];
    }

    public function after(): array
    {
        return [fn (Validator $validator) => $this->validateNoOverlap($validator)];
    }

    /**
     * Back-to-back is fine: a period may start the minute the previous one ends.
     */
    private function validateNoOverlap(Validator $validator): void
    {
        if ($validator->errors()->isNotEmpty()) {
            return;
        }

        $editing = $this->route('timeSlot');
        $patternId = $editing?->day_pattern_id ?? $this->route('dayPattern')->id;

        $overlapping = TimeSlot::where('day_pattern_id', $patternId)
            ->where('start_time', '<', $this->input('end_time'))
            ->where('end_time', '>', $this->input('start_time'))
            ->when($editing, fn ($query) => $query->whereKeyNot($editing->id))
            ->first();

        if ($overlapping) {
            $name = $overlapping->is_break ? $overlapping->label : "Period {$overlapping->period_no}";
            $from = ScheduleFormat::time($overlapping->start_time);
            $to = ScheduleFormat::time($overlapping->end_time);

            $validator->errors()->add('start_time', "This overlaps {$name} ({$from} – {$to}).");
        }
    }
}
