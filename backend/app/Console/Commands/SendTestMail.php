<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

/**
 * Sends one short email, to check the mail settings (Gmail SMTP or the Gmail API) before relying
 * on them for password resets.
 */
class SendTestMail extends Command
{
    protected $signature = 'app:test-mail {to : The address to send the test email to}';

    protected $description = 'Send a test email with the current mail settings';

    public function handle(): int
    {
        $to = (string) $this->argument('to');
        $mailer = (string) config('mail.default');

        try {
            Mail::raw('This is a test from the ERCIHS Scheduling System. If you can read this, password reset emails will arrive too.', function ($message) use ($to) {
                $message->to($to)->subject('ERCIHS Scheduling System: test email');
            });
        } catch (\Throwable $problem) {
            $this->error("The email was not sent ({$mailer}): {$problem->getMessage()}");

            return self::FAILURE;
        }

        $this->info($mailer === 'log'
            ? "MAIL_MAILER is log, so the email went to the log file, not to {$to}."
            : "Sent to {$to} with the {$mailer} mailer. Check the inbox (and the spam folder).");

        return self::SUCCESS;
    }
}
