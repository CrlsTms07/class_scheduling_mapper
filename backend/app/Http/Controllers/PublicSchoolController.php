<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

/**
 * The school's details for the landing page, open to everyone. What the Admin saved in
 * the school profile comes first; anything left empty falls back to config/school.php.
 */
class PublicSchoolController extends Controller
{
    private const FIELDS = ['school_name', 'address', 'phone', 'email', 'website', 'facebook_url', 'tagline', 'vision', 'mission', 'core_values'];

    public function show(): JsonResponse
    {
        $profile = (array) (DB::table('school_profile')->first() ?? []);
        $defaults = config('school');

        $school = [];
        foreach (self::FIELDS as $field) {
            $school[$field] = filled($profile[$field] ?? null) ? $profile[$field] : ($defaults[$field] ?? null);
        }

        return response()->json(['data' => [
            ...$school,
            'short_name' => $defaults['short_name'],
            'has_photo' => filled($profile['photo_base64'] ?? null),
        ]]);
    }

    /** The campus photo the Admin uploaded, cached by the browser for a day. */
    public function photo(): Response
    {
        $profile = DB::table('school_profile')->first(['photo_mime', 'photo_base64']);
        abort_unless($profile && $profile->photo_base64, 404);

        return response(base64_decode($profile->photo_base64), 200, [
            'Content-Type' => $profile->photo_mime,
            'Cache-Control' => 'public, max-age=86400',
        ]);
    }
}
