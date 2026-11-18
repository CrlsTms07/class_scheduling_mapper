<?php

namespace App\Http\Controllers;

use App\Http\Requests\LoginRequest;
use App\Http\Resources\UserResource;
use App\Services\AccountService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AuthController extends Controller
{
    public function login(LoginRequest $request, AccountService $accounts): UserResource
    {
        $user = $accounts->login($request->validated('email'), $request->validated('password'));

        // A new session id after login prevents session fixation.
        $request->session()->regenerate();

        return new UserResource($user->load('gradeLevels'));
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
        $request->validate(['accept_terms' => ['accepted']], ['accept_terms.accepted' => 'Please read and accept the Terms and Conditions.']);
        $user = $request->user();

        if ($user->terms_accepted_at === null) {
            $user->forceFill(['terms_accepted_at' => now()])->save();
        }

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
