<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/*
 * Auto-fill: each run is remembered, and the entries it placed point to it, so the run can
 * be undone without touching anything placed by hand. Editing an entry by hand clears its link.
 */
return new class extends Migration
{
    public function up(): void
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

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
ALTER TABLE schedule_entries DROP COLUMN auto_fill_run_id;
DROP TABLE auto_fill_runs;
SQL);
    }
};
