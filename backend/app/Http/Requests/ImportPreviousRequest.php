<?php

namespace App\Http\Requests;

use App\Models\SchoolTerm;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class ImportPreviousRequest extends FormRequest
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
            'preview' => ['sometimes', 'boolean'],
        ];
    }

    /** Only an earlier term can be the source. */
    public function after(): array
    {
        return [function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $term = $this->route('term');
            $from = SchoolTerm::find($this->input('from_term_id'));

            if ($from->id === $term->id || $from->start_date >= $term->start_date) {
                $validator->errors()->add('from_term_id', 'Choose an earlier term.');
            }
        }];
    }
}
