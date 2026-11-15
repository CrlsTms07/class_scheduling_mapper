<?php

namespace App\Http\Controllers;

use App\Services\AccountService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Laravel\Socialite\Facades\Socialite;
use Symfony\Component\HttpFoundation\RedirectResponse as SymfonyRedirect;

/**
 * "Continue with Google": the official DepEd account (Google Workspace) signs in or signs up.
 * These are web routes, since Google sends the user back by a plain page visit, which needs the
 * session cookie to sign them in.
 */
class GoogleAuthController extends Controller
{
    public function redirect(): RedirectResponse|SymfonyRedirect
    {
        if (! self::isConfigured()) {
            return $this->backToLogin('unavailable');
        }

        // "hd" makes Google offer DepEd accounts first; the callback still checks the email.
        return Socialite::driver('google')
            ->with(['hd' => 'deped.gov.ph', 'prompt' => 'select_account'])
            ->redirect();
    }

    public function callback(Request $request, AccountService $accounts): RedirectResponse
    {
        if (! self::isConfigured() || $request->has('error')) {
            return $this->backToLogin('cancelled');
        }

        try {
            $google = Socialite::driver('google')->user();
        } catch (\Throwable) {
            return $this->backToLogin('failed');
        }

        $user = $accounts->fromGoogle($google);

        if (is_string($user)) {
            return $this->backToLogin($user);
        }

        Auth::guard('web')->login($user);
        $request->session()->regenerate();

        return redirect()->away(rtrim((string) config('app.frontend_url'), '/').'/dashboard');
    }

    /** Whether the school has set up its Google sign-in (docs/deployment.md, "Google sign-in"). */
    public static function isConfigured(): bool
    {
        return filled(config('services.google.client_id')) && filled(config('services.google.client_secret'));
    }

    private function backToLogin(string $reason): RedirectResponse
    {
        return redirect()->away(rtrim((string) config('app.frontend_url'), '/').'/login?google='.$reason);
    }
}
