<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/*
 * Each department belongs to Junior High or Senior High (team decision, Nov 21, 2026), so the
 * Chairperson sees only Junior High departments and teachers, and the Master Teacher only Senior
 * High ones. The same name may be used once in each (like "Department of Mathematics"). Departments
 * made before have no level yet: everyone sees them until the Admin gives them one.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
ALTER TABLE departments ADD COLUMN level school_level;
ALTER TABLE departments DROP CONSTRAINT IF EXISTS departments_name_key;
CREATE UNIQUE INDEX departments_level_name_unique ON departments (level, LOWER(name)) WHERE level IS NOT NULL;
CREATE UNIQUE INDEX departments_name_no_level_unique ON departments (LOWER(name)) WHERE level IS NULL;
-- A best guess for departments made before: the level where all its teachers teach or advise.
UPDATE departments d SET level = guess.level
FROM (
    SELECT t.department_id, MIN(g.level::text)::school_level AS level
    FROM teachers t
    JOIN (
        SELECT teacher_id, section_id FROM section_subjects
        UNION SELECT adviser_id, id FROM sections WHERE adviser_id IS NOT NULL
        UNION SELECT co_adviser_id, id FROM sections WHERE co_adviser_id IS NOT NULL
    ) work ON work.teacher_id = t.id
    JOIN sections s ON s.id = work.section_id
    JOIN grade_levels g ON g.id = s.grade_level_id
    WHERE t.department_id IS NOT NULL
    GROUP BY t.department_id
    HAVING COUNT(DISTINCT g.level) = 1
) guess
WHERE d.id = guess.department_id;
SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
DROP INDEX IF EXISTS departments_level_name_unique;
DROP INDEX IF EXISTS departments_name_no_level_unique;
ALTER TABLE departments ADD CONSTRAINT departments_name_key UNIQUE (name);
ALTER TABLE departments DROP COLUMN IF EXISTS level;
SQL);
    }
};
