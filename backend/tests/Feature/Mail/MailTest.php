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

    $this->artisan('app:test-mail', ['to' => 'ana.reyes@deped.gov.ph'])
        ->expectsOutputToContain('Sent to ana.reyes@deped.gov.ph')
        ->assertSuccessful();
});
