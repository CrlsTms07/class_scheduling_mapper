<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AccountService
{
    public function __construct(private AuditLogger $audit) {}

    /**
     * Signs the user in, or explains why not. The account status is only revealed
     * after a correct password, so strangers cannot check who has an account.
     */
    public function login(string $email, string $password): User
    {
        if (! Auth::guard('web')->attempt(['email' => $email, 'password' => $password])) {
            throw ValidationException::withMessages(['email' => 'Incorrect email or password.']);
        }

        /** @var User $user */
        $user = Auth::guard('web')->user();

        if ($user->status !== 'active') {
            Auth::guard('web')->logout();

            throw new HttpResponseException(response()->json(
                $user->status === 'pending'
                    ? ['message' => 'Your account is waiting for the Admin to activate it.', 'code' => 'account_pending']
                    : ['message' => 'Your account is not active. Please contact the Admin.', 'code' => 'account_not_active'],
                403,
            ));
        }

        return $user;
    }

    /**
     * Creates a pending account with no role. The Admin assigns the role and scope later.
     *
     * @param  array<string, mixed>  $data
     */
    public function register(array $data): User
    {
        return User::create([...$data, 'status' => 'pending']);
    }

    public function sendPasswordResetLink(string $email): void
    {
        Password::sendResetLink(['email' => $email]);
    }

    /**
     * @param  array{token: string, email: string, password: string}  $data
     */
    public function resetPassword(array $data): void
    {
        $status = Password::reset($data, function (User $user, string $password) {
            $user->forceFill(['password' => $password, 'remember_token' => Str::random(60)])->save();

            // Sign out every device that used the old password.
            DB::table('sessions')->where('user_id', $user->id)->delete();

            event(new PasswordReset($user));
        });

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages(['email' => 'This reset link is invalid or has expired.']);
        }
    }

    /**
     * Activates an account and sets its role, grade-level scope and personnel record.
     *
     * @param  array{role: string, grade_level_ids: array<int>, teacher_id?: int|null}  $data
     */
    public function activate(User $user, User $admin, array $data): void
    {
        DB::transaction(function () use ($user, $admin, $data) {
            $before = $this->accessOf($user);

            $user->update(['status' => 'active']);
            $user->syncRoles([$data['role']]);
            $user->gradeLevels()->sync($data['grade_level_ids']);

            DB::table('teachers')->where('user_id', $user->id)->update(['user_id' => null]);

            if (! empty($data['teacher_id'])) {
                DB::table('teachers')->where('id', $data['teacher_id'])->update(['user_id' => $user->id]);
            }

            $this->audit->log($admin, 'activate', 'users', $user->id, $before, $this->accessOf($user->fresh()));
        });
    }

    /**
     * @return array<string, mixed>
     */
    private function accessOf(User $user): array
    {
        return [
            'status' => $user->status,
            'role' => $user->getRoleNames()->first(),
            'grade_level_ids' => $user->gradeLevels()->pluck('grade_levels.id')->all(),
            'teacher_id' => DB::table('teachers')->where('user_id', $user->id)->value('id'),
        ];
    }
}
