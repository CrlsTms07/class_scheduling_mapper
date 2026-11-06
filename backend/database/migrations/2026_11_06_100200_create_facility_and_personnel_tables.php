<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Buildings, rooms, departments and teaching/non-teaching personnel.
return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
CREATE TABLE buildings (
    id    SERIAL PRIMARY KEY,
    name  VARCHAR(80) UNIQUE NOT NULL
);

CREATE TABLE rooms (
    id           SERIAL PRIMARY KEY,
    building_id  INT NOT NULL REFERENCES buildings(id) ON DELETE RESTRICT,
    room_number  VARCHAR(20) NOT NULL,
    room_name    VARCHAR(80),
    capacity     SMALLINT,
    is_active    BOOLEAN NOT NULL DEFAULT true,
    UNIQUE (building_id, room_number)
);

CREATE TABLE departments (                 -- subject departments: Math, Science, ...
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(80) UNIQUE NOT NULL,
    faculty_room_id INT REFERENCES rooms(id) ON DELETE SET NULL
);

CREATE TABLE designations (                -- Teacher I–III, Master Teacher I ...
    id    SERIAL PRIMARY KEY,
    name  VARCHAR(60) UNIQUE NOT NULL
);

CREATE TABLE teachers (
    id               BIGSERIAL PRIMARY KEY,
    user_id          BIGINT UNIQUE REFERENCES users(id) ON DELETE RESTRICT,  -- login, optional
    personnel_type   personnel_type NOT NULL DEFAULT 'teaching',
    first_name       VARCHAR(60) NOT NULL,
    middle_name      VARCHAR(60),
    last_name        VARCHAR(60) NOT NULL,
    suffix           VARCHAR(10),
    department_id    INT REFERENCES departments(id) ON DELETE RESTRICT,
    designation_id   INT REFERENCES designations(id) ON DELETE RESTRICT,
    shift            shift_type NOT NULL DEFAULT 'WHOLE_DAY',
    max_subjects     SMALLINT NOT NULL DEFAULT 5 CHECK (max_subjects BETWEEN 0 AND 8),
    display_name     VARCHAR(80),              -- name printed on schedules, e.g. 'Rhalf T. Tagaduar'
    is_active        BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE teacher_qualifications (      -- educational qualification
    id               BIGSERIAL PRIMARY KEY,
    teacher_id       BIGINT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    degree_level     VARCHAR(30) NOT NULL,    -- Bachelor, Master, Doctorate, units
    degree           VARCHAR(120) NOT NULL,   -- BSEd, MAEd ...
    major            VARCHAR(120),            -- specialization
    school           VARCHAR(150),
    year_completed   SMALLINT
);

CREATE TABLE teaching_tasks (              -- ICT Coordinator, SSG Coordinator, Lab Manager
    id    SERIAL PRIMARY KEY,
    name  VARCHAR(80) UNIQUE NOT NULL
);

CREATE TABLE teacher_tasks (
    teacher_id  BIGINT REFERENCES teachers(id) ON DELETE CASCADE,
    task_id     INT    REFERENCES teaching_tasks(id) ON DELETE RESTRICT,
    term_id     INT    REFERENCES school_terms(id) ON DELETE RESTRICT,
    PRIMARY KEY (teacher_id, task_id, term_id)
);
SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
DROP TABLE IF EXISTS teacher_tasks;
DROP TABLE IF EXISTS teaching_tasks;
DROP TABLE IF EXISTS teacher_qualifications;
DROP TABLE IF EXISTS teachers;
DROP TABLE IF EXISTS designations;
DROP TABLE IF EXISTS departments;
DROP TABLE IF EXISTS rooms;
DROP TABLE IF EXISTS buildings;
SQL);
    }
};
