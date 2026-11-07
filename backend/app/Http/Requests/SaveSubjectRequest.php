<?php

namespace App\Http\Requests;

use App\Models\GradeLevel;
use App\Models\SchoolYear;
use App\Models\Subject;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class SaveSubjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Both the subject as it is and the grade it moves to must be in the user's scope.
        $subject = $this->route('subject');
        $user = $this->user();

        if ($subject && ! $user->can('manageGrade', $subject)) {
            return false;
        }

        return $user->hasAnyRole(['glc', 'master_teacher']);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'grade_level_id' => ['required', 'integer', 'exists:grade_levels,id'],
            'track_id' => ['nullable', 'integer', 'exists:tracks,id'],
            'term_no' => ['nullable', 'integer', 'min:1'],
            'code' => ['nullable', 'string', 'max:20'],
            'name' => ['required', 'string', 'max:100'],
            'subject_type' => ['required', Rule::in(['core', 'elective', 'other'])],
            'minutes_per_week' => ['required', 'integer', 'between:1,3000'],
            'is_priority' => ['required', 'boolean'],
            'is_active' => ['required', 'boolean'],
        ];
    }

    public function after(): array
    {
        return [
            fn (Validator $validator) => $this->validateScope($validator),
            fn (Validator $validator) => $this->validateTrack($validator),
            fn (Validator $validator) => $this->validateTerm($validator),
            fn (Validator $validator) => $this->validateUniqueName($validator),
        ];
    }

    private function year(): SchoolYear
    {
        return $this->route('schoolYear') ?? SchoolYear::find($this->route('subject')->school_year_id);
    }

    private function validateScope(Validator $validator): void
    {
        if ($validator->errors()->has('grade_level_id')) {
            return;
        }

        if (! in_array((int) $this->input('grade_level_id'), $this->user()->gradeLevelIdsInScope())) {
            $validator->errors()->add('grade_level_id', 'This grade level is not assigned to you.');
        }
    }

    private function validateTrack(Validator $validator): void
    {
        if ($validator->errors()->has('grade_level_id') || ! $this->filled('track_id')) {
            return;
        }

        if (GradeLevel::find($this->input('grade_level_id'))->level === 'JHS') {
            $validator->errors()->add('track_id', 'Only Senior High subjects have a track.');
        }
    }

    /**
     * The number of terms changes per school year, so it is read from the year.
     */
    private function validateTerm(Validator $validator): void
    {
        if ($validator->errors()->has('term_no') || ! $this->filled('term_no')) {
            return;
        }

        $exists = DB::table('school_terms')
            ->where('school_year_id', $this->year()->id)
            ->where('term_no', $this->input('term_no'))
            ->exists();

        if (! $exists) {
            $validator->errors()->add('term_no', 'This school year has no such term.');
        }
    }

    /**
     * The same name is fine in another grade, track or term.
     */
    private function validateUniqueName(Validator $validator): void
    {
        if ($validator->errors()->hasAny(['grade_level_id', 'name', 'track_id', 'term_no'])) {
            return;
        }

        $taken = Subject::where('school_year_id', $this->year()->id)
            ->where('grade_level_id', $this->input('grade_level_id'))
            ->whereRaw('COALESCE(track_id, 0) = ?', [(int) $this->input('track_id')])
            ->whereRaw('COALESCE(term_no, 0) = ?', [(int) $this->input('term_no')])
            ->whereRaw('LOWER(name) = LOWER(?)', [trim($this->input('name'))])
            ->when($this->route('subject'), fn ($query, $subject) => $query->whereKeyNot($subject->id))
            ->exists();

        if ($taken) {
            $validator->errors()->add('name', 'This grade level already has this subject for the same track and term.');
        }
    }
}
