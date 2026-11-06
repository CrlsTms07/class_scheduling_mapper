<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// School calendar, grade levels and scopes, day patterns and time slots.
return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
CREATE TABLE school_years (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(9) UNIQUE NOT NULL,                 -- '2026-2027'
    term_count  SMALLINT NOT NULL DEFAULT 3 CHECK (term_count BETWEEN 1 AND 4),
    term_label  VARCHAR(20) NOT NULL DEFAULT 'Term',        -- 'Term', 'Semester', 'Quarter'
    start_date  DATE NOT NULL,
    end_date    DATE NOT NULL CHECK (end_date > start_date)
);

CREATE TABLE school_terms (
    id              SERIAL PRIMARY KEY,
    school_year_id  INT NOT NULL REFERENCES school_years(id) ON DELETE RESTRICT,
    term_no         SMALLINT NOT NULL CHECK (term_no >= 1),  -- app checks term_no <= term_count
    name            VARCHAR(30) NOT NULL,                    -- 'First Term', 'Second Semester' ...
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL CHECK (end_date > start_date),
    is_active       BOOLEAN NOT NULL DEFAULT false,
    UNIQUE (school_year_id, term_no)
);

CREATE TABLE grade_levels (
    id               SMALLSERIAL PRIMARY KEY,
    grade            SMALLINT UNIQUE NOT NULL CHECK (grade BETWEEN 7 AND 12),
    level            school_level NOT NULL,
    period_minutes   SMALLINT NOT NULL DEFAULT 45,   -- default only; real lengths come from time_slots
    CHECK ((grade <= 10 AND level = 'JHS') OR (grade >= 11 AND level = 'SHS'))
);

CREATE TABLE user_grade_levels (
    user_id         BIGINT   REFERENCES users(id) ON DELETE CASCADE,
    grade_level_id  SMALLINT REFERENCES grade_levels(id) ON DELETE RESTRICT,
    PRIMARY KEY (user_id, grade_level_id)
);

CREATE TABLE day_patterns (
    id              SERIAL PRIMARY KEY,
    school_year_id  INT NOT NULL REFERENCES school_years(id) ON DELETE RESTRICT,
    level           school_level NOT NULL,
    shift           shift_type   NOT NULL,
    name            VARCHAR(40)  NOT NULL,              -- 'Monday – Thursday', 'Friday'
    days            SMALLINT[]   NOT NULL,              -- {1,2,3,4} or {5}  (1 = Monday)
    CHECK (cardinality(days) BETWEEN 1 AND 5 AND days <@ ARRAY[1,2,3,4,5]::SMALLINT[]),
    UNIQUE (school_year_id, level, shift, name)
    -- app rule: the same day must not appear in two patterns of the same year/level/shift
);

CREATE TABLE time_slots (
    id              SERIAL PRIMARY KEY,
    day_pattern_id  INT NOT NULL REFERENCES day_patterns(id) ON DELETE CASCADE,
    period_no       SMALLINT,                       -- NULL for breaks
    label           VARCHAR(40),                    -- 'Break', 'Lunch'
    start_time      TIME NOT NULL,
    end_time        TIME NOT NULL CHECK (end_time > start_time),
    is_break        BOOLEAN NOT NULL DEFAULT false,
    CHECK (is_break OR period_no IS NOT NULL),
    EXCLUDE USING gist (day_pattern_id WITH =, timerange(start_time, end_time) WITH &&)
);

CREATE UNIQUE INDEX one_active_term ON school_terms (is_active) WHERE is_active;
SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
DROP TABLE IF EXISTS time_slots;
DROP TABLE IF EXISTS day_patterns;
DROP TABLE IF EXISTS user_grade_levels;
DROP TABLE IF EXISTS grade_levels;
DROP TABLE IF EXISTS school_terms;
DROP TABLE IF EXISTS school_years;
SQL);
    }
};
