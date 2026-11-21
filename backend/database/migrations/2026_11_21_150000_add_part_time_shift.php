<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/*
 * A part-time shift for Senior High (team decision, Nov 21, 2026: it happens at ERCIHS). Like the
 * morning and afternoon shifts, it gets its own class hours, so its times are set there.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TYPE shift_type ADD VALUE IF NOT EXISTS 'PART_TIME'");
    }

    /** PostgreSQL cannot take a value out of an enum; an unused value does no harm. */
    public function down(): void {}
};
