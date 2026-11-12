<?php

namespace App\Providers;

use App\Models\SchoolTerm;
use App\Models\Teacher;
use App\Models\User;
use App\Mail\GmailApiTransport;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Facades\Mail;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;
use Laravel\Sanctum\Sanctum;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Only the Admin sets what the printed forms are made from.
        Gate::define('manage-reports', fn (User $user) => $user->hasRole(User::ROLE_ADMIN));

        Gate::define('view-admin-dashboard', fn (User $user) => $user->hasRole(User::ROLE_ADMIN));
        // The Admin can plot too, so the Admin follows the same steps of making a schedule.
        Gate::define('view-scheduler-dashboard', fn (User $user) => $user->hasAnyRole([User::ROLE_ADMIN, 'glc', 'master_teacher']));

        // Teachers and rooms are reused across school years, so they are not limited by grade level.
        // The Admin needs them too, because sections take their advisers and home rooms from them.
        Gate::define('view-school-records', fn (User $user) => $user->hasAnyRole([User::ROLE_ADMIN, 'glc', 'master_teacher']));
        Gate::define('manage-school-records', fn (User $user) => $user->hasAnyRole([User::ROLE_ADMIN, 'glc', 'master_teacher']));

        // A teacher's program is printed whole, since half a teaching load would mislead.
        // A scheduler can print it if the teacher handles a section in their grade levels.
        Gate::define('view-teacher-program', function (User $user, Teacher $teacher, SchoolTerm $term) {
            if ($user->hasRole(User::ROLE_ADMIN)) {
                return true;
            }

            return $user->hasAnyRole(['glc', 'master_teacher']) && DB::table('section_subjects')
                ->join('sections', 'sections.id', '=', 'section_subjects.section_id')
                ->where('section_subjects.term_id', $term->id)
                ->where('section_subjects.teacher_id', $teacher->id)
                ->whereIn('sections.grade_level_id', $user->gradeLevelIdsInScope())
                ->exists();
        });

        // Same password policy as the front-end form (frontend/src/types/FieldSchema.ts).
        Password::defaults(fn () => Password::min(8)->max(64)->mixedCase()->numbers()->symbols());

        // Slows down password guessing: 5 tries a minute from one device, and 20 every 15 minutes for one
        // account from anywhere, so changing devices or addresses does not help a guesser.
        RateLimiter::for('login', fn (Request $request) => [
            Limit::perMinute(5)->by(strtolower((string) $request->input('email')).'|'.$request->ip()),
            Limit::perMinutes(15, 20)->by('account:'.strtolower((string) $request->input('email'))),
        ]);

        // The public schedule pages are open to everyone, so one device cannot overload them.
        RateLimiter::for('guest', fn (Request $request) => Limit::perMinute(60)->by($request->ip()));

        RateLimiter::for('account', fn (Request $request) => Limit::perMinute(10)->by($request->ip()));

        // The reset link in the email opens the React page, not a Laravel page.
        // Links the system makes (like the reset link) always use HTTPS on the live server.
        if ($this->app->isProduction()) {
            \Illuminate\Support\Facades\URL::forceScheme('https');
        }

        ResetPassword::createUrlUsing(fn (User $user, string $token) => config('app.frontend_url')
            .'/reset-password?token='.$token.'&email='.urlencode($user->email));

        // The reset email: the school's name and logo, one button, how long the link lasts.
        ResetPassword::toMailUsing(function (User $user, string $token) {
            $school = DB::table('school_profile')->first();
            $schoolName = $school?->school_name ?? config('school.school_name');

            return (new MailMessage)
                ->subject("Reset your password · {$schoolName}")
                ->view(['html' => 'emails.reset-password', 'text' => 'emails.reset-password-text'], [
                    'url' => call_user_func(ResetPassword::$createUrlCallback, $user, $token),
                    'name' => $user->first_name,
                    'email' => $user->email,
                    'minutes' => (int) config('auth.passwords.users.expire', 60),
                    'schoolName' => $schoolName,
                    'address' => $school?->address ?? config('school.address'),
                    'logoUrl' => rtrim((string) config('app.frontend_url'), '/').'/ercihs-logo.png',
                ]);
        });

        // The official form's logos, top and bottom, on every printed report.
        \Illuminate\Support\Facades\View::composer(['reports.partials.header', 'reports.partials.footer'], function ($view) {
            $settings = app(\App\Services\ReportSettingsService::class);
            $data = $view->getData();
            $view->with([
                'headerLogos' => $data['headerLogos'] ?? $settings->logoDataUris('header'),
                'footerLogos' => $data['footerLogos'] ?? $settings->logoDataUris('footer'),
            ]);
        });

        // Gmail over HTTPS: the same Gmail account, where the SMTP ports are blocked.
        Mail::extend('gmail-api', fn () => new GmailApiTransport(
            (string) config('services.gmail.client_id'),
            (string) config('services.gmail.client_secret'),
            (string) config('services.gmail.refresh_token'),
        ));

        // The system signs in with session cookies only. API tokens are not used.
        Sanctum::getAccessTokenFromRequestUsing(fn () => null);
    }
}
