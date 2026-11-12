<?php

use App\Http\Controllers\SpaController;
use Illuminate\Support\Facades\Route;

// React Router handles the page addresses. Anything for the API keeps its own errors.
Route::get('/{path?}', SpaController::class)->where('path', '^(?!api(/|$)|sanctum(/|$)|up$).*$');
