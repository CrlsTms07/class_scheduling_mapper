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

    // Every teacher carries at most this many subjects, the same for all (team decision, Nov 12, 2026).
    'max_subjects' => (int) env('SCHOOL_MAX_SUBJECTS', 5),
];
