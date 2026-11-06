<?php

use App\Http\Controllers\ActiveTermController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\PasswordResetController;
use App\Http\Controllers\RegistrationController;
use App\Http\Controllers\UserActivationController;
use Illuminate\Support\Facades\Route;

// Public
Route::get('/active-term', [ActiveTermController::class, 'show']);

Route::middleware('throttle:login')->post('/login', [AuthController::class, 'login'])->name('login');

Route::middleware('throttle:account')->group(function () {
    Route::post('/register', [RegistrationController::class, 'store']);
    Route::post('/forgot-password', [PasswordResetController::class, 'sendLink']);
    Route::post('/reset-password', [PasswordResetController::class, 'reset']);
});

// Signed-in users with an active account
Route::middleware(['auth:sanctum', 'active'])->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::put('/users/{user}/activation', [UserActivationController::class, 'update']);
});
