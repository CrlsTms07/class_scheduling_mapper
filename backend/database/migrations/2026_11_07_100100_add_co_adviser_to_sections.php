<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// The adviser and co-adviser are the only teachers named on the public schedule.
return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
ALTER TABLE sections
    ADD COLUMN co_adviser_id BIGINT REFERENCES teachers(id) ON DELETE RESTRICT,
    ADD CONSTRAINT sections_co_adviser_differs CHECK (co_adviser_id <> adviser_id);
SQL);
    }

    public function down(): void
    {
        DB::unprepared('ALTER TABLE sections DROP CONSTRAINT sections_co_adviser_differs, DROP COLUMN co_adviser_id;');
    }
};
