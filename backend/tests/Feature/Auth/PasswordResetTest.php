<?php

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;

beforeEach(function () {
    $this->withHeader('Referer', 'http://localhost:5173');
});

it('emails a link that opens the React reset page', function () {
    Notification::fake();
    $user = User::factory()->create();

    $this->postJson('/api/forgot-password', ['email' => $user->email])->assertOk();

    Notification::assertSentTo($user, ResetPassword::class, function (ResetPassword $notification) use ($user) {
        $url = $notification->toMail($user)->actionUrl;

        return str_starts_with($url, 'http://localhost:5173/reset-password?token=')
            && str_contains($url, urlencode($user->email));
    });
});

it('gives the same reply for an email that does not exist', function () {
    Notification::fake();
    $user = User::factory()->create();

    $known = $this->postJson('/api/forgot-password', ['email' => $user->email]);
    $unknown = $this->postJson('/api/forgot-password', ['email' => 'nobody@deped.gov.ph']);

    $unknown->assertOk();
    expect($unknown->json('message'))->toBe($known->json('message'));
});

it('changes the password with a valid token and signs out other devices', function () {
    $user = User::factory()->create(['password' => 'OldPassword1!']);
    DB::table('sessions')->insert([
        'id' => 'old-device', 'user_id' => $user->id, 'payload' => '', 'last_activity' => time(),
    ]);

    $this->postJson('/api/reset-password', [
        'token' => Password::createToken($user),
        'email' => $user->email,
        'password' => 'NewPassword1!',
        'password_confirmation' => 'NewPassword1!',
    ])->assertOk();

    expect(Auth::guard('web')->validate(['email' => $user->email, 'password' => 'NewPassword1!']))->toBeTrue()
        ->and(DB::table('sessions')->where('id', 'old-device')->exists())->toBeFalse();
});

it('rejects an invalid token', function () {
    $user = User::factory()->create(['password' => 'OldPassword1!']);

    $this->postJson('/api/reset-password', [
        'token' => 'not-a-real-token',
        'email' => $user->email,
        'password' => 'NewPassword1!',
        'password_confirmation' => 'NewPassword1!',
    ])->assertUnprocessable();

    expect(Auth::guard('web')->validate(['email' => $user->email, 'password' => 'OldPassword1!']))->toBeTrue();
});
