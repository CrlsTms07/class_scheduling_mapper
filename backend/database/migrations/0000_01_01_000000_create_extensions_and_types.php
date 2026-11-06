<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// PostgreSQL extension and custom types. Runs first because the users table needs account_status.
// The DROP lines let "migrate:fresh" run again: Laravel drops tables but keeps types.
return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
CREATE EXTENSION IF NOT EXISTS btree_gist;

DROP TYPE IF EXISTS timerange CASCADE;
DROP TYPE IF EXISTS school_level CASCADE;
DROP TYPE IF EXISTS shift_type CASCADE;
DROP TYPE IF EXISTS account_status CASCADE;
DROP TYPE IF EXISTS personnel_type CASCADE;
DROP TYPE IF EXISTS subject_type CASCADE;
DROP TYPE IF EXISTS entry_status CASCADE;
DROP TYPE IF EXISTS review_scope CASCADE;
DROP TYPE IF EXISTS review_action CASCADE;
DROP TYPE IF EXISTS report_type CASCADE;

-- PostgreSQL has no built-in time range, so we make one
CREATE TYPE timerange AS RANGE (subtype = time);

CREATE TYPE school_level    AS ENUM ('JHS', 'SHS');
CREATE TYPE shift_type      AS ENUM ('AM', 'PM', 'WHOLE_DAY');
CREATE TYPE account_status  AS ENUM ('pending', 'active', 'inactive');
CREATE TYPE personnel_type  AS ENUM ('teaching', 'non_teaching');
CREATE TYPE subject_type    AS ENUM ('core', 'elective', 'other');
CREATE TYPE entry_status    AS ENUM ('draft', 'pending', 'approved', 'rejected');
CREATE TYPE review_scope    AS ENUM ('section', 'grade_level', 'JHS', 'SHS', 'all');
CREATE TYPE review_action   AS ENUM ('approve', 'reject', 'reopen');
CREATE TYPE report_type AS ENUM ('class_program', 'teacher_program', 'room_schedule');
SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
DROP TYPE IF EXISTS timerange CASCADE;
DROP TYPE IF EXISTS school_level CASCADE;
DROP TYPE IF EXISTS shift_type CASCADE;
DROP TYPE IF EXISTS account_status CASCADE;
DROP TYPE IF EXISTS personnel_type CASCADE;
DROP TYPE IF EXISTS subject_type CASCADE;
DROP TYPE IF EXISTS entry_status CASCADE;
DROP TYPE IF EXISTS review_scope CASCADE;
DROP TYPE IF EXISTS review_action CASCADE;
DROP TYPE IF EXISTS report_type CASCADE;
SQL);
    }
};
