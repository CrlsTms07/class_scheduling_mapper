<?php

namespace App\Http\Requests;

use App\Models\SchoolTerm;
use App\Models\Section;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class CopyScheduleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->hasAnyRole([User::ROLE_ADMIN, 'glc', 'master_teacher']);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'from_term_id' => ['required', 'integer', 'exists:school_terms,id'],
            'section_id' => ['nullable', 'integer', 'exists:sections,id'],
            'grade' => ['nullable', 'integer', 'exists:grade_levels,grade'],
            'fill_subjects' => ['required', 'boolean'],
            'preview' => ['required', 'boolean'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $term = $this->route('term');
            $from = SchoolTerm::find($this->input('from_term_id'));

            if ($from->id === $term->id || $from->school_year_id !== $term->school_year_id) {
                $validator->errors()->add('from_term_id', 'Choose another term of this school year.');
            }

            if ($this->filled('section_id') && ! Section::visibleTo($this->user())->whereKey($this->input('section_id'))->exists()) {
                $validator->errors()->add('section_id', 'This section is not in your grade levels.');
            }
        }];
    }
}
