<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/*
 * Auto-fill is removed (team decision, Nov 17, 2026). Classes it placed stay as they are, as
 * drafts; only the link to the run and the table of runs go away.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
ALTER TABLE schedule_entries DROP COLUMN IF EXISTS auto_fill_run_id;
DROP TABLE IF EXISTS auto_fill_runs;
SQL);
    }

    /** Puts the empty table and column back, as the Nov 9 migration made them. */
    public function down(): void
    {
        DB::unprepared(<<<'SQL'
CREATE TABLE auto_fill_runs (
    id            BIGSERIAL PRIMARY KEY,
    term_id       INT NOT NULL REFERENCES school_terms(id) ON DELETE RESTRICT,
    scope         VARCHAR(10) NOT NULL CHECK (scope IN ('section', 'grade', 'all')),
    scope_ref_id  INT,
    created_by    BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    undone_at     TIMESTAMPTZ
);

ALTER TABLE schedule_entries
    ADD COLUMN auto_fill_run_id BIGINT REFERENCES auto_fill_runs(id) ON DELETE SET NULL;
CREATE INDEX schedule_entries_auto_fill_idx ON schedule_entries (auto_fill_run_id) WHERE auto_fill_run_id IS NOT NULL;
SQL);
    }
};
