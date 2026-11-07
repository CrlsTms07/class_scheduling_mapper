<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

/**
 * On the live server, Laravel also serves the built React app, so both share one address and
 * the session cookies just work. On a developer's computer there is no build, and Vite serves it.
 */
class SpaController extends Controller
{
    public function __invoke(): Response|JsonResponse
    {
        $index = config('app.spa_index', public_path('index.html'));

        if (! is_file($index)) {
            return request()->is('/')
                ? response()->json(['name' => config('app.name')])
                : response()->json(['message' => 'Not found.'], 404);
        }

        // Always asked for fresh, so a new deploy reaches users right away.
        return response(file_get_contents($index), 200, [
            'Content-Type' => 'text/html; charset=utf-8',
            'Cache-Control' => 'no-cache',
        ]);
    }
}
