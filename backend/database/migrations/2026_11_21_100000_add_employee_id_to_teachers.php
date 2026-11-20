<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/*
 * Employee ID on personnel records (team decision, Nov 21, 2026): the key that the master-data
 * import matches teachers by, so a list imported again updates the same people instead of adding
 * them twice. Nullable, since records made before have none; unique in any letter case.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
ALTER TABLE teachers ADD COLUMN employee_id VARCHAR(20);
CREATE UNIQUE INDEX teachers_employee_id_unique ON teachers (LOWER(employee_id));
SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
DROP INDEX IF EXISTS teachers_employee_id_unique;
ALTER TABLE teachers DROP COLUMN IF EXISTS employee_id;
SQL);
    }
};
