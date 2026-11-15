<?php

use App\Mail\GmailApiTransport;
use App\Models\User;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Symfony\Component\Mime\Email;

beforeEach(function () {
    $this->seed(ReferenceDataSeeder::class);
});

it('writes the reset email with the school, one button and how long the link lasts', function () {
    $user = User::factory()->create(['first_name' => 'Ana', 'email' => 'ana.reyes@deped.gov.ph']);

    $mail = (new ResetPassword('token123'))->toMail($user);
    $html = (string) view($mail->view['html'], $mail->viewData);
    $text = (string) view($mail->view['text'], $mail->viewData);

    expect($mail->subject)->toContain('Reset your password')
        ->and($html)->toContain('Hello Ana')
        ->and($html)->toContain('Reset password</a>')
        ->and($html)->toContain('valid for <strong>60 minutes</strong>')
        ->and($html)->toContain('reset-password?token=token123')
        ->and($text)->toContain('reset-password?token=token123')
        ->and($text)->toContain('you can ignore this email');
});

it('sends the reset email when someone asks', function () {
    Notification::fake();
    $user = User::factory()->create(['status' => 'active', 'email' => 'ana.reyes@deped.gov.ph']);

    $this->withHeader('Referer', 'http://localhost:5173')->postJson('/api/forgot-password', ['email' => 'ana.reyes@deped.gov.ph'])->assertOk();

    Notification::assertSentTo($user, ResetPassword::class);
});

it('sends through the Gmail API over HTTPS, with a fresh access token', function () {
    Cache::flush();
    Http::fake([
        'oauth2.googleapis.com/token' => Http::response(['access_token' => 'ya29.test', 'expires_in' => 3599]),
        'gmail.googleapis.com/*' => Http::response(['id' => 'msg1']),
    ]);

    $transport = new GmailApiTransport('client', 'secret', 'refresh');
    $transport->send((new Email)->from('school@gmail.com')->to('ana.reyes@deped.gov.ph')->subject('Hello')->text('Body'));

    Http::assertSent(fn ($request) => str_contains($request->url(), 'oauth2.googleapis.com/token') && $request['refresh_token'] === 'refresh');
    Http::assertSent(function ($request) {
        if (! str_contains($request->url(), 'gmail.googleapis.com')) {
            return false;
        }
        $raw = base64_decode(strtr($request['raw'], '-_', '+/'));

        return $request->hasHeader('Authorization', 'Bearer ya29.test') && str_contains($raw, 'Subject: Hello') && str_contains($raw, 'ana.reyes@deped.gov.ph');
    });
});

it('says clearly when Gmail refuses the sign-in', function () {
    Cache::flush();
    Http::fake(['oauth2.googleapis.com/token' => Http::response(['error' => 'invalid_grant', 'error_description' => 'Token has been expired or revoked.'], 400)]);

    $transport = new GmailApiTransport('client', 'secret', 'old');

    expect(fn () => $transport->send((new Email)->from('a@gmail.com')->to('b@gmail.com')->subject('x')->text('y')))
        ->toThrow(Symfony\Component\Mailer\Exception\TransportException::class, 'Token has been expired or revoked');
});

it('checks the mail settings with a test email', function () {
    Mail::fake();
    config(['mail.default' => 'array']);

    $this->artisan('mail:test', ['email' => 'ana.reyes@deped.gov.ph'])
        ->expectsOutputToContain('Sent to ana.reyes@deped.gov.ph')
        ->assertSuccessful();
});

describe('the gmail mailer', function () {
    beforeEach(function () {
        Cache::flush();
        config([
            'mail.default' => 'gmail',
            'mail.from.address' => 'ercihs.scheduling@gmail.com',
            'services.gmail' => ['client_id' => 'client', 'client_secret' => 'secret', 'refresh_token' => 'refresh'],
        ]);
        Http::fake([
            'oauth2.googleapis.com/token' => Http::response(['access_token' => 'ya29.test', 'expires_in' => 3599]),
            'gmail.googleapis.com/*' => Http::response(['id' => 'msg1']),
        ]);
    });

    /** The raw RFC 2822 message Gmail received, decoded from base64url. */
    function gmailRaw(): ?string
    {
        $raw = null;
        Http::assertSent(function ($request) use (&$raw) {
            if (! str_contains($request->url(), 'gmail/v1/users/me/messages/send')) {
                return false;
            }
            $raw = base64_decode(strtr($request['raw'], '-_', '+/'));

            return $request->hasHeader('Authorization', 'Bearer ya29.test');
        });

        return $raw;
    }

    it('is the Gmail API transport, under both names', function () {
        expect(Mail::mailer('gmail')->getSymfonyTransport())->toBeInstanceOf(GmailApiTransport::class)
            ->and(Mail::mailer('gmail-api')->getSymfonyTransport())->toBeInstanceOf(GmailApiTransport::class);
    });

    it('queues the reset-password notification for the right person (faked)', function () {
        Notification::fake();
        $user = User::factory()->create(['status' => 'active', 'email' => 'ana.reyes@deped.gov.ph']);

        $this->withHeader('Referer', 'http://localhost:5173')->postJson('/api/forgot-password', ['email' => 'ana.reyes@deped.gov.ph'])->assertOk();

        // A notification, not a Mailable: Notification::fake is what catches it (Mail::fake does not).
        Notification::assertSentTo($user, ResetPassword::class, fn (ResetPassword $notification, array $channels) => $channels === ['mail']);
        Http::assertNothingSent();
    });

    it('really sends the Forgot Password email through users.messages.send', function () {
        User::factory()->create(['status' => 'active', 'email' => 'ana.reyes@deped.gov.ph']);

        $this->withHeader('Referer', 'http://localhost:5173')->postJson('/api/forgot-password', ['email' => 'ana.reyes@deped.gov.ph'])->assertOk();

        $raw = gmailRaw();
        expect($raw)->toContain('To: ana.reyes@deped.gov.ph')
            ->toContain('From: ')
            ->toContain('ercihs.scheduling@gmail.com')
            ->toContain('Subject: Reset your password')
            ->toContain('reset-password?token=');
    });

    it('sends a real test email with mail:test', function () {
        $this->artisan('mail:test', ['email' => 'ana.reyes@deped.gov.ph'])
            ->expectsOutputToContain('Sent to ana.reyes@deped.gov.ph with the gmail mailer')
            ->assertSuccessful();

        expect(gmailRaw())->toContain('Subject: ERCIHS Scheduling System: test email');
    });

    it('keeps the old command name working', function () {
        $this->artisan('app:test-mail', ['email' => 'ana.reyes@deped.gov.ph'])->assertSuccessful();
    });

    it('says clearly when the test email cannot be sent', function () {
        // A fresh fake: Gmail refuses the refresh token.
        Http::swap(new \Illuminate\Http\Client\Factory);
        Http::fake(['oauth2.googleapis.com/token' => Http::response(['error' => 'invalid_grant'], 400)]);
        Cache::flush();

        $this->artisan('mail:test', ['email' => 'ana.reyes@deped.gov.ph'])
            ->expectsOutputToContain('The email was not sent (gmail)')
            ->assertFailed();
    });
});
