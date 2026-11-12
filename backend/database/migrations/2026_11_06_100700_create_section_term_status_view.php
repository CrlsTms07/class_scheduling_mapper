<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// One status per section per term, so the dashboard, approvals and guest view all agree.
return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
CREATE VIEW section_term_status AS
SELECT counts.term_id, counts.section_id,
       counts.draft_count, counts.pending_count, counts.approved_count,
       counts.rejected_count, counts.open_slot_count,
       CASE
           WHEN counts.draft_count + counts.pending_count + counts.approved_count + counts.rejected_count = 0
                THEN 'not_started'
           WHEN counts.rejected_count > 0 THEN 'rejected'
           WHEN counts.draft_count > 0    THEN 'draft'
           WHEN counts.pending_count > 0  THEN 'pending'
           ELSE 'approved'
       END AS status
FROM (
    SELECT t.id AS term_id, s.id AS section_id,
           COUNT(e.id) FILTER (WHERE e.status = 'draft')    AS draft_count,
           COUNT(e.id) FILTER (WHERE e.status = 'pending')  AS pending_count,
           COUNT(e.id) FILTER (WHERE e.status = 'approved') AS approved_count,
           COUNT(e.id) FILTER (WHERE e.status = 'rejected') AS rejected_count,
           COUNT(e.id) FILTER (WHERE e.section_subject_id IS NULL) AS open_slot_count
    FROM school_terms t
    JOIN sections s ON s.school_year_id = t.school_year_id
    LEFT JOIN schedule_entries e ON e.term_id = t.id AND e.section_id = s.id
    GROUP BY t.id, s.id
) counts;
SQL);
    }

    public function down(): void
    {
        DB::unprepared('DROP VIEW IF EXISTS section_term_status;');
    }
};
