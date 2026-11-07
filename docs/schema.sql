-- =====================================================================
-- Class Scheduling System – ERCIHS
-- PostgreSQL schema  (v5 – Laravel Auth + spatie/laravel-permission, Nov 6 2026)
--
-- Not listed here because their packages create them:
--   - spatie/laravel-permission: roles, permissions, model_has_roles,
--     model_has_permissions, role_has_permissions
--   - Laravel: password_reset_tokens, sessions, cache, jobs, migrations
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;   -- needed for conflict constraints

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

-- ---------------------------------------------------------------------
-- Users, roles, scopes
-- Roles: super_admin (Admin), glc (JHS scheduler), master_teacher (SHS scheduler), teacher
-- Roles are stored in the spatie/laravel-permission tables. A pending account has
-- no role yet; the Admin assigns one on activation. The app allows one role per user.
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id              BIGSERIAL PRIMARY KEY,
    email           VARCHAR(150) UNIQUE NOT NULL
                    CHECK (email ILIKE '%@deped.gov.ph'),   -- DepEd email requirement
    password        VARCHAR(255) NOT NULL,                  -- bcrypt hash, never plain text
    remember_token  VARCHAR(100),                           -- Laravel "remember me"
    first_name      VARCHAR(60)  NOT NULL,
    middle_name     VARCHAR(60),
    last_name       VARCHAR(60)  NOT NULL,
    suffix          VARCHAR(10),
    phone_number    VARCHAR(20),
    status          account_status NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- School calendar  (supports 3 terms now, 2 terms if DepEd reverts)
-- ---------------------------------------------------------------------
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
CREATE UNIQUE INDEX one_active_term ON school_terms (is_active) WHERE is_active;

CREATE TABLE grade_levels (
    id               SMALLSERIAL PRIMARY KEY,
    grade            SMALLINT UNIQUE NOT NULL CHECK (grade BETWEEN 7 AND 12),
    level            school_level NOT NULL,
    period_minutes   SMALLINT NOT NULL DEFAULT 45,   -- default only; real lengths come from time_slots
    CHECK ((grade <= 10 AND level = 'JHS') OR (grade >= 11 AND level = 'SHS'))
);

-- Which grade levels a GLC / Master Teacher may schedule.
-- One GLC for all of JHS = 4 rows; one GLC per grade = 1 row each. Both work.
CREATE TABLE user_grade_levels (
    user_id         BIGINT   REFERENCES users(id) ON DELETE CASCADE,
    grade_level_id  SMALLINT REFERENCES grade_levels(id) ON DELETE RESTRICT,
    PRIMARY KEY (user_id, grade_level_id)
);

-- Day patterns: groups of days that share the same bell schedule
-- e.g. JHS "Monday–Thursday" (45/80-min periods) and "Friday" (40/80-min + HGP)
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

-- Periods and breaks of a day pattern (lengths can differ: 20, 40, 45, 80 minutes...)
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

-- ---------------------------------------------------------------------
-- Buildings, rooms, departments
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- Personnel (teaching and non-teaching)
-- A personnel record can exist without a login account (user_id NULL)
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- Curriculum
-- ---------------------------------------------------------------------
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
CREATE UNIQUE INDEX subjects_unique ON subjects
    (school_year_id, grade_level_id, COALESCE(track_id, 0), COALESCE(term_no, 0), name);

-- ---------------------------------------------------------------------
-- Sections (encoded by the Admin once per school year)
-- ---------------------------------------------------------------------
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

-- Teacher loading: who teaches which subject to which section, per term
CREATE TABLE section_subjects (
    id          SERIAL PRIMARY KEY,
    term_id     INT    NOT NULL REFERENCES school_terms(id) ON DELETE RESTRICT,
    section_id  INT    NOT NULL REFERENCES sections(id)  ON DELETE RESTRICT,
    subject_id  INT    NOT NULL REFERENCES subjects(id)  ON DELETE RESTRICT,
    teacher_id  BIGINT NOT NULL REFERENCES teachers(id)  ON DELETE RESTRICT,
    UNIQUE (term_id, section_id, subject_id),
    UNIQUE (id, term_id, section_id, teacher_id)        -- target for composite FK
);

-- ---------------------------------------------------------------------
-- Admin approval actions (one row per approve / reject / reopen click)
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- The timetable
-- section_subject_id / teacher_id may be NULL only in a DRAFT "open slot"
-- (used by "copy previous term": time slot is kept, subject is chosen later)
-- ---------------------------------------------------------------------
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

-- Lookups used by the plotter, reports and approvals
CREATE INDEX section_subjects_teacher_term_idx ON section_subjects (teacher_id, term_id);
CREATE INDEX schedule_entries_section_term_idx ON schedule_entries (section_id, term_id);
CREATE INDEX schedule_entries_status_term_idx  ON schedule_entries (term_id, status);

-- A scheduler's record that they saw a soft flag and are submitting anyway
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

-- ---------------------------------------------------------------------
-- Printed documents: school header/footer, document control, signatories
-- (everything printed is encoded by the Admin — nothing is hard-coded)
-- ---------------------------------------------------------------------
CREATE TABLE school_profile (              -- single row
    id            SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    school_name   VARCHAR(150) NOT NULL,
    school_id     VARCHAR(20),               -- DepEd school ID
    address       VARCHAR(255),
    phone         VARCHAR(50),
    email         VARCHAR(150),
    website       VARCHAR(150)
);

-- Kept here and not on disk, because free hosting erases its disk on every restart.
CREATE TABLE school_logos (
    id            BIGSERIAL PRIMARY KEY,
    mime_type     VARCHAR(50) NOT NULL,
    image_base64  TEXT        NOT NULL,      -- the first logo is the school's own
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE report_type AS ENUM ('class_program', 'teacher_program', 'room_schedule');

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

-- Signature block, e.g. Prepared by / Conforme / Recommending Approval / Approved by
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

-- ---------------------------------------------------------------------
-- Audit trail
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- Helper views
-- ---------------------------------------------------------------------
-- Teaching load per teacher per term (4–5 subject limit)
CREATE VIEW teacher_load AS
SELECT t.id AS teacher_id, ss.term_id,
       COUNT(ss.id)                  AS subject_count,
       t.max_subjects,
       COUNT(ss.id) > t.max_subjects AS is_overloaded
FROM teachers t
JOIN section_subjects ss ON ss.teacher_id = t.id
GROUP BY t.id, ss.term_id, t.max_subjects;

-- Scheduled minutes vs required minutes per section subject
-- (flags e.g. Homeroom Guidance scheduled for more than 60 minutes)
CREATE VIEW subject_minutes_check AS
SELECT ss.id AS section_subject_id, ss.term_id, ss.section_id, s.name AS subject,
       s.minutes_per_week AS required_minutes,
       COALESCE(SUM(EXTRACT(EPOCH FROM (e.end_time - e.start_time)) / 60), 0)::INT
                                        AS scheduled_minutes
FROM section_subjects ss
JOIN subjects s ON s.id = ss.subject_id
LEFT JOIN schedule_entries e
       ON e.section_subject_id = ss.id AND e.status <> 'rejected'
GROUP BY ss.id, ss.term_id, ss.section_id, s.name, s.minutes_per_week;

-- Which sections use each room / building (room usage report)
CREATE VIEW room_usage AS
SELECT e.term_id, b.id AS building_id, b.name AS building, r.id AS room_id,
       r.room_number, r.room_name, e.section_id,
       COUNT(*) AS periods_per_week
FROM schedule_entries e
JOIN rooms r     ON r.id = e.room_id
JOIN buildings b ON b.id = r.building_id
WHERE e.status <> 'rejected'
GROUP BY e.term_id, b.id, b.name, r.id, r.room_number, r.room_name, e.section_id;

-- One status per section per term (dashboard, approvals, guest view)
CREATE VIEW section_term_status AS
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
           COUNT(e.id) FILTER (WHERE e.section_subject_id IS NULL) AS open_slot_count
    FROM school_terms t
    JOIN sections s ON s.school_year_id = t.school_year_id
    LEFT JOIN schedule_entries e ON e.term_id = t.id AND e.section_id = s.id
    GROUP BY t.id, s.id
) counts;
