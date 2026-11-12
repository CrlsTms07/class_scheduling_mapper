<?php

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    $this->withHeader('Referer', 'http://localhost:5173');
    Role::findOrCreate('teacher', 'web');
});

it('sends the browser safety headers on API answers', function () {
    $this->getJson('/api/active-term')
        ->assertHeader('X-Content-Type-Options', 'nosniff')
        ->assertHeader('X-Frame-Options', 'SAMEORIGIN')
        ->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
});

it('limits guesses on one account even from many addresses', function () {
    foreach (range(1, 20) as $attempt) {
        $this->withServerVariables(['REMOTE_ADDR' => "10.0.0.{$attempt}"])
            ->postJson('/api/login', ['email' => 'target@deped.gov.ph', 'password' => 'Wrong-password1'])
            ->assertUnprocessable();
    }

    $this->withServerVariables(['REMOTE_ADDR' => '10.0.1.1'])
        ->postJson('/api/login', ['email' => 'target@deped.gov.ph', 'password' => 'Wrong-password1'])
        ->assertTooManyRequests();
});

it('limits attempts to change the password from an open session', function () {
    $this->actingAs(User::factory()->create(['password' => 'Password123!'])->assignRole('teacher'));

    foreach (range(1, 10) as $attempt) {
        $this->putJson('/api/me/password', ['current_password' => 'Wrong-pass1!', 'password' => 'NewPass123!', 'password_confirmation' => 'NewPass123!'])
            ->assertUnprocessable();
    }

    $this->putJson('/api/me/password', ['current_password' => 'Wrong-pass1!', 'password' => 'NewPass123!', 'password_confirmation' => 'NewPass123!'])
        ->assertTooManyRequests();
});

it('no longer asks for a new password after the email reset', function () {
    $user = User::factory()->create(['must_change_password' => true])->assignRole('teacher');
    $token = Password::broker()->createToken($user);

    $this->postJson('/api/reset-password', [
        'token' => $token, 'email' => $user->email, 'password' => 'NewPass123!', 'password_confirmation' => 'NewPass123!',
    ])->assertOk();

    expect($user->fresh()->must_change_password)->toBeFalse()
        ->and(DB::table('password_reset_tokens')->where('email', $user->email)->exists())->toBeFalse();
});

it('makes reset links that expire after an hour', function () {
    expect(config('auth.passwords.users.expire'))->toBe(60);
});

it('sends reset links only to official DepEd emails', function () {
    $this->postJson('/api/forgot-password', ['email' => 'someone@gmail.com'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['email' => 'DepEd']);
    $this->postJson('/api/reset-password', ['token' => 'x', 'email' => 'someone@gmail.com', 'password' => 'NewPass123!', 'password_confirmation' => 'NewPass123!'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['email' => 'DepEd']);
    $this->postJson('/api/forgot-password', ['email' => 'juan.delacruz@deped.gov.ph'])->assertOk();
});
