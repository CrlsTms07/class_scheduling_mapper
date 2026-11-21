<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/*
 * The strand of a Senior High section, printed after its track on the Class Program, like
 * "ACADEMIC - Arts, Social Science and Humanities" (team decision, Nov 21, 2026). Optional.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE sections ADD COLUMN strand VARCHAR(120)');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE sections DROP COLUMN IF EXISTS strand');
    }
};
