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
        unset($data['accept_terms'], $data['accept_privacy']);

        $user = User::create([...$data, 'status' => 'pending']);
        $user->forceFill(['terms_accepted_at' => now(), 'privacy_accepted_at' => now()])->save();

        // Someone already encoded on the Teachers page signs in as a Teacher right away (read-only:
        // their own schedule and profile). Every other sign-up waits for the Admin.
        $teacher = config('school.auto_activate_teachers') ? $this->matchingTeacher($user) : null;
        if ($teacher) {
            DB::transaction(function () use ($user, $teacher) {
                $user->update(['status' => 'active']);
                $user->syncRoles(['teacher']);
                DB::table('teachers')->where('id', $teacher->id)->update(['user_id' => $user->id]);
                $this->audit->log($user, 'auto_activate', 'users', $user->id, null, ['role' => 'teacher', 'teacher_id' => $teacher->id]);
            });
        }

        return $user->fresh();
    }

    /**
     * The account of someone who chose "Continue with Google", made on the first visit like a
     * sign-up. Returns the reason for the sign-in page instead when they cannot come in yet.
     */
    public function fromGoogle(\Laravel\Socialite\Contracts\User $google): User|string
    {
        $raw = method_exists($google, 'getRaw') ? (array) $google->getRaw() : [];
        $email = mb_strtolower(trim((string) $google->getEmail()));

        if (! str_ends_with($email, '@deped.gov.ph')) {
            return 'not_deped';
        }
        if (array_key_exists('email_verified', $raw) && ! filter_var($raw['email_verified'], FILTER_VALIDATE_BOOL)) {
            return 'not_verified';
        }

        $user = User::whereRaw('LOWER(email) = ?', [$email])->first();

        if (! $user) {
            [$first, $last] = $this->googleName($google, $raw, $email);
            // A long random password they never see: they come in with Google, or set one with "Forgot password".
            $user = User::create([
                'first_name' => $first,
                'last_name' => $last,
                'email' => $email,
                'password' => Str::password(40),
                'status' => 'pending',
            ]);
            $this->audit->log($user, 'google_sign_up', 'users', $user->id);

            $teacher = config('school.auto_activate_teachers') ? $this->matchingTeacher($user) : null;
            if ($teacher) {
                DB::transaction(function () use ($user, $teacher) {
                    $user->update(['status' => 'active']);
                    $user->syncRoles(['teacher']);
                    DB::table('teachers')->where('id', $teacher->id)->update(['user_id' => $user->id]);
                    $this->audit->log($user, 'auto_activate', 'users', $user->id, null, ['role' => 'teacher', 'teacher_id' => $teacher->id]);
                });
            }
            $user = $user->fresh();
        }

        return match ($user->status) {
            'active' => $user,
            'pending' => 'pending',
            default => 'inactive',
        };
    }

    /**
     * First and last name from Google, or from the email (juan.delacruz becomes Juan Delacruz).
     *
     * @param  array<string, mixed>  $raw
     * @return array{0: string, 1: string}
     */
    private function googleName(\Laravel\Socialite\Contracts\User $google, array $raw, string $email): array
    {
        $first = trim((string) ($raw['given_name'] ?? ''));
        $last = trim((string) ($raw['family_name'] ?? ''));

        if ($first === '' || $last === '') {
            $parts = preg_split('/\s+/', trim((string) $google->getName())) ?: [];
            if (count($parts) >= 2) {
                $last = $last ?: array_pop($parts);
                $first = $first ?: implode(' ', $parts);
            }
        }
        if ($first === '' || $last === '') {
            $local = explode('.', strstr($email, '@', true) ?: $email);
            $first = $first ?: ucfirst($local[0] ?? 'DepEd');
            $last = $last ?: ucfirst($local[count($local) - 1] ?? 'User');
        }

        return [mb_substr($first, 0, 60), mb_substr($last, 0, 60)];
    }

    /**
     * The one personnel record with the same first and last name, teaching and not yet linked to an
     * account. Two records with the same name match neither, so the Admin decides.
     */
    public function matchingTeacher(User $user): ?object
    {
        $matches = DB::table('teachers')
            ->whereNull('user_id')
            ->where('personnel_type', 'teaching')
            ->whereRaw('LOWER(TRIM(first_name)) = ?', [mb_strtolower(trim((string) $user->first_name))])
            ->whereRaw('LOWER(TRIM(last_name)) = ?', [mb_strtolower(trim((string) $user->last_name))])
            ->limit(2)
            ->get(['id', 'first_name', 'last_name']);

        return $matches->count() === 1 ? $matches->first() : null;
    }

    /**
     * Activates many sign-ups at once as Teachers, each linked to their personnel record when one
     * matches their name. Accounts that are no longer waiting are skipped.
     *
     * @param  array<int, int>  $userIds
     * @return array{activated: int, linked: int}
     */
    public function activateTeachers(array $userIds, User $admin): array
    {
        $result = ['activated' => 0, 'linked' => 0];

        foreach (User::whereIn('id', $userIds)->where('status', 'pending')->whereKeyNot($admin->id)->get() as $user) {
            $teacher = $this->matchingTeacher($user);
            $this->activate($user, $admin, ['role' => 'teacher', 'grade_level_ids' => [], 'teacher_id' => $teacher?->id]);
            $result['activated']++;
            $result['linked'] += $teacher ? 1 : 0;
        }

        return $result;
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
            // A password they chose themselves: no temporary password is left to change.
            $user->forceFill(['password' => $password, 'remember_token' => Str::random(60), 'must_change_password' => false])->save();

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
    /**
     * The Admin's way back in for someone whose reset email did not arrive: a temporary password,
     * shown once to the Admin, that must be changed on the next sign-in. Every session of the
     * account is signed out.
     */
    public function adminResetPassword(User $user, User $admin): string
    {
        $temporary = 'ERC-'.Str::upper(Str::random(4)).'-'.random_int(1000, 9999);

        DB::transaction(function () use ($user, $admin, $temporary) {
            $user->forceFill(['password' => $temporary, 'must_change_password' => true, 'remember_token' => Str::random(60)])->save();
            DB::table('sessions')->where('user_id', $user->id)->delete();
            $this->audit->log($admin, 'reset_password', 'users', $user->id, null, ['must_change_password' => true]);
        });

        return $temporary;
    }

    /** The user's own new password, which also ends a required change. */
    public function changePassword(User $user, string $password): void
    {
        $user->forceFill(['password' => $password, 'must_change_password' => false])->save();
        $this->audit->log($user, 'change_password', 'users', $user->id);
    }

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
     * Switches an account on or off. Its role and scope stay, so reactivating restores it
     * as it was. Someone deactivated is signed out of every device right away.
     */
    public function changeStatus(User $user, User $admin, string $status): void
    {
        DB::transaction(function () use ($user, $admin, $status) {
            $before = $user->status;
            $user->update(['status' => $status]);

            if ($status === 'inactive') {
                DB::table('sessions')->where('user_id', $user->id)->delete();
            }

            $this->audit->log(
                $admin,
                $status === 'inactive' ? 'deactivate' : 'reactivate',
                'users',
                $user->id,
                ['status' => $before],
                ['status' => $status],
            );
        });
    }

    /**
     * Removes an account for good: a sign-up the Admin does not recognize, or an account made
     * by mistake. The personnel record stays, without a login. An account with work in the
     * system cannot be removed, because the schedules and approvals must keep their history.
     */
    public function delete(User $user, User $admin): void
    {
        $reason = $this->whyCannotDelete($user);
        if ($reason !== null) {
            throw ValidationException::withMessages(['user' => $reason]);
        }

        DB::transaction(function () use ($user, $admin) {
            $before = ['email' => $user->email, 'status' => $user->status, 'role' => $user->getRoleNames()->first()];

            DB::table('teachers')->where('user_id', $user->id)->update(['user_id' => null]);
            DB::table('sessions')->where('user_id', $user->id)->delete();
            DB::table('password_reset_tokens')->where('email', $user->email)->delete();
            $user->delete();

            $this->audit->log($admin, $before['status'] === 'pending' ? 'decline' : 'delete', 'users', $user->id, $before);
        });
    }

    /**
     * Why an account must stay, in words for the Admin, or null if it can be deleted.
     */
    public function whyCannotDelete(User $user): ?string
    {
        $hasWork = DB::table('schedule_entries')->where('created_by', $user->id)->exists()
            || DB::table('schedule_reviews')->where('reviewed_by', $user->id)->exists()
            || DB::table('schedule_flag_acknowledgements')->where('acknowledged_by', $user->id)->exists();

        return $hasWork
            ? 'This account has already worked on schedules, and that history must stay. Deactivate it instead.'
            : null;
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
