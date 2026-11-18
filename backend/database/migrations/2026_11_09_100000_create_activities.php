<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/*
 * Activities such as Flag Ceremony or Catch-up Friday. They take a period of a section but
 * have no teacher, room or required minutes, so they are kept apart from subjects.
 * Recess and lunch stay as breaks of the bell schedule.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
CREATE TABLE activities (
    id              SERIAL PRIMARY KEY,
    school_year_id  INT NOT NULL REFERENCES school_years(id) ON DELETE RESTRICT,
    code            VARCHAR(20),
    name            VARCHAR(100) NOT NULL,
    UNIQUE (school_year_id, name)
);

ALTER TABLE schedule_entries
    ADD COLUMN activity_id INT REFERENCES activities(id) ON DELETE RESTRICT,
    ADD CONSTRAINT activity_has_no_class
        CHECK (activity_id IS NULL OR (section_subject_id IS NULL AND teacher_id IS NULL));
SQL);

        // An activity needs no subject or room, even once submitted.
        DB::statement('ALTER TABLE schedule_entries DROP CONSTRAINT "'.$this->completenessCheck().'"');
        DB::statement(<<<'SQL'
ALTER TABLE schedule_entries ADD CONSTRAINT entry_complete_unless_draft
    CHECK (status = 'draft' OR activity_id IS NOT NULL OR (section_subject_id IS NOT NULL AND room_id IS NOT NULL))
SQL);

        $this->statusView('e.section_subject_id IS NULL AND e.activity_id IS NULL');
    }

    public function down(): void
    {
        DB::statement('DELETE FROM schedule_entries WHERE activity_id IS NOT NULL');
        $this->statusView('e.section_subject_id IS NULL');
        DB::unprepared(<<<'SQL'
ALTER TABLE schedule_entries DROP CONSTRAINT entry_complete_unless_draft;
ALTER TABLE schedule_entries ADD CONSTRAINT schedule_entries_check1
    CHECK (status = 'draft' OR (section_subject_id IS NOT NULL AND room_id IS NOT NULL));
ALTER TABLE schedule_entries DROP CONSTRAINT activity_has_no_class;
ALTER TABLE schedule_entries DROP COLUMN activity_id;
DROP TABLE activities;
SQL);
    }

    /** The original check has no name of its own, so it is found by what it says. */
    private function completenessCheck(): string
    {
        return DB::selectOne(<<<'SQL'
SELECT conname FROM pg_constraint
WHERE conrelid = 'schedule_entries'::regclass AND contype = 'c'
  AND pg_get_constraintdef(oid) LIKE '%room_id IS NOT NULL%'
SQL)->conname;
    }

    /** Open slots are entries with neither a subject nor an activity. */
    private function statusView(string $openSlot): void
    {
        DB::unprepared(<<<SQL
CREATE OR REPLACE VIEW section_term_status AS
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
           COUNT(e.id) FILTER (WHERE {$openSlot}) AS open_slot_count
    FROM school_terms t
    JOIN sections s ON s.school_year_id = t.school_year_id
    LEFT JOIN schedule_entries e ON e.term_id = t.id AND e.section_id = s.id
    GROUP BY t.id, s.id
) counts;
SQL);
    }
};
