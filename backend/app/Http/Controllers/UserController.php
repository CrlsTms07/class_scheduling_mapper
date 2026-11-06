<?php

namespace App\Http\Controllers;

use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class UserController extends Controller
{
    /**
     * All accounts, with pending sign-ups first so the Admin sees them right away.
     */
    public function index(): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', User::class);

        $users = User::with(['gradeLevels', 'roles'])
            ->orderByRaw("CASE WHEN status = 'pending' THEN 0 ELSE 1 END")
            ->orderBy('last_name')
            ->get();

        return UserResource::collection($users);
    }

    /**
     * What the Admin chooses from when activating an account.
     */
    public function accessOptions(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', User::class);

        return response()->json(['data' => [
            'grade_levels' => DB::table('grade_levels')->orderBy('grade')->get(['id', 'grade', 'level']),
            'teachers' => DB::table('teachers')
                ->whereNull('user_id')
                ->where('is_active', true)
                ->orderBy('last_name')
                ->get(['id', 'first_name', 'last_name']),
        ]]);
    }
}
