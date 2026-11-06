<?php

namespace App\Http\Requests;

use App\Models\GradeLevel;
use App\Models\Section;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class SaveSectionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('manage', Section::class);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'grade_level_id' => ['required', 'integer', 'exists:grade_levels,id'],
            'name' => ['required', 'string', 'max:60'],
            'shift' => ['required', Rule::in(['AM', 'PM', 'WHOLE_DAY'])],
            'track_id' => ['nullable', 'integer', 'exists:tracks,id'],
            'adviser_id' => ['nullable', 'integer', 'exists:teachers,id'],
            'home_room_id' => ['nullable', 'integer', 'exists:rooms,id'],
            'class_size' => ['nullable', 'integer', 'between:0,200'],
        ];
    }

    public function after(): array
    {
        return [
            fn (Validator $validator) => $this->validateUniqueName($validator),
            fn (Validator $validator) => $this->validateDepartmentFields($validator),
            fn (Validator $validator) => $this->validateAdviser($validator),
        ];
    }

    private function yearId(): int
    {
        return $this->route('schoolYear')?->id ?? $this->route('section')->school_year_id;
    }

    /**
     * The other sections of this school year.
     */
    private function otherSections()
    {
        return Section::where('school_year_id', $this->yearId())
            ->when($this->route('section'), fn ($query, $section) => $query->whereKeyNot($section->id));
    }

    private function validateUniqueName(Validator $validator): void
    {
        if ($validator->errors()->hasAny(['grade_level_id', 'name'])) {
            return;
        }

        $taken = $this->otherSections()
            ->where('grade_level_id', $this->input('grade_level_id'))
            ->whereRaw('LOWER(name) = LOWER(?)', [trim($this->input('name'))])
            ->exists();

        if ($taken) {
            $validator->errors()->add('name', 'This grade level already has a section with this name.');
        }
    }

    /**
     * Tracks are for Senior High. Fixed home rooms are for Junior High.
     */
    private function validateDepartmentFields(Validator $validator): void
    {
        if ($validator->errors()->has('grade_level_id')) {
            return;
        }

        $level = GradeLevel::find($this->input('grade_level_id'))->level;

        if ($level === 'JHS' && $this->filled('track_id')) {
            $validator->errors()->add('track_id', 'Only Senior High sections have a track.');
        }

        if ($level === 'SHS' && $this->filled('home_room_id')) {
            $validator->errors()->add('home_room_id', 'Only Junior High sections have a fixed home room.');
        }
    }

    private function validateAdviser(Validator $validator): void
    {
        if (! $this->filled('adviser_id') || $validator->errors()->has('adviser_id')) {
            return;
        }

        $adviser = DB::table('teachers')->where('id', $this->input('adviser_id'))->first();

        if ($adviser->personnel_type !== 'teaching' || ! $adviser->is_active) {
            $validator->errors()->add('adviser_id', 'An adviser must be active teaching personnel.');

            return;
        }

        $advisory = $this->otherSections()->with('gradeLevel')->where('adviser_id', $adviser->id)->first();

        if ($advisory) {
            $validator->errors()->add('adviser_id', "This teacher already advises {$advisory->label()}.");
        }
    }
}
