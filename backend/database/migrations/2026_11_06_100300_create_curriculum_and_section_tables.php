<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Tracks, subjects per school year, sections per school year, and teacher loading per term.
return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
CREATE TABLE tracks (                      -- SHS: Academic, TechPro, ...
    id    SERIAL PRIMARY KEY,
    name  VARCHAR(80) UNIQUE NOT NULL
);

CREATE TABLE subjects (                    -- curriculum is per school year (can change yearly)
    id                SERIAL PRIMARY KEY,
    school_year_id    INT NOT NULL REFERENCES school_years(id) ON DELETE RESTRICT,
    grade_level_id    SMALLINT NOT NULL REFERENCES grade_levels(id) ON DELETE RESTRICT,
    track_id          INT REFERENCES tracks(id) ON DELETE RESTRICT,  -- NULL = all tracks / JHS
    term_no           SMALLINT,                                      -- NULL = whole year (JHS)
    code              VARCHAR(20),
    name              VARCHAR(100) NOT NULL,
    subject_type      subject_type NOT NULL DEFAULT 'core',
    minutes_per_week  SMALLINT NOT NULL CHECK (minutes_per_week > 0),  -- Homeroom = 60
    is_priority       BOOLEAN NOT NULL DEFAULT false,                  -- PE, Homeroom
    is_active         BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE sections (
    id               SERIAL PRIMARY KEY,
    school_year_id   INT NOT NULL REFERENCES school_years(id) ON DELETE RESTRICT,
    grade_level_id   SMALLINT NOT NULL REFERENCES grade_levels(id) ON DELETE RESTRICT,
    track_id         INT REFERENCES tracks(id) ON DELETE RESTRICT,     -- SHS only
    name             VARCHAR(60) NOT NULL,
    shift            shift_type NOT NULL DEFAULT 'WHOLE_DAY',
    adviser_id       BIGINT REFERENCES teachers(id) ON DELETE RESTRICT,
    home_room_id     INT REFERENCES rooms(id) ON DELETE RESTRICT,       -- JHS fixed room
    class_size       SMALLINT CHECK (class_size >= 0),
    UNIQUE (school_year_id, grade_level_id, name),
    UNIQUE (school_year_id, adviser_id)                                  -- 1 advisory per year
);

CREATE TABLE section_subjects (
    id          SERIAL PRIMARY KEY,
    term_id     INT    NOT NULL REFERENCES school_terms(id) ON DELETE RESTRICT,
    section_id  INT    NOT NULL REFERENCES sections(id)  ON DELETE RESTRICT,
    subject_id  INT    NOT NULL REFERENCES subjects(id)  ON DELETE RESTRICT,
    teacher_id  BIGINT NOT NULL REFERENCES teachers(id)  ON DELETE RESTRICT,
    UNIQUE (term_id, section_id, subject_id),
    UNIQUE (id, term_id, section_id, teacher_id)        -- target for composite FK
);

CREATE UNIQUE INDEX subjects_unique ON subjects
    (school_year_id, grade_level_id, COALESCE(track_id, 0), COALESCE(term_no, 0), name);
SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
DROP TABLE IF EXISTS section_subjects;
DROP TABLE IF EXISTS sections;
DROP TABLE IF EXISTS subjects;
DROP TABLE IF EXISTS tracks;
SQL);
    }
};
