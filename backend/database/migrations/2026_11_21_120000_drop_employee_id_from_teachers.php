<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/*
 * The employee ID is not needed (team decision, Nov 21, 2026): a teacher is known by the record's
 * own id, and there is no import to match by it any more.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
DROP INDEX IF EXISTS teachers_employee_id_unique;
ALTER TABLE teachers DROP COLUMN IF EXISTS employee_id;
SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
ALTER TABLE teachers ADD COLUMN employee_id VARCHAR(20);
CREATE UNIQUE INDEX teachers_employee_id_unique ON teachers (LOWER(employee_id));
SQL);
    }
};
