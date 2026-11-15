<?php

namespace App\Http\Controllers;

use App\Http\Requests\ForgotPasswordRequest;
use App\Http\Requests\ResetPasswordRequest;
use App\Services\AccountService;
use Illuminate\Http\JsonResponse;

class PasswordResetController extends Controller
{
    public function sendLink(ForgotPasswordRequest $request, AccountService $accounts): JsonResponse
    {
        $accounts->sendPasswordResetLink($request->validated('email'));

        // Same reply whether or not the email exists, so accounts cannot be discovered here.
        return response()->json([
            'message' => 'If an account exists for that email, we sent a password reset link.',
        ]);
    }

    public function reset(ResetPasswordRequest $request, AccountService $accounts): JsonResponse
    {
        $accounts->resetPassword($request->validated());

        return response()->json(['message' => 'Your password was changed. You can now sign in.']);
    }
}
