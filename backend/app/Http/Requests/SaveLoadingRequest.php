<?php

namespace App\Http\Requests;

use App\Models\SectionSubject;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Validator;

class SaveLoadingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('plot', $this->route('section'));
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return ['teacher_id' => ['required', 'integer', 'exists:teachers,id']];
    }

    public function after(): array
    {
        return [fn (Validator $validator) => $this->validateTeacher($validator)];
    }

    /**
     * Only active teaching personnel can get subjects. Someone already holding this subject
     * passes, so saving never fails just because they have since become inactive.
     */
    private function validateTeacher(Validator $validator): void
    {
        if ($validator->errors()->has('teacher_id')) {
            return;
        }

        $teacherId = (int) $this->input('teacher_id');

        $current = SectionSubject::where('term_id', $this->route('term')->id)
            ->where('section_id', $this->route('section')->id)
            ->where('subject_id', $this->route('subject')->id)
            ->value('teacher_id');

        if ((int) $current === $teacherId) {
            return;
        }

        $teacher = DB::table('teachers')->where('id', $teacherId)->first();

        if ($teacher->personnel_type !== 'teaching' || ! $teacher->is_active) {
            $validator->errors()->add('teacher_id', 'Only active teaching personnel can be given subjects.');
        }
    }
}
