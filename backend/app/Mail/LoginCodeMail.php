<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Support\Facades\DB;

/** The 6-digit sign-in code, in the school's look like the password reset email. */
class LoginCodeMail extends Mailable
{
    use Queueable;

    public function __construct(public User $user, public string $code, public int $minutes) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: "Your sign-in code: {$this->code}");
    }

    public function content(): Content
    {
        $school = DB::table('school_profile')->first();

        return new Content(
            view: 'emails.login-code',
            text: 'emails.login-code-text',
            with: [
                'name' => $this->user->first_name,
                'email' => $this->user->email,
                'code' => $this->code,
                'minutes' => $this->minutes,
                'schoolName' => $school?->school_name ?? config('school.school_name'),
                'address' => $school?->address ?? config('school.address'),
                'logoUrl' => rtrim((string) config('app.frontend_url'), '/').'/ercihs-logo.png',
            ],
        );
    }
}
