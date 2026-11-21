<?php

namespace App\Http\Requests;

use App\Rules\ReadableName;
use App\Services\TeacherService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\DB;

/**
 * A department, designation or teaching task, added or renamed from the teacher form. A department
 * belongs to Junior High or Senior High (Nov 21, 2026): a Chairperson or Master Teacher always adds
 * to their own; the Admin chooses. The same name may exist once in each.
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
        $isDepartment = $this->route('type') === 'departments';
        $level = $isDepartment ? $this->departmentLevel() : null;

        return ['level' => $isDepartment && ! $renaming ? ['required', \Illuminate\Validation\Rule::in(['JHS', 'SHS'])] : ['nullable'], 'name' => ['required', 'string', 'max:60', new ReadableName, function (string $attribute, mixed $value, \Closure $fail) use ($table, $renaming, $isDepartment, $level) {
            // "Science" and "science" are the same name (in the same department level).
            if (DB::table($table)->whereRaw('LOWER(name) = LOWER(?)', [trim((string) $value)])
                ->when($renaming, fn ($query) => $query->where('id', '<>', (int) $renaming))
                ->when($isDepartment, fn ($query) => $query->whereRaw("COALESCE(level::text, '') = ?", [(string) $level]))
                ->exists()) {
                $fail('This already exists in the list.');
            }
        }]];
    }

    /** The level of the department being added or renamed. */
    public function departmentLevel(): ?string
    {
        if ($id = $this->route('id')) {
            return DB::table('departments')->where('id', (int) $id)->value('level');
        }

        return $this->input('level');
    }

    /**
     * A Chairperson or Master Teacher adds departments to their own level only.
     */
    protected function prepareForValidation(): void
    {
        $own = $this->user()->departmentsInScope();
        if ($this->route('type') === 'departments' && $own !== null && count($own) === 1) {
            $this->merge(['level' => $own[0]]);
        }
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['level.required' => 'Choose Junior High or Senior High first.'];
    }
}
