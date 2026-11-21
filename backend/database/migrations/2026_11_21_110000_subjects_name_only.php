<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/*
 * Subjects are information only (beneficiary review, Nov 21, 2026): a name (with an optional code,
 * type, Senior High track and term). The grade comes from the section a subject is added to in
 * Teacher Loading, and the minutes are counted from the schedule, so neither is typed any more.
 *
 * Both columns become optional; nothing is deleted. Subjects made before keep their grade (they
 * are still listed for that grade) and their minutes (no longer a rule). A subject with no grade
 * is for every grade, so the unique key treats "no grade" as one value.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
ALTER TABLE subjects ALTER COLUMN grade_level_id DROP NOT NULL;
ALTER TABLE subjects ALTER COLUMN minutes_per_week DROP NOT NULL;
DROP INDEX IF EXISTS subjects_unique;
CREATE UNIQUE INDEX subjects_unique ON subjects
    (school_year_id, COALESCE(grade_level_id, 0), COALESCE(track_id, 0), COALESCE(term_no, 0), name);
SQL);
    }

    /** Only possible while every subject still has a grade and minutes. */
    public function down(): void
    {
        DB::unprepared(<<<'SQL'
DROP INDEX IF EXISTS subjects_unique;
CREATE UNIQUE INDEX subjects_unique ON subjects
    (school_year_id, grade_level_id, COALESCE(track_id, 0), COALESCE(term_no, 0), name);
ALTER TABLE subjects ALTER COLUMN minutes_per_week SET NOT NULL;
ALTER TABLE subjects ALTER COLUMN grade_level_id SET NOT NULL;
SQL);
    }
};
