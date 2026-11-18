<?php

use App\Mail\LoginCodeMail;
use App\Models\User;
use App\Services\LoginCodeService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    $this->withHeader('Referer', 'http://localhost:5173');
    Role::findOrCreate('teacher', 'web');
    config(['school.login_code' => 'true']);
    Mail::fake();
    $this->user = User::factory()->create(['password' => 'Password123!', 'email' => 'ana.reyes@deped.gov.ph'])->assignRole('teacher');
});

/** Signs in with the password, and returns the code the email carried. */
function passwordStep(object $test): string
{
    $test->postJson('/api/login', ['email' => 'ana.reyes@deped.gov.ph', 'password' => 'Password123!'])
        ->assertStatus(202)
        ->assertJsonPath('code_required', true)
        ->assertJsonPath('sent_to', 'an***@deped.gov.ph');

    $code = null;
    Mail::assertSent(LoginCodeMail::class, function (LoginCodeMail $mail) use (&$code) {
        $code = $mail->code;

        return $mail->hasTo('ana.reyes@deped.gov.ph');
    });

    return $code;
}

it('asks for the emailed code after the password, and signs in only with it', function () {
    $code = passwordStep($this);

    // Not signed in yet: the password alone is not enough.
    $this->assertGuest('web');
    $this->getJson('/api/me')->assertJsonPath('data', null);

    $this->postJson('/api/login/code', ['code' => $code])->assertOk()->assertJsonPath('data.email', 'ana.reyes@deped.gov.ph');
    $this->assertAuthenticatedAs($this->user, 'web');
    expect(DB::table('login_codes')->count())->toBe(0)
        ->and(DB::table('audit_logs')->where('action', 'login_code')->count())->toBe(1);
});

it('counts wrong codes down and ends the code after 5', function () {
    $code = passwordStep($this);
    $wrong = $code === '000000' ? '111111' : '000000';

    $this->postJson('/api/login/code', ['code' => $wrong])->assertUnprocessable()->assertJsonValidationErrors(['code' => '4 tries left']);
    foreach (range(1, 4) as $try) {
        $this->postJson('/api/login/code', ['code' => $wrong])->assertUnprocessable();
    }

    $this->postJson('/api/login/code', ['code' => $code])->assertUnprocessable()->assertJsonValidationErrors(['code' => 'Too many wrong codes']);
    $this->assertGuest('web');
});

it('refuses an expired code', function () {
    $code = passwordStep($this);
    DB::table('login_codes')->update(['expires_at' => DB::raw("now() - interval '1 minute'")]);

    $this->postJson('/api/login/code', ['code' => $code])->assertUnprocessable()->assertJsonValidationErrors(['code' => 'expired']);
});

it('needs the password step first', function () {
    $this->postJson('/api/login/code', ['code' => '123456'])->assertUnprocessable()->assertJsonValidationErrors(['code' => 'sign in again']);
});

it('sends a new code at most once a minute, and only the newest works', function () {
    $first = passwordStep($this);

    $this->postJson('/api/login/code/resend')->assertOk()->assertJsonPath('code_required', true);
    $this->postJson('/api/login/code/resend')->assertStatus(429);

    $codes = [];
    Mail::assertSent(LoginCodeMail::class, function (LoginCodeMail $mail) use (&$codes) {
        $codes[] = $mail->code;

        return true;
    });
    $newest = end($codes);

    if ($first !== $newest) {
        $this->postJson('/api/login/code', ['code' => $first])->assertUnprocessable();
    }
    $this->postJson('/api/login/code', ['code' => $newest])->assertOk();
});

it('remembers this device for 30 days when asked, and then skips the code', function () {
    $code = passwordStep($this);

    $response = $this->postJson('/api/login/code', ['code' => $code, 'remember_device' => true])->assertOk();
    $cookie = collect($response->headers->getCookies())->first(fn ($item) => $item->getName() === LoginCodeService::COOKIE);
    expect($cookie)->not->toBeNull()
        ->and($cookie->isHttpOnly())->toBeTrue()
        ->and(DB::table('trusted_devices')->where('user_id', $this->user->id)->count())->toBe(1);

    // The browser keeps the encrypted cookie; the test sends back its plain value, which Laravel encrypts again.
    $token = \Illuminate\Cookie\CookieValuePrefix::remove(decrypt($cookie->getValue(), false));
    $this->postJson('/api/logout');
    $this->flushSession();
    $this->app['auth']->forgetGuards();

    // The same browser: no code this time.
    $this->withCredentials()->withCookie(LoginCodeService::COOKIE, $token)
        ->postJson('/api/login', ['email' => 'ana.reyes@deped.gov.ph', 'password' => 'Password123!'])
        ->assertOk()
        ->assertJsonPath('data.email', 'ana.reyes@deped.gov.ph');
});

it('stays off while emails are not really sent, so no one is locked out', function () {
    config(['school.login_code' => 'auto', 'mail.default' => 'log']);

    $this->postJson('/api/login', ['email' => 'ana.reyes@deped.gov.ph', 'password' => 'Password123!'])
        ->assertOk()
        ->assertJsonPath('data.email', 'ana.reyes@deped.gov.ph');
    Mail::assertNothingSent();
});

it('says so when the code cannot be sent', function () {
    Mail::shouldReceive('to')->andThrow(new RuntimeException('SMTP down'));

    $this->postJson('/api/login', ['email' => 'ana.reyes@deped.gov.ph', 'password' => 'Password123!'])
        ->assertStatus(503)
        ->assertJsonPath('message', fn (string $message) => str_contains($message, 'could not be sent'));
    $this->assertGuest('web');
});

describe('forgetting remembered devices', function () {
    beforeEach(function () {
        $this->remember = fn () => app(LoginCodeService::class)->trustDevice($this->user);
        $this->remember->__invoke();
    });

    it('when the user changes their password', function () {
        app(\App\Services\AccountService::class)->changePassword($this->user, 'NewPass123!');

        expect(DB::table('trusted_devices')->where('user_id', $this->user->id)->count())->toBe(0);
    });

    it('when the Admin gives a temporary password', function () {
        $admin = User::factory()->create();
        app(\App\Services\AccountService::class)->adminResetPassword($this->user, $admin);

        expect(DB::table('trusted_devices')->where('user_id', $this->user->id)->count())->toBe(0);
    });

    it('when the password is reset by email', function () {
        $token = Illuminate\Support\Facades\Password::broker()->createToken($this->user);
        $this->postJson('/api/reset-password', ['token' => $token, 'email' => $this->user->email, 'password' => 'NewPass123!', 'password_confirmation' => 'NewPass123!'])->assertOk();

        expect(DB::table('trusted_devices')->where('user_id', $this->user->id)->count())->toBe(0);
    });

    it('when the account is deactivated, but not when it is reactivated', function () {
        $admin = User::factory()->create();
        $accounts = app(\App\Services\AccountService::class);

        $accounts->changeStatus($this->user, $admin, 'inactive');
        expect(DB::table('trusted_devices')->where('user_id', $this->user->id)->count())->toBe(0);

        $this->remember->__invoke();
        $accounts->changeStatus($this->user, $admin, 'active');
        expect(DB::table('trusted_devices')->where('user_id', $this->user->id)->count())->toBe(1);
    });
});
