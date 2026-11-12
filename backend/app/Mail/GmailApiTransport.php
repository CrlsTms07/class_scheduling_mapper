<?php

namespace App\Mail;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Symfony\Component\Mailer\Exception\TransportException;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\AbstractTransport;

/**
 * Sends mail through the school's Gmail account with the Gmail API, over HTTPS (port 443).
 *
 * Render's free web services block the SMTP ports (25, 465, 587), so Gmail SMTP cannot be used
 * there. The Gmail API sends from the same Gmail address, for free, with a refresh token made once
 * in Google Cloud (see docs/deployment.md, "Email").
 */
class GmailApiTransport extends AbstractTransport
{
    private const TOKEN_URL = 'https://oauth2.googleapis.com/token';

    private const SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

    public function __construct(private string $clientId, private string $clientSecret, private string $refreshToken)
    {
        parent::__construct();
    }

    protected function doSend(SentMessage $message): void
    {
        // The whole message (headers and body) as Gmail expects it: base64url, no padding.
        $raw = rtrim(strtr(base64_encode($message->toString()), '+/', '-_'), '=');

        $response = Http::withToken($this->accessToken())->acceptJson()->post(self::SEND_URL, ['raw' => $raw]);

        if ($response->failed()) {
            throw new TransportException('Gmail did not accept the message: '.$response->json('error.message', $response->body()));
        }
    }

    /** A short-lived access token from the refresh token, kept until a few minutes before it ends. */
    private function accessToken(): string
    {
        return Cache::remember('gmail-api-access-token', now()->addMinutes(50), function () {
            $response = Http::asForm()->post(self::TOKEN_URL, [
                'client_id' => $this->clientId,
                'client_secret' => $this->clientSecret,
                'refresh_token' => $this->refreshToken,
                'grant_type' => 'refresh_token',
            ]);

            if ($response->failed() || ! $response->json('access_token')) {
                throw new TransportException('Gmail sign-in failed: '.$response->json('error_description', $response->json('error', 'no access token')).'. Check GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and GMAIL_REFRESH_TOKEN.');
            }

            return $response->json('access_token');
        });
    }

    public function __toString(): string
    {
        return 'gmail-api';
    }
}
