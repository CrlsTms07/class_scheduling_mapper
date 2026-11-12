<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class DepEdEmail implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! str_ends_with(strtolower((string) $value), '@deped.gov.ph')) {
            $fail('Use your official DepEd email (@deped.gov.ph).');
        }
    }
}
