<?php

namespace App\Http\Requests;

use App\Rules\ReadableName;
use App\Services\TeacherService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\DB;

/**
 * A department, designation or teaching task, added or renamed from the teacher form.
 */
class StorePersonnelOptionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('manage-school-records');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $table = TeacherService::OPTION_TABLES[$this->route('type')];

        $renaming = $this->route('id');

        return ['name' => ['required', 'string', 'max:60', new ReadableName, function (string $attribute, mixed $value, \Closure $fail) use ($table, $renaming) {
            // "Science" and "science" are the same name.
            if (DB::table($table)->whereRaw('LOWER(name) = LOWER(?)', [trim((string) $value)])->when($renaming, fn ($query) => $query->where('id', '<>', (int) $renaming))->exists()) {
                $fail('This already exists in the list.');
            }
        }]];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [];
    }
}
