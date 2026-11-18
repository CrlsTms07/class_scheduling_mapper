<?php

use App\Models\User;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Support\Facades\DB;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as GoogleUser;

beforeEach(function () {
    $this->seed(ReferenceDataSeeder::class);
    config([
        'services.google.client_id' => 'test-client',
        'services.google.client_secret' => 'test-secret',
        'app.frontend_url' => 'http://localhost:5173',
    ]);
});

/** Google answers the callback with this person. */
function googleReturns(string $email, array $raw = []): void
{
    $user = (new GoogleUser)
        ->setRaw(['email_verified' => true, 'given_name' => 'Ana', 'family_name' => 'Reyes', ...$raw])
        ->map(['id' => '123', 'email' => $email, 'name' => 'Ana Reyes']);

    Socialite::shouldReceive('driver->user')->andReturn($user);
}

it('tells the sign-in page whether Google is set up', function () {
    $this->getJson('/api/auth/providers')->assertJsonPath('data.google', true);

    config(['services.google.client_id' => null]);
    $this->getJson('/api/auth/providers')->assertJsonPath('data.google', false);
    $this->get('/auth/google/redirect')->assertRedirect('http://localhost:5173/login?google=unavailable');
});

it('sends the user to Google, offering DepEd accounts', function () {
    $location = $this->get('/auth/google/redirect')->assertRedirect()->headers->get('Location');

    expect($location)->toStartWith('https://accounts.google.com/')
        ->toContain('hd=deped.gov.ph')
        ->toContain('client_id=test-client');
});

it('signs in an active account and opens the dashboard', function () {
    $user = User::factory()->create(['email' => 'ana.reyes@deped.gov.ph'])->assignRole('teacher');
    googleReturns('Ana.Reyes@deped.gov.ph');

    $this->get('/auth/google/callback?code=x&state=y')->assertRedirect('http://localhost:5173/dashboard');

    $this->assertAuthenticatedAs($user, 'web');
});

it('makes a waiting account on the first visit, like a sign-up', function () {
    googleReturns('ana.reyes@deped.gov.ph');

    $this->get('/auth/google/callback?code=x')->assertRedirect('http://localhost:5173/login?google=pending');

    $user = User::where('email', 'ana.reyes@deped.gov.ph')->first();
    expect($user->status)->toBe('pending')
        ->and($user->first_name)->toBe('Ana')
        ->and($user->last_name)->toBe('Reyes')
        ->and($user->terms_accepted_at)->toBeNull();
    $this->assertGuest('web');
});

it('lets a teacher on the teachers list in right away', function () {
    $teacherId = DB::table('teachers')->insertGetId(['first_name' => 'Ana', 'last_name' => 'Reyes', 'personnel_type' => 'teaching']);
    googleReturns('ana.reyes@deped.gov.ph');

    $this->get('/auth/google/callback?code=x')->assertRedirect('http://localhost:5173/dashboard');

    $user = User::where('email', 'ana.reyes@deped.gov.ph')->first();
    expect($user->hasRole('teacher'))->toBeTrue()
        ->and(DB::table('teachers')->where('id', $teacherId)->value('user_id'))->toBe($user->id);
});

it('turns away other accounts and says why', function (string $email, array $raw, string $reason) {
    googleReturns($email, $raw);

    $this->get('/auth/google/callback?code=x')->assertRedirect("http://localhost:5173/login?google={$reason}");

    expect(User::where('email', $email)->exists())->toBeFalse();
    $this->assertGuest('web');
})->with([
    'personal Gmail' => ['ana@gmail.com', [], 'not_deped'],
    'email not verified' => ['ana.reyes@deped.gov.ph', ['email_verified' => false], 'not_verified'],
]);

it('keeps a deactivated account out', function () {
    User::factory()->create(['email' => 'ana.reyes@deped.gov.ph', 'status' => 'inactive'])->assignRole('teacher');
    googleReturns('ana.reyes@deped.gov.ph');

    $this->get('/auth/google/callback?code=x')->assertRedirect('http://localhost:5173/login?google=inactive');
    $this->assertGuest('web');
});

it('goes back to the sign-in page when the user cancels or Google fails', function () {
    $this->get('/auth/google/callback?error=access_denied')->assertRedirect('http://localhost:5173/login?google=cancelled');

    Socialite::shouldReceive('driver->user')->andThrow(new RuntimeException('bad state'));
    $this->get('/auth/google/callback?code=x')->assertRedirect('http://localhost:5173/login?google=failed');
});
