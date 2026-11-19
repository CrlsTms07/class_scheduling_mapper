<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * A name people will pick from a list (a track, department, designation or task) must read like a
 * name: letters with numbers and simple punctuation, at least one vowel unless it is an all-caps
 * short form ("SSG", "ICT"), and no key held down ("aaaa"). The same rule runs in the web app
 * (frontend/src/lib/forms.js, readableNameError), so the message shows while typing.
 */
class ReadableName implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $name = trim((string) $value);

        if (mb_strlen($name) < 2) {
            $fail('Type at least 2 characters.');
        } elseif (! preg_match("/^[\\pL\\pN][\\pL\\pN .,'&()\\/-]*$/u", $name)) {
            $fail("Use letters and numbers only, with spaces and . , ' - & ( ) /");
        } elseif (preg_match_all('/\pL/u', $name) < 2) {
            $fail('A name needs at least 2 letters.');
        } elseif (preg_match('/(.)\1{3,}/u', $name)) {
            $fail('The same character is typed 4 times in a row. Check the spelling.');
        } elseif (! preg_match('/[aeiouy]/i', $name) && ! preg_match('/^[A-Z]{2,6}$/', $name)) {
            $fail('This does not look like a name (it has no vowel). Check the spelling, or type a short form in capitals, like SSG.');
        }
    }
}
