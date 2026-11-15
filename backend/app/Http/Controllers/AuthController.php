<?php

namespace App\Http\Controllers;

use App\Http\Requests\LoginRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\AccountService;
use App\Services\LoginCodeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(LoginRequest $request, AccountService $accounts, LoginCodeService $codes): UserResource|JsonResponse
    {
        $user = $accounts->login($request->validated('email'), $request->validated('password'));

        // Step two: a code sent to the DepEd email, unless this device was remembered.
        if ($codes->isEnabled() && ! $codes->isTrustedDevice($user, $request->cookie(LoginCodeService::COOKIE))) {
            Auth::guard('web')->logout();
            $request->session()->regenerate();
            $request->session()->put('login.pending', [
                'user_id' => $user->id,
                'until' => now()->addMinutes(LoginCodeService::MINUTES_VALID)->timestamp,
            ]);

            return $this->sendCode($codes, $user, 202);
        }

        // A new session id after login prevents session fixation.
        $request->session()->regenerate();

        return new UserResource($user->load('gradeLevels'));
    }

    /** "Verify": the code from the email finishes signing in; the device can be remembered. */
    public function verifyCode(Request $request, LoginCodeService $codes): UserResource
    {
        $data = $request->validate([
            'code' => ['required', 'string'],
            'remember_device' => ['sometimes', 'boolean'],
        ], ['code.required' => 'Enter the 6-digit code from your email.']);

        $user = $this->pendingUser($request);
        $codes->verify($user, preg_replace('/\D/', '', $data['code']));

        Auth::guard('web')->login($user);
        $request->session()->forget('login.pending');
        $request->session()->regenerate();

        if ($request->boolean('remember_device')) {
            Cookie::queue(cookie(
                LoginCodeService::COOKIE,
                $codes->trustDevice($user),
                LoginCodeService::TRUST_DAYS * 24 * 60,
                null,
                null,
                (bool) config('session.secure'),
                true,
                false,
                'lax',
            ));
        }

        return new UserResource($user->load('gradeLevels'));
    }

    /** "Send a new code", at most once a minute. */
    public function resendCode(Request $request, LoginCodeService $codes): JsonResponse
    {
        $user = $this->pendingUser($request);
        $key = "login-code-resend:{$user->id}";

        if (RateLimiter::tooManyAttempts($key, 1)) {
            $seconds = RateLimiter::availableIn($key);

            return response()->json(['message' => "Please wait {$seconds} seconds before asking for a new code."], 429);
        }

        RateLimiter::hit($key, 60);
        $request->session()->put('login.pending.until', now()->addMinutes(LoginCodeService::MINUTES_VALID)->timestamp);

        return $this->sendCode($codes, $user, 200);
    }

    private function pendingUser(Request $request): User
    {
        $pending = $request->session()->get('login.pending');
        $user = $pending && ($pending['until'] ?? 0) >= now()->timestamp ? User::find($pending['user_id'] ?? 0) : null;

        if (! $user || $user->status !== 'active') {
            $request->session()->forget('login.pending');

            throw ValidationException::withMessages(['code' => 'Your sign-in has expired. Please sign in again.']);
        }

        return $user;
    }

    private function sendCode(LoginCodeService $codes, User $user, int $status): JsonResponse
    {
        try {
            $codes->send($user);
        } catch (\Throwable $problem) {
            Log::error('The sign-in code could not be sent.', ['user' => $user->id, 'error' => $problem->getMessage()]);

            return response()->json(['message' => 'The sign-in code could not be sent. Please try again in a minute, or ask the Admin.'], 503);
        }

        return response()->json([
            'code_required' => true,
            'sent_to' => LoginCodeService::maskedEmail($user->email),
            'minutes' => LoginCodeService::MINUTES_VALID,
            'message' => 'We sent a 6-digit code to your DepEd email.',
        ], $status);
    }

    /**
     * The signed-in user, or null for a visitor, so a visitor's browser shows no error.
     * A deactivated account is signed out and told why, as on every other page.
     */
    public function me(Request $request): UserResource|JsonResponse
    {
        $user = auth('sanctum')->user();

        if (! $user) {
            return response()->json(['data' => null]);
        }

        if ($user->status !== 'active') {
            Auth::guard('web')->logout();
            if ($request->hasSession()) {
                $request->session()->invalidate();
            }

            return response()->json(['message' => 'Your account is not active. Please contact the Admin.', 'code' => 'account_not_active'], 403);
        }

        return new UserResource($user->load('gradeLevels'));
    }

    /**
     * Screen choices the user keeps on any device.
     */
    public function updatePreferences(Request $request): UserResource
    {
        $validated = $request->validate(['color_coding' => ['required', 'boolean']]);
        $user = $request->user();

        $user->forceFill(['preferences' => [...($user->preferences ?? []), ...$validated]])->save();

        return new UserResource($user->load('gradeLevels'));
    }

    /** A new password of one's own, required after the Admin gave a temporary one. */
    public function changePassword(Request $request, AccountService $accounts): UserResource
    {
        $request->validate([
            'password' => ['required', 'confirmed', \Illuminate\Validation\Rules\Password::defaults(), 'different:current_password'],
            'current_password' => ['required', 'current_password'],
        ], [
            'current_password.current_password' => 'This is not your current password.',
            'password.different' => 'Choose a password different from the temporary one.',
        ]);

        $accounts->changePassword($request->user(), $request->input('password'));

        return new UserResource($request->user()->fresh()->load('gradeLevels'));
    }

    /** The Terms and Conditions, accepted on the first sign-in by accounts made before they existed. */
    public function acceptTerms(Request $request): UserResource
    {
        $user = $request->user();
        // Only what is still missing is asked: the terms, the privacy notice, or both.
        $request->validate(array_filter([
            'accept_terms' => $user->terms_accepted_at === null ? ['accepted'] : null,
            'accept_privacy' => $user->privacy_accepted_at === null ? ['accepted'] : null,
        ]), [
            'accept_terms.accepted' => 'Please read and accept the Terms and Conditions.',
            'accept_privacy.accepted' => 'Please read and agree to the Data Privacy Notice.',
        ]);

        $user->forceFill([
            'terms_accepted_at' => $user->terms_accepted_at ?? now(),
            'privacy_accepted_at' => $user->privacy_accepted_at ?? now(),
        ])->save();

        return new UserResource($user->load('gradeLevels'));
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Signed out.']);
    }
}
