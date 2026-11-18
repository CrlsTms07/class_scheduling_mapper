<?php

use App\Http\Controllers\GoogleAuthController;
use App\Http\Controllers\SpaController;
use Illuminate\Support\Facades\Route;

// "Continue with Google": Google sends the user back by a page visit, so these need the session.
Route::middleware('throttle:account')->group(function () {
    Route::get('/auth/google/redirect', [GoogleAuthController::class, 'redirect']);
    Route::get('/auth/google/callback', [GoogleAuthController::class, 'callback']);
});

// The web app's router handles the page addresses. Anything for the API keeps its own errors.
Route::get('/{path?}', SpaController::class)->where('path', '^(?!api(/|$)|sanctum(/|$)|auth/google(/|$)|up$).*$');
