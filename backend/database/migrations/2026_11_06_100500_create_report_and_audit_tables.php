<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// School header/footer, document settings, signatories and the audit trail.
return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
CREATE TABLE school_profile (              -- single row
    id            SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    school_name   VARCHAR(150) NOT NULL,
    school_id     VARCHAR(20),               -- DepEd school ID
    address       VARCHAR(255),
    phone         VARCHAR(50),
    email         VARCHAR(150),
    website       VARCHAR(150),
    logo_path     VARCHAR(255),              -- school logo
    extra_logos   JSONB NOT NULL DEFAULT '[]' -- DepEd, Bagong Pilipinas, ...
);

CREATE TABLE report_settings (             -- per document type and level
    id                SERIAL PRIMARY KEY,
    report_type       report_type NOT NULL,
    level             school_level,            -- NULL = both
    title_format      VARCHAR(150) NOT NULL,   -- '{level} GRADE {grade} – CLASS PROGRAM'
    doc_ref_code      VARCHAR(40),             -- 'SCH-OSH-F002'
    revision_no       VARCHAR(10),             -- '00'
    effectivity_date  DATE,
    reference_note    VARCHAR(150),            -- 'DO 12, s. 2024'
    UNIQUE (report_type, level)
);

CREATE TABLE report_signatories (
    id           SERIAL PRIMARY KEY,
    term_id      INT NOT NULL REFERENCES school_terms(id) ON DELETE CASCADE,
    report_type  report_type,                -- NULL = all documents
    level        school_level,               -- NULL = both JHS and SHS
    label        VARCHAR(40) NOT NULL,       -- 'Prepared by', 'Conforme', 'Approved by'
    name         VARCHAR(120),               -- typed by the Admin (e.g. the PSDS)
    position     VARCHAR(120),               -- 'Head Teacher III', 'PSDS Cluster IV'
    auto_source  VARCHAR(20) CHECK (auto_source IN ('section_adviser', 'teacher')),
                 -- filled per document: adviser of the section / the teacher himself
    sort_order   SMALLINT NOT NULL DEFAULT 1,
    CHECK (name IS NOT NULL OR auto_source IS NOT NULL)
);

CREATE TABLE audit_logs (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
    action      VARCHAR(30) NOT NULL,         -- create, update, delete, approve, reject, copy
    table_name  VARCHAR(50) NOT NULL,
    record_id   BIGINT,
    old_data    JSONB,
    new_data    JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS report_signatories;
DROP TABLE IF EXISTS report_settings;
DROP TABLE IF EXISTS school_profile;
SQL);
    }
};
