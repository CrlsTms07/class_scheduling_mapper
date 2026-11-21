<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * The four signatories of the printed forms, always the same 2×2 block (team decision, Nov 21,
 * 2026): Prepared by, Conforme (filled in from the section's adviser), Recommending Approval and
 * Approved by. The Admin types the name and position of the three that are not automatic.
 */
class SaveSignatorySlotsRequest extends FormRequest
{
    public const SLOTS = ['prepared_by', 'recommending_approval', 'approved_by'];

    public function authorize(): bool
    {
        return $this->user()->can('manage-reports');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $rules = [];
        foreach (self::SLOTS as $slot) {
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
