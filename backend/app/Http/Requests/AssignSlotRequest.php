<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\ValidatesSlotDays;
use App\Models\SectionSubject;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class AssignSlotRequest extends FormRequest
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
            'section_subject_id' => ['required', 'integer'],
            // An asynchronous period needs no room (Nov 21, 2026).
            'room_id' => [Rule::requiredIf(fn () => ! $this->route('timeSlot')?->is_async), 'nullable', 'integer', Rule::exists('rooms', 'id')->where('is_active', true)],
            'days' => ['required', 'array', 'min:1'],
            'days.*' => ['integer', 'distinct', 'between:1,5'],
        ];
    }

    public function after(): array
    {
        return [
            fn (Validator $validator) => $this->validateSlotAndDays($validator),
            function (Validator $validator) {
                $section = $this->route('section');
                if (! $validator->errors()->has('room_id') && $this->filled('room_id')
                    && ! \App\Models\Room::whereKey($this->integer('room_id'))->forLevel($section->gradeLevel->level)->exists()) {
                    $validator->errors()->add('room_id', 'Choose a room of this department or a shared one.');
                }
            },
            function (Validator $validator) {
                if (! $validator->errors()->has('section_subject_id') && ! $this->loading()) {
                    $validator->errors()->add('section_subject_id', 'This subject is not loaded on this section.');
                }
            },
        ];
    }

    /**
     * The teacher loading row, which must belong to this section and term.
     */
    public function loading(): ?SectionSubject
    {
        return SectionSubject::where('id', $this->input('section_subject_id'))
            ->where('term_id', $this->route('term')->id)
            ->where('section_id', $this->route('section')->id)
            ->first();
    }
}
