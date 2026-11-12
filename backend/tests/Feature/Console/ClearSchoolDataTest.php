<?php

use App\Console\Commands\ClearSchoolData;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    $this->seed(DatabaseSeeder::class);
});

it('empties the school records and keeps accounts, school years and settings', function () {
    $users = User::count();
    $terms = DB::table('school_terms')->count();
    expect(DB::table('sections')->count())->toBeGreaterThan(0)
        ->and(DB::table('teachers')->count())->toBeGreaterThan(0);

    $this->artisan('app:clear-school-data', ['--force' => true])->assertSuccessful();

    foreach (ClearSchoolData::TABLES as $table) {
        expect(DB::table($table)->count())->toBe(0, "{$table} should be empty");
    }
    expect(User::count())->toBe($users)
        ->and(DB::table('school_terms')->count())->toBe($terms)
        ->and(DB::table('grade_levels')->count())->toBe(6)
        ->and(DB::table('school_profile')->count())->toBeGreaterThan(0);
});

it('asks first, and deletes nothing when the answer is no', function () {
    $sections = DB::table('sections')->count();

    $this->artisan('app:clear-school-data')
        ->expectsConfirmation('Delete these rows from '.DB::connection()->getDatabaseName().'? This cannot be undone.', 'no')
        ->assertSuccessful();

    expect(DB::table('sections')->count())->toBe($sections);
});
