<?php

namespace App\Http\Controllers;

use App\Http\Requests\ActivateUserRequest;
use App\Http\Requests\ChangeUserStatusRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\AccountService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class UserActivationController extends Controller
{
    public function update(ActivateUserRequest $request, User $user, AccountService $accounts): UserResource
    {
        $accounts->activate($user, $request->user(), $request->validated());

        return new UserResource($user->fresh()->load('gradeLevels'));
    }

    public function changeStatus(ChangeUserStatusRequest $request, User $user, AccountService $accounts): UserResource
    {
        $accounts->changeStatus($user, $request->user(), $request->input('status'));

        return new UserResource($user->fresh()->load('gradeLevels'));
    }

    public function destroy(Request $request, User $user, AccountService $accounts): JsonResponse
    {
        Gate::authorize('activate', $user);

        $accounts->delete($user, $request->user());

        return response()->json(['message' => 'The account was deleted.']);
    }
}
