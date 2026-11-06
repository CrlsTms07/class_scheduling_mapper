<?php

use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

it('rejects an email that is not an official DepEd email', function () {
    expect(fn () => User::factory()->create(['email' => 'someone@gmail.com']))
        ->toThrow(QueryException::class, 'check');
});

it('accepts a pending sign-up that has no role yet', function () {
    $user = User::factory()->pending()->create();

    expect($user->fresh()->status)->toBe('pending')
        ->and($user->roles)->toHaveCount(0);
});

it('stores passwords as hashes', function () {
    $user = User::factory()->create(['password' => 'Password123!']);

    expect($user->fresh()->password)->not->toBe('Password123!');
});

it('allows only one active term', function () {
    $yearId = DB::table('school_years')->insertGetId([
        'name' => '2026-2027', 'start_date' => '2026-06-01', 'end_date' => '2027-03-31',
    ]);
    $term = fn (int $termNo) => [
        'school_year_id' => $yearId, 'term_no' => $termNo, 'name' => "Term {$termNo}",
        'start_date' => '2026-06-01', 'end_date' => '2026-09-30', 'is_active' => true,
    ];

    DB::table('school_terms')->insert($term(1));

    expect(fn () => DB::table('school_terms')->insert($term(2)))
        ->toThrow(QueryException::class, 'one_active_term');
});
