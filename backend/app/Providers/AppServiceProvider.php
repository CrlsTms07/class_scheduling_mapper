<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
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
        // Same password policy as the front-end form (frontend/src/types/FieldSchema.ts).
        Password::defaults(fn () => Password::min(8)->max(64)->mixedCase()->numbers()->symbols());

        // Slows down password guessing against one account from one device.
        RateLimiter::for('login', fn (Request $request) => Limit::perMinute(5)
            ->by(strtolower((string) $request->input('email')).'|'.$request->ip()));

        RateLimiter::for('account', fn (Request $request) => Limit::perMinute(10)->by($request->ip()));

        // The reset link in the email opens the React page, not a Laravel page.
        ResetPassword::createUrlUsing(fn (User $user, string $token) => config('app.frontend_url')
            .'/reset-password?token='.$token.'&email='.urlencode($user->email));

        // The system signs in with session cookies only. API tokens are not used.
        Sanctum::getAccessTokenFromRequestUsing(fn () => null);
    }
}
