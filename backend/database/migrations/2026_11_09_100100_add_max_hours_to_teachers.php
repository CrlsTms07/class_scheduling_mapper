<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Load Distribution: hours per week a teacher may carry before being flagged (default 30).
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE teachers ADD COLUMN max_hours_per_week SMALLINT NOT NULL DEFAULT 30 CHECK (max_hours_per_week BETWEEN 1 AND 60)');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE teachers DROP COLUMN max_hours_per_week');
    }
};
