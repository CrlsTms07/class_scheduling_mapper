<?php

namespace App\Http\Requests;

use App\Models\GradeLevel;
use App\Models\Section;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class ReviewScheduleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('review', Section::class);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'scope' => ['required', Rule::in(['section', 'grade_level', 'JHS', 'SHS', 'all'])],
            'scope_ref_id' => ['nullable', 'integer', Rule::requiredIf(in_array($this->input('scope'), ['section', 'grade_level']))],
            'action' => ['required', Rule::in(['approve', 'reject', 'reopen'])],
            'remarks' => ['nullable', 'string', 'max:2000', Rule::requiredIf(in_array($this->input('action'), ['reject', 'reopen']))],
        ];
    }

    public function messages(): array
    {
        return ['remarks.required' => 'Please write the reason.'];
    }

    public function after(): array
    {
        return [function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $refId = $this->input('scope_ref_id');

            $exists = match ($this->input('scope')) {
                'section' => Section::where('id', $refId)->where('school_year_id', $this->route('term')->school_year_id)->exists(),
                'grade_level' => GradeLevel::where('id', $refId)->exists(),
                default => true,
            };

            if (! $exists) {
                $validator->errors()->add('scope_ref_id', 'This section or grade level was not found in this school year.');
            }
        }];
    }

    /**
     * The reference only applies to the section and grade level scopes.
     */
    public function scopeRefId(): ?int
    {
        return in_array($this->input('scope'), ['section', 'grade_level'])
            ? $this->integer('scope_ref_id')
            : null;
    }
}
