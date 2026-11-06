<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// A scheduler's record that they saw a soft flag and are submitting anyway.
return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
CREATE TABLE schedule_flag_acknowledgements (
    id               BIGSERIAL PRIMARY KEY,
    term_id          INT    NOT NULL REFERENCES school_terms(id) ON DELETE CASCADE,
    section_id       INT    NOT NULL REFERENCES sections(id)     ON DELETE CASCADE,
    flag_key         VARCHAR(80) NOT NULL,     -- changes when the problem changes, e.g. 'minutes:12:320'
    note             TEXT,
    acknowledged_by  BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (term_id, section_id, flag_key)
);
SQL);
    }

    public function down(): void
    {
        DB::unprepared('DROP TABLE IF EXISTS schedule_flag_acknowledgements;');
    }
};
