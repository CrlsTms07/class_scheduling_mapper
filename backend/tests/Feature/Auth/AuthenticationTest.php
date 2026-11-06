<?php

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    // The React app's address: this is what makes Sanctum use session cookies.
    $this->withHeader('Referer', 'http://localhost:5173');

    Role::findOrCreate('teacher', 'web');
});

function teacherAccount(array $attributes = []): User
{
    return User::factory()
        ->create(['password' => 'Password123!', ...$attributes])
        ->assignRole('teacher');
}

it('signs in an active user and returns their role', function () {
    $user = teacherAccount();

    $this->postJson('/api/login', ['email' => $user->email, 'password' => 'Password123!'])
        ->assertOk()
        ->assertJsonPath('data.email', $user->email)
        ->assertJsonPath('data.role', 'teacher')
        ->assertJsonMissingPath('data.password');

    $this->assertAuthenticatedAs($user, 'web');
});

it('accepts an email typed with capital letters', function () {
    $user = teacherAccount(['email' => 'juan.cruz@deped.gov.ph']);

    $this->postJson('/api/login', ['email' => 'Juan.Cruz@DepEd.gov.ph', 'password' => 'Password123!'])
        ->assertOk();

    $this->assertAuthenticatedAs($user, 'web');
});

it('rejects a wrong password', function () {
    $user = teacherAccount();

    $this->postJson('/api/login', ['email' => $user->email, 'password' => 'Wrong-password1'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('email');

    $this->assertGuest('web');
});

it('rejects an email that is not an official DepEd email', function () {
    $this->postJson('/api/login', ['email' => 'someone@gmail.com', 'password' => 'Password123!'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('email');
});

it('does not sign in a pending account, and says why', function () {
    $user = User::factory()->pending()->create(['password' => 'Password123!']);

    $this->postJson('/api/login', ['email' => $user->email, 'password' => 'Password123!'])
        ->assertForbidden()
        ->assertJsonPath('code', 'account_pending');

    $this->assertGuest('web');
});

it('does not reveal a pending account to someone with the wrong password', function () {
    $user = User::factory()->pending()->create(['password' => 'Password123!']);

    $this->postJson('/api/login', ['email' => $user->email, 'password' => 'Wrong-password1'])
        ->assertUnprocessable();
});

it('does not sign in an inactive account', function () {
    $user = teacherAccount(['status' => 'inactive']);

    $this->postJson('/api/login', ['email' => $user->email, 'password' => 'Password123!'])
        ->assertForbidden()
        ->assertJsonPath('code', 'account_not_active');

    $this->assertGuest('web');
});

it('limits repeated login attempts', function () {
    foreach (range(1, 5) as $attempt) {
        $this->postJson('/api/login', ['email' => 'nobody@deped.gov.ph', 'password' => 'Wrong-password1'])
            ->assertUnprocessable();
    }

    $this->postJson('/api/login', ['email' => 'nobody@deped.gov.ph', 'password' => 'Wrong-password1'])
        ->assertTooManyRequests();
});

it('refuses /me without a session', function () {
    $this->getJson('/api/me')->assertUnauthorized();
});

it('returns the signed-in user from /me with their grade-level scope', function () {
    $gradeId = DB::table('grade_levels')->insertGetId(['grade' => 7, 'level' => 'JHS']);
    $user = teacherAccount();
    $user->gradeLevels()->attach($gradeId);

    $this->actingAs($user)->getJson('/api/me')
        ->assertOk()
        ->assertJsonPath('data.grade_levels.0.grade', 7);
});

it('ends access as soon as an account is deactivated', function () {
    $user = teacherAccount();

    $this->actingAs($user)->getJson('/api/me')->assertOk();

    $user->update(['status' => 'inactive']);

    $this->getJson('/api/me')
        ->assertForbidden()
        ->assertJsonPath('code', 'account_not_active');
});

it('signs out', function () {
    $user = teacherAccount();

    $this->postJson('/api/login', ['email' => $user->email, 'password' => 'Password123!'])->assertOk();
    $this->postJson('/api/logout')->assertOk();

    $this->assertGuest('web');
});

it('ignores bearer tokens because the system uses session cookies', function () {
    $this->withToken('1|anything')->getJson('/api/me')->assertUnauthorized();
});
