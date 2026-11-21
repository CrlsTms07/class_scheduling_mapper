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
    private const FIELDS = ['school_name', 'address', 'phone', 'email', 'website', 'facebook_url', 'tagline', 'vision', 'mission', 'core_values', 'division'];

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
            // The home page shows the school's logo (no uploaded photo since Nov 21, 2026).
            'has_photo' => false,
        ]]);
    }

}
