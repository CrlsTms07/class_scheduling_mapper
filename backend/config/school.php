<?php

/*
 * The school's public details, shown on the landing page until the Admin fills in
 * Report Settings → School profile. Taken from the school's own website (ercihs.edu.ph).
 */
return [
    'school_name' => 'Emmanuel Resurreccion Congressional Integrated High School',
    'short_name' => 'ERCIHS',
    'address' => 'Poinsettia St., Via Verde Village, Brgy. San Agustin II, City of Dasmariñas, Cavite 4114',
    'phone' => '(046) 894-1463 / (046) 472-9768',
    'email' => '301179@deped.gov.ph',
    'website' => 'https://www.ercihs.edu.ph',
    'facebook_url' => 'https://www.facebook.com/DepEdTayoERCIHS301179',
    'tagline' => 'Honesty · Discipline · Integrity · Perseverance',
    'region' => 'Region IV-A CALABARZON',
    'division' => 'Schools Division of Dasmariñas City',

    // A sign-up whose name matches one personnel record on the Teachers page becomes an active
    // Teacher right away (team decision, Nov 13, 2026). Other roles always wait for the Admin.
    'auto_activate_teachers' => (bool) env('SCHOOL_AUTO_ACTIVATE_TEACHERS', true),

    // Signing in asks for a 6-digit code sent to the DepEd email (team decision, Nov 16, 2026).
    // "auto" turns it on once a real mailer is set (not "log"), so no one is locked out before then.
    'login_code' => env('SCHOOL_LOGIN_CODE', 'auto'),

    // Every teacher carries at most this many subjects, the same for all (team decision, Nov 12, 2026).
    'max_subjects' => (int) env('SCHOOL_MAX_SUBJECTS', 5),
];
