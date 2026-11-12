<?php

namespace App\Http\Controllers;

use App\Http\Requests\RegisterRequest;
use App\Services\AccountService;
use Illuminate\Http\JsonResponse;

class RegistrationController extends Controller
{
    public function store(RegisterRequest $request, AccountService $accounts): JsonResponse
    {
        $accounts->register($request->validated());

        return response()->json([
            'message' => 'Your account was created. You can sign in after the Admin activates it.',
        ], 201);
    }
}
