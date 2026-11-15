<?php

use Illuminate\Support\Facades\DB;

it('returns null when no term is active', function () {
    $this->getJson('/api/active-term')->assertOk()->assertExactJson(['data' => null]);
});

it('returns the active term with labels read from the database', function () {
    $yearId = DB::table('school_years')->insertGetId([
        'name' => '2026-2027', 'term_count' => 2, 'term_label' => 'Semester',
        'start_date' => '2026-06-01', 'end_date' => '2027-03-31',
    ]);
    DB::table('school_terms')->insert([
        'school_year_id' => $yearId, 'term_no' => 1, 'name' => 'First Semester',
        'start_date' => '2026-06-01', 'end_date' => '2026-10-31', 'is_active' => true,
    ]);

    $this->getJson('/api/active-term')
        ->assertOk()
        ->assertJsonPath('data.name', 'First Semester')
        ->assertJsonPath('data.school_year.name', '2026-2027')
        ->assertJsonPath('data.school_year.term_label', 'Semester')
        ->assertJsonPath('data.school_year.term_count', 2);
});
