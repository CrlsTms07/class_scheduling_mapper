<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/*
 * Columns no screen or code uses (clean-up, team decision, Nov 18, 2026):
 * - grade_levels.period_minutes: period lengths come from each bell schedule's time slots;
 * - departments.faculty_room_id: a faculty room was never asked for or shown;
 * - users.phone_number: never asked for at sign-up, not in the Data Privacy Notice.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
ALTER TABLE grade_levels DROP COLUMN IF EXISTS period_minutes;
ALTER TABLE departments DROP COLUMN IF EXISTS faculty_room_id;
ALTER TABLE users DROP COLUMN IF EXISTS phone_number;
SQL);
    }

    /** Puts the columns back, empty, as the Nov 6 migrations made them. */
    public function down(): void
    {
        DB::unprepared(<<<'SQL'
ALTER TABLE grade_levels ADD COLUMN period_minutes SMALLINT NOT NULL DEFAULT 45;
ALTER TABLE departments ADD COLUMN faculty_room_id INT REFERENCES rooms(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN phone_number VARCHAR(20);
SQL);
    }
};
