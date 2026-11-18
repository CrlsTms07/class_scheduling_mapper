<?php

use Database\Seeders\ReferenceDataSeeder;

it('saves a dated copy of the database that pg_restore can read', function () {
    $this->seed(ReferenceDataSeeder::class);
    $before = glob(storage_path('app/private/backups/*.dump')) ?: [];

    $this->artisan('app:backup')->expectsOutputToContain('Saved:')->assertSuccessful();

    $new = array_values(array_diff(glob(storage_path('app/private/backups/*.dump')) ?: [], $before));
    expect($new)->toHaveCount(1)
        ->and(file_get_contents($new[0], false, null, 0, 5))->toBe('PGDMP');

    unlink($new[0]);
})->skip(fn () => trim((string) shell_exec('pg_dump --version')) === '', 'pg_dump is not installed here');
