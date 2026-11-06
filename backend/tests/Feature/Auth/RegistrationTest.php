<?php

use App\Models\User;

beforeEach(function () {
    $this->withHeader('Referer', 'http://localhost:5173');
});

function signUpData(array $overrides = []): array
{
    return [
        'first_name' => 'Juan',
        'last_name' => 'Dela Cruz',
        'email' => 'juan.delacruz@deped.gov.ph',
        'password' => 'Password123!',
        'password_confirmation' => 'Password123!',
        ...$overrides,
    ];
}

it('creates a pending account with no role and does not sign it in', function () {
    $this->postJson('/api/register', signUpData())->assertCreated();

    $user = User::where('email', 'juan.delacruz@deped.gov.ph')->first();

    expect($user->status)->toBe('pending')
        ->and($user->getRoleNames())->toBeEmpty()
        ->and($user->password)->not->toBe('Password123!');

    $this->assertGuest('web');
});

it('cannot be used to choose your own status', function () {
    $this->postJson('/api/register', signUpData(['status' => 'active', 'role' => 'super_admin']))->assertCreated();

    $user = User::where('email', 'juan.delacruz@deped.gov.ph')->first();

    expect($user->status)->toBe('pending')
        ->and($user->getRoleNames())->toBeEmpty();
});

it('rejects an email that is not an official DepEd email', function () {
    $this->postJson('/api/register', signUpData(['email' => 'juan@gmail.com']))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('email');
});

it('rejects an email that already has an account', function () {
    User::factory()->create(['email' => 'juan.delacruz@deped.gov.ph']);

    $this->postJson('/api/register', signUpData(['email' => 'Juan.DelaCruz@deped.gov.ph']))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('email');
});

it('rejects a weak password', function (string $password) {
    $this->postJson('/api/register', signUpData(['password' => $password, 'password_confirmation' => $password]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('password');
})->with(['short' => 'Ab1!', 'no number' => 'Password!!', 'no symbol' => 'Password123', 'no capital' => 'password123!']);

it('rejects a password confirmation that does not match', function () {
    $this->postJson('/api/register', signUpData(['password_confirmation' => 'Different123!']))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('password');
});
