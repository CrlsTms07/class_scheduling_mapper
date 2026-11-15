<?php

namespace App\Http\Controllers;

use App\Http\Requests\RegisterRequest;
use App\Services\AccountService;
use Illuminate\Http\JsonResponse;

class RegistrationController extends Controller
{
    public function store(RegisterRequest $request, AccountService $accounts): JsonResponse
    {
        $user = $accounts->register($request->validated());

        return response()->json([
            'message' => $user->status === 'active'
                ? 'Your account is ready, since your name is on the school\'s list of teachers. You can sign in now.'
                : 'Your account was created. You can sign in after the Admin activates it.',
            'status' => $user->status,
        ], 201);
    }
}
