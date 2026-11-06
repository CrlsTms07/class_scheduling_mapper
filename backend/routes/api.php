<?php

use App\Http\Controllers\ActiveTermController;
use App\Http\Controllers\ApprovalController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ClassProgramController;
use App\Http\Controllers\ManagedSectionController;
use App\Http\Controllers\PasswordResetController;
use App\Http\Controllers\PlotterController;
use App\Http\Controllers\RegistrationController;
use App\Http\Controllers\SchoolYearController;
use App\Http\Controllers\SectionController;
use App\Http\Controllers\TermController;
use App\Http\Controllers\TimeSlotController;
use App\Http\Controllers\UserActivationController;
use App\Http\Controllers\UserController;
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

    Route::get('/users', [UserController::class, 'index']);
    Route::get('/users/access-options', [UserController::class, 'accessOptions']);
    Route::put('/users/{user}/activation', [UserActivationController::class, 'update']);

    Route::get('/school-years', [SchoolYearController::class, 'index']);
    Route::post('/school-years', [SchoolYearController::class, 'store']);
    Route::put('/school-years/{schoolYear}', [SchoolYearController::class, 'update']);
    Route::delete('/school-years/{schoolYear}', [SchoolYearController::class, 'destroy']);
    Route::put('/terms/{term}/activate', [SchoolYearController::class, 'activateTerm']);

    Route::get('/school-years/{schoolYear}/day-patterns', [TimeSlotController::class, 'index']);
    Route::post('/school-years/{schoolYear}/day-patterns', [TimeSlotController::class, 'storePattern']);
    Route::put('/day-patterns/{dayPattern}', [TimeSlotController::class, 'updatePattern']);
    Route::delete('/day-patterns/{dayPattern}', [TimeSlotController::class, 'destroyPattern']);
    Route::post('/day-patterns/{dayPattern}/copy', [TimeSlotController::class, 'copyPattern']);
    Route::post('/day-patterns/{dayPattern}/slots', [TimeSlotController::class, 'storeSlot']);
    Route::put('/time-slots/{timeSlot}', [TimeSlotController::class, 'updateSlot']);
    Route::delete('/time-slots/{timeSlot}', [TimeSlotController::class, 'destroySlot']);

    Route::get('/school-years/{schoolYear}/sections', [ManagedSectionController::class, 'index']);
    Route::get('/school-years/{schoolYear}/section-options', [ManagedSectionController::class, 'options']);
    Route::post('/school-years/{schoolYear}/sections', [ManagedSectionController::class, 'store']);
    Route::put('/sections/{section}', [ManagedSectionController::class, 'update']);
    Route::delete('/sections/{section}', [ManagedSectionController::class, 'destroy']);
    Route::post('/tracks', [ManagedSectionController::class, 'storeTrack']);

    Route::get('/terms', [TermController::class, 'index']);
    Route::get('/terms/{term}/sections', [SectionController::class, 'index']);

    Route::get('/terms/{term}/approvals', [ApprovalController::class, 'index']);
    Route::post('/terms/{term}/approvals', [ApprovalController::class, 'store']);

    Route::prefix('/terms/{term}/sections/{section}')->group(function () {
        Route::get('/plotter', [PlotterController::class, 'show']);
        Route::put('/slots/{timeSlot}', [PlotterController::class, 'assign']);
        Route::delete('/slots/{timeSlot}', [PlotterController::class, 'clear']);
        Route::post('/submit', [PlotterController::class, 'submit']);
        Route::post('/revise', [PlotterController::class, 'revise']);
        Route::get('/class-program.pdf', [ClassProgramController::class, 'show']);
    });
});
