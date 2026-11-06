<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// The timetable and its approval actions. The EXCLUDE constraints are the database-level conflict detection.
return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
CREATE TABLE schedule_reviews (
    id            BIGSERIAL PRIMARY KEY,
    term_id       INT NOT NULL REFERENCES school_terms(id) ON DELETE RESTRICT,
    scope         review_scope  NOT NULL,
    scope_ref_id  INT,               -- section id or grade level id; NULL for JHS/SHS/all
    action        review_action NOT NULL,
    remarks       TEXT,
    reviewed_by   BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK ((scope IN ('section', 'grade_level')) = (scope_ref_id IS NOT NULL)),
    CHECK (action = 'approve' OR remarks IS NOT NULL)
);

CREATE TABLE schedule_entries (
    id                  BIGSERIAL PRIMARY KEY,
    term_id             INT      NOT NULL REFERENCES school_terms(id) ON DELETE RESTRICT,
    section_id          INT      NOT NULL REFERENCES sections(id)     ON DELETE RESTRICT,
    section_subject_id  INT,
    teacher_id          BIGINT,
    room_id             INT      REFERENCES rooms(id) ON DELETE RESTRICT,
    day_of_week         SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 5),  -- Mon–Fri
    start_time          TIME     NOT NULL,
    end_time            TIME     NOT NULL CHECK (end_time > start_time),
    status              entry_status NOT NULL DEFAULT 'draft',
    created_by          BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    review_id           BIGINT REFERENCES schedule_reviews(id) ON DELETE RESTRICT,
    copied_from_id      BIGINT REFERENCES schedule_entries(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    FOREIGN KEY (section_subject_id, term_id, section_id, teacher_id)
        REFERENCES section_subjects (id, term_id, section_id, teacher_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,

    -- an open slot (no subject yet) is only allowed while in draft
    CHECK (status = 'draft' OR (section_subject_id IS NOT NULL AND room_id IS NOT NULL)),
    CHECK ((section_subject_id IS NULL) = (teacher_id IS NULL)),

    -- ===== DATABASE-LEVEL CONFLICT DETECTION =====
    -- NULL teacher/room never conflicts. Rejected entries are ignored.
    -- '[)' bounds: 7:00–7:45 and 7:45–8:30 do NOT clash.
    CONSTRAINT no_teacher_conflict EXCLUDE USING gist (
        term_id WITH =, teacher_id WITH =, day_of_week WITH =,
        timerange(start_time, end_time) WITH &&
    ) WHERE (status <> 'rejected'),

    CONSTRAINT no_room_conflict EXCLUDE USING gist (
        term_id WITH =, room_id WITH =, day_of_week WITH =,
        timerange(start_time, end_time) WITH &&
    ) WHERE (status <> 'rejected'),

    CONSTRAINT no_section_conflict EXCLUDE USING gist (
        term_id WITH =, section_id WITH =, day_of_week WITH =,
        timerange(start_time, end_time) WITH &&
    ) WHERE (status <> 'rejected')
);

CREATE INDEX section_subjects_teacher_term_idx ON section_subjects (teacher_id, term_id);
CREATE INDEX schedule_entries_section_term_idx ON schedule_entries (section_id, term_id);
CREATE INDEX schedule_entries_status_term_idx  ON schedule_entries (term_id, status);
SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
DROP TABLE IF EXISTS schedule_entries;
DROP TABLE IF EXISTS schedule_reviews;
SQL);
    }
};
