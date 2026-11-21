<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/*
 * Each subject belongs to Junior High or Senior High (team decision, Nov 21, 2026), so the
 * Chairperson sees only Junior High subjects and the Master Teacher only Senior High ones. The same
 * name may be used once in each. For subjects made before: their grade's level, else the level of
 * the sections they are taught in, else the level of whoever added them.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
ALTER TABLE subjects ADD COLUMN level school_level;

UPDATE subjects s SET level = g.level FROM grade_levels g WHERE g.id = s.grade_level_id;

UPDATE subjects s SET level = guess.level
FROM (
    SELECT ss.subject_id, MIN(g.level::text)::school_level AS level
    FROM section_subjects ss
    JOIN sections sec ON sec.id = ss.section_id
    JOIN grade_levels g ON g.id = sec.grade_level_id
    GROUP BY ss.subject_id
    HAVING COUNT(DISTINCT g.level) = 1
) guess
WHERE s.id = guess.subject_id AND s.level IS NULL;

UPDATE subjects s SET level = guess.level
FROM (
    SELECT a.record_id AS subject_id, MIN(g.level::text)::school_level AS level
    FROM audit_logs a
    JOIN user_grade_levels ug ON ug.user_id = a.user_id
    JOIN grade_levels g ON g.id = ug.grade_level_id
    WHERE a.table_name = 'subjects' AND a.action = 'create'
    GROUP BY a.record_id
    HAVING COUNT(DISTINCT g.level) = 1
) guess
WHERE s.id = guess.subject_id AND s.level IS NULL;

DROP INDEX IF EXISTS subjects_unique;
CREATE UNIQUE INDEX subjects_unique ON subjects
    (school_year_id, level, COALESCE(grade_level_id, 0), COALESCE(track_id, 0), COALESCE(term_no, 0), name)
    WHERE level IS NOT NULL;
CREATE UNIQUE INDEX subjects_unique_no_level ON subjects
    (school_year_id, COALESCE(grade_level_id, 0), COALESCE(track_id, 0), COALESCE(term_no, 0), name)
    WHERE level IS NULL;
SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
DROP INDEX IF EXISTS subjects_unique_no_level;
DROP INDEX IF EXISTS subjects_unique;
CREATE UNIQUE INDEX subjects_unique ON subjects
    (school_year_id, COALESCE(grade_level_id, 0), COALESCE(track_id, 0), COALESCE(term_no, 0), name);
ALTER TABLE subjects DROP COLUMN IF EXISTS level;
SQL);
    }
};
