<?php

namespace App\Http\Requests\Concerns;

use App\Models\DayPattern;
use App\Models\Section;
use App\Models\TimeSlot;
use Illuminate\Validation\Validator;

/**
 * A time slot must belong to one of the section's bell schedules, must not be a break,
 * and can only be used on the days of its own bell schedule.
 */
trait ValidatesSlotDays
{
    protected function validateSlotAndDays(Validator $validator): void
    {
        /** @var TimeSlot $slot */
        $slot = $this->route('timeSlot');
        /** @var Section $section */
        $section = $this->route('section');

        $pattern = DayPattern::forSection($section)->find($slot->day_pattern_id);

        if (! $pattern) {
            $validator->errors()->add('time_slot', "This time slot is not part of this section's bell schedule.");

            return;
        }

        if ($slot->is_break) {
            $validator->errors()->add('time_slot', 'A class cannot be placed on a break.');
        }

        if ($validator->errors()->has('days')) {
            return;
        }

        if (array_diff($this->input('days'), $pattern->day_numbers) !== []) {
            $validator->errors()->add('days', "These days are not part of {$pattern->name}.");
        }
    }
}
