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

    /** "Activate selected as Teacher" on the Users page. */
    public function activateTeachers(Request $request, AccountService $accounts): JsonResponse
    {
        abort_unless($request->user()->hasRole(User::ROLE_ADMIN), 403);
        $data = $request->validate([
            'user_ids' => ['required', 'array', 'min:1', 'max:500'],
            'user_ids.*' => ['integer', 'distinct', 'exists:users,id'],
        ]);

        $result = $accounts->activateTeachers($data['user_ids'], $request->user());

        return response()->json([
            'message' => "{$result['activated']} ".($result['activated'] === 1 ? 'account' : 'accounts').' activated as Teacher'
                .($result['linked'] > 0 ? ", {$result['linked']} linked to their personnel record." : '.'),
            'data' => $result,
        ]);
    }

    public function changeStatus(ChangeUserStatusRequest $request, User $user, AccountService $accounts): UserResource
    {
        $accounts->changeStatus($user, $request->user(), $request->input('status'));

        return new UserResource($user->fresh()->load('gradeLevels'));
    }

    /** A temporary password for someone who cannot get the reset email. Shown here once. */
    public function resetPassword(Request $request, User $user, AccountService $accounts): JsonResponse
    {
        Gate::authorize('activate', $user);
        abort_unless($user->status === 'active', 422, 'Only an active account can get a temporary password.');

        return response()->json([
            'temporary_password' => $accounts->adminResetPassword($user, $request->user()),
            'message' => "Give this temporary password to {$user->first_name}. They choose a new one when they sign in.",
        ]);
    }

    public function destroy(Request $request, User $user, AccountService $accounts): JsonResponse
    {
        Gate::authorize('activate', $user);

        $accounts->delete($user, $request->user());

        return response()->json(['message' => 'The account was deleted.']);
    }
}
