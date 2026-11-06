<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Needed in every environment.
        $this->call(ReferenceDataSeeder::class);

        // Fake accounts and sample records must never reach the live server.
        if (! app()->isProduction()) {
            $this->call(DemoDataSeeder::class);
        }
    }
}
