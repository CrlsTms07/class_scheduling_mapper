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
        'accept_terms' => true,
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

it('needs the Terms and Conditions accepted, and keeps when they were', function () {
    $this->postJson('/api/register', signUpData(['accept_terms' => false]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['accept_terms' => 'Please read and accept the Terms and Conditions.']);

    $this->postJson('/api/register', signUpData())->assertCreated();

    expect(\App\Models\User::where('email', 'juan.delacruz@deped.gov.ph')->value('terms_accepted_at'))->not->toBeNull();
});

it('asks an older account to accept the Terms and Conditions once, on sign-in', function () {
    $this->withHeader('Referer', 'http://localhost:5173');
    $this->seed(\Database\Seeders\ReferenceDataSeeder::class);
    $user = \App\Models\User::factory()->create(['status' => 'active'])->assignRole('teacher');
    $this->actingAs($user);

    $this->getJson('/api/me')->assertOk()->assertJsonPath('data.terms_accepted_at', null);
    $this->postJson('/api/me/accept-terms', ['accept_terms' => false])->assertUnprocessable();

    $this->postJson('/api/me/accept-terms', ['accept_terms' => true])->assertOk();
    expect($user->fresh()->terms_accepted_at)->not->toBeNull();
    $this->getJson('/api/me')->assertJsonPath('data.terms_accepted_at', fn ($value) => $value !== null);
});
