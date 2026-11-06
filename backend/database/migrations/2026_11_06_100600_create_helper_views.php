<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Views used by load checks, minutes flags and the room usage report.
return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
CREATE VIEW teacher_load AS
SELECT t.id AS teacher_id, ss.term_id,
       COUNT(ss.id)                  AS subject_count,
       t.max_subjects,
       COUNT(ss.id) > t.max_subjects AS is_overloaded
FROM teachers t
JOIN section_subjects ss ON ss.teacher_id = t.id
GROUP BY t.id, ss.term_id, t.max_subjects;

CREATE VIEW subject_minutes_check AS
SELECT ss.id AS section_subject_id, ss.term_id, ss.section_id, s.name AS subject,
       s.minutes_per_week AS required_minutes,
       COALESCE(SUM(EXTRACT(EPOCH FROM (e.end_time - e.start_time)) / 60), 0)::INT
                                        AS scheduled_minutes
FROM section_subjects ss
JOIN subjects s ON s.id = ss.subject_id
LEFT JOIN schedule_entries e
       ON e.section_subject_id = ss.id AND e.status <> 'rejected'
GROUP BY ss.id, ss.term_id, ss.section_id, s.name, s.minutes_per_week;

CREATE VIEW room_usage AS
SELECT e.term_id, b.id AS building_id, b.name AS building, r.id AS room_id,
       r.room_number, r.room_name, e.section_id,
       COUNT(*) AS periods_per_week
FROM schedule_entries e
JOIN rooms r     ON r.id = e.room_id
JOIN buildings b ON b.id = r.building_id
WHERE e.status <> 'rejected'
GROUP BY e.term_id, b.id, b.name, r.id, r.room_number, r.room_name, e.section_id;
SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
DROP VIEW IF EXISTS room_usage;
DROP VIEW IF EXISTS subject_minutes_check;
DROP VIEW IF EXISTS teacher_load;
SQL);
    }
};
