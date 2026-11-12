<?php

namespace App\Http\Requests;

use App\Models\DayPattern;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * One bell schedule. A new one (or a copy) needs a level and shift. An existing one keeps
 * them, because its time slots and schedules already belong to that level and shift.
 */
class SaveDayPatternRequest extends FormRequest
{
    /** The department of the bell schedule, and of the new one for a copy, must be the user's. */
    public function authorize(): bool
    {
        $levels = array_filter([$this->route('dayPattern')?->level, $this->input('level')]);

        return collect($levels ?: [null])->every(fn ($level) => $this->user()->can('manage', [DayPattern::class, $level]));
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'level' => [Rule::requiredIf(! $this->isEditing()), Rule::in(['JHS', 'SHS'])],
            'shift' => [Rule::requiredIf(! $this->isEditing()), Rule::in(['AM', 'PM', 'WHOLE_DAY'])],
            'name' => ['required', 'string', 'max:40'],
            'days' => ['required', 'array', 'min:1', 'max:5'],
            'days.*' => ['integer', 'between:1,5', 'distinct'],
        ];
    }

    public function after(): array
    {
        return [fn (Validator $validator) => $this->validateAgainstOtherPatterns($validator)];
    }

    /**
     * Within one year, level and shift, a day has only one bell schedule and names do not repeat.
     */
    private function validateAgainstOtherPatterns(Validator $validator): void
    {
        if ($validator->errors()->isNotEmpty()) {
            return;
        }

        $editing = $this->editedPattern();
        $source = $this->route('dayPattern');

        $others = DayPattern::query()
            ->where('school_year_id', $this->route('schoolYear')?->id ?? $source->school_year_id)
            ->where('level', $editing?->level ?? $this->input('level'))
            ->where('shift', $editing?->shift ?? $this->input('shift'))
            ->when($editing, fn ($query) => $query->whereKeyNot($editing->id))
            ->get();

        foreach ($others as $other) {
            if (strcasecmp($other->name, $this->input('name')) === 0) {
                $validator->errors()->add('name', "There is already a bell schedule named {$other->name}.");

                return;
            }

            if (array_intersect($other->day_numbers, $this->input('days')) !== []) {
                $validator->errors()->add('days', "One of these days already belongs to {$other->name}.");

                return;
            }
        }
    }

    private function isEditing(): bool
    {
        return $this->editedPattern() !== null;
    }

    /**
     * The pattern being changed. Copying also has a pattern in its URL, but that one stays as it is.
     */
    private function editedPattern(): ?DayPattern
    {
        return $this->isMethod('PUT') ? $this->route('dayPattern') : null;
    }
}
