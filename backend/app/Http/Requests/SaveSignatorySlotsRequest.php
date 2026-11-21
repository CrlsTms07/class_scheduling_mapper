<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * The fixed signatories of each department's Class Program (team decisions, Nov 21, 2026):
 * - Junior High, a 2×2 block: Prepared by, Conforme (the section's adviser, filled in by the
 *   system), Recommending Approval, Approved by.
 * - Senior High, a row of three: Prepared by, Noted by, Approved by.
 * The Admin types the name and position of each one that is not automatic.
 */
class SaveSignatorySlotsRequest extends FormRequest
{
    /** The typed slots of each department, in printing order, with their printed label. */
    public const SLOTS = [
        'JHS' => ['prepared_by' => 'Prepared by', 'recommending_approval' => 'Recommending Approval', 'approved_by' => 'Approved by'],
        'SHS' => ['prepared_by' => 'Prepared by', 'noted_by' => 'Noted by', 'approved_by' => 'Approved by'],
    ];

    public function authorize(): bool
    {
        return $this->user()->can('manage-reports');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $rules = ['level' => ['required', \Illuminate\Validation\Rule::in(['JHS', 'SHS'])]];
        foreach (array_keys(self::SLOTS[$this->input('level')] ?? self::SLOTS['JHS']) as $slot) {
            $rules["{$slot}.name"] = ['required', 'string', 'max:120'];
            $rules["{$slot}.position"] = ['required', 'string', 'max:120'];
        }

        return $rules;
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            '*.name.required' => 'Type the name to print.',
            '*.position.required' => 'Type the position, like Head Teacher III.',
        ];
    }
}
