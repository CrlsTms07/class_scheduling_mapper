<?php

namespace App\Services;

use App\Mail\LoginCodeMail;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * The second step of signing in: a 6-digit code sent to the account's DepEd email, valid for 10
 * minutes and 5 tries. A device the user chooses to remember skips it for 30 days.
 */
class LoginCodeService
{
    public const MINUTES_VALID = 10;

    public const MAX_ATTEMPTS = 5;

    public const TRUST_DAYS = 30;

    public const COOKIE = 'trusted_device';

    public function __construct(private AuditLogger $audit) {}

    /**
     * On only when emails can really be sent. "auto" (the default) turns it on once a real mailer
     * is set, so no one is locked out while emails still go to the log.
     */
    public function isEnabled(): bool
    {
        $setting = strtolower((string) config('school.login_code', 'auto'));

        if ($setting === 'auto') {
            return ! in_array(config('mail.default'), ['log', 'array'], true);
        }

        return filter_var($setting, FILTER_VALIDATE_BOOL);
    }

    public function isTrustedDevice(User $user, ?string $token): bool
    {
        if (! $token) {
            return false;
        }

        $device = DB::table('trusted_devices')
            ->where('user_id', $user->id)
            ->where('token_hash', hash('sha256', $token))
            ->whereRaw('expires_at > now()')
            ->first();

        if ($device) {
            DB::table('trusted_devices')->where('id', $device->id)->update(['last_used_at' => DB::raw('now()')]);
        }

        return (bool) $device;
    }

    /** A new code replaces any earlier one, so only the latest email works. */
    public function send(User $user): void
    {
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        DB::transaction(function () use ($user, $code) {
            DB::table('login_codes')->where('user_id', $user->id)->delete();
            DB::table('login_codes')->insert([
                'user_id' => $user->id,
                'code_hash' => Hash::make($code),
                // The database's own clock, for making and checking: no time zone mix-up.
                'expires_at' => DB::raw("now() + interval '".self::MINUTES_VALID." minutes'"),
            ]);
        });

        Mail::to($user->email)->send(new LoginCodeMail($user, $code, self::MINUTES_VALID));
    }

    /** Checks the code; a wrong one uses up a try, and the 5th wrong one ends this code. */
    public function verify(User $user, string $code): void
    {
        $row = DB::table('login_codes')
            ->where('user_id', $user->id)
            ->select('*', DB::raw('expires_at < now() AS is_expired'))
            ->latest('id')
            ->first();

        if (! $row || $row->is_expired) {
            throw ValidationException::withMessages(['code' => 'This code has expired. Press "Send a new code".']);
        }

        if ($row->attempts >= self::MAX_ATTEMPTS) {
            throw ValidationException::withMessages(['code' => 'Too many wrong codes. Press "Send a new code".']);
        }

        if (! preg_match('/^\d{6}$/', $code) || ! Hash::check($code, $row->code_hash)) {
            DB::table('login_codes')->where('id', $row->id)->increment('attempts');
            $left = self::MAX_ATTEMPTS - $row->attempts - 1;

            throw ValidationException::withMessages(['code' => $left > 0
                ? "That code is not right. {$left} ".($left === 1 ? 'try' : 'tries').' left.'
                : 'Too many wrong codes. Press "Send a new code".']);
        }

        DB::table('login_codes')->where('user_id', $user->id)->delete();
        $this->audit->log($user, 'login_code', 'users', $user->id);
    }

    /** Remembers this browser for 30 days; the returned token goes in a cookie, only its hash here. */
    public function trustDevice(User $user): string
    {
        $token = Str::random(64);

        DB::table('trusted_devices')->insert([
            'user_id' => $user->id,
            'token_hash' => hash('sha256', $token),
            'expires_at' => DB::raw("now() + interval '".self::TRUST_DAYS." days'"),
        ]);

        return $token;
    }

    /** "juan.delacruz@deped.gov.ph" becomes "ju***@deped.gov.ph", to show where the code went. */
    public static function maskedEmail(string $email): string
    {
        [$name, $domain] = array_pad(explode('@', $email, 2), 2, '');

        return mb_substr($name, 0, 2).'***@'.$domain;
    }
}
