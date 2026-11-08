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

    public function me(Request $request): UserResource
    {
        return new UserResource($request->user()->load('gradeLevels'));
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

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Signed out.']);
    }
}
