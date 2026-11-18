<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/*
 * Junior High and Senior High keep their own buildings and activities (team decision, Nov 13, 2026).
 * NULL means shared: a gym or library both may use, or a school-wide activity, set by the Admin.
 * Teachers stay shared, since some teach in both.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
ALTER TABLE buildings ADD COLUMN department VARCHAR(3) CHECK (department IN ('JHS', 'SHS'));
ALTER TABLE activities ADD COLUMN department VARCHAR(3) CHECK (department IN ('JHS', 'SHS'));

-- A building used by one department only (home rooms or classes) becomes that department's.
-- Used by both, or by none yet: shared, for the Admin to sort out.
UPDATE buildings b SET department = used.level
FROM (
    SELECT r.building_id, MIN(g.level) AS level
    FROM rooms r
    JOIN (
        SELECT home_room_id AS room_id, grade_level_id FROM sections WHERE home_room_id IS NOT NULL
        UNION
        SELECT e.room_id, s.grade_level_id FROM schedule_entries e JOIN sections s ON s.id = e.section_id WHERE e.room_id IS NOT NULL
    ) u ON u.room_id = r.id
    JOIN grade_levels g ON g.id = u.grade_level_id
    GROUP BY r.building_id
    HAVING COUNT(DISTINCT g.level) = 1
) used
WHERE b.id = used.building_id;

UPDATE activities a SET department = used.level
FROM (
    SELECT e.activity_id, MIN(g.level) AS level
    FROM schedule_entries e
    JOIN sections s ON s.id = e.section_id
    JOIN grade_levels g ON g.id = s.grade_level_id
    WHERE e.activity_id IS NOT NULL
    GROUP BY e.activity_id
    HAVING COUNT(DISTINCT g.level) = 1
) used
WHERE a.id = used.activity_id;
SQL);
    }

    public function down(): void
    {
        DB::unprepared('ALTER TABLE buildings DROP COLUMN department; ALTER TABLE activities DROP COLUMN department;');
    }
};
