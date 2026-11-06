<?php

namespace App\Http\Controllers;

use App\Http\Requests\ActivateUserRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\AccountService;

class UserActivationController extends Controller
{
    public function update(ActivateUserRequest $request, User $user, AccountService $accounts): UserResource
    {
        $accounts->activate($user, $request->user(), $request->validated());

        return new UserResource($user->fresh()->load('gradeLevels'));
    }
}
