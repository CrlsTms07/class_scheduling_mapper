# Client notes — ERCIHS Class Scheduling System

Source: client interview recordings (Rhessie, Jeiel). Timestamps are from the recordings.
Last updated: Nov 6, 2026.

## Requested features and how the system handles them

| # | Client request | Decision / design | Priority |
|---|----------------|-------------------|----------|
| 1 | Term-based structure (First, Second, Third term), each with an end date; easy to go back to 2 terms if DepEd reverts (Rhessie 03:03, 16:48–17:04; Jeiel 04:10–04:16) | `school_years.term_count` (2 or 3) and `school_terms` with name, start and end dates. No hard-coded "3". | Must |
| 2 | Copy schedule from one term to the next; same time slots, only subjects are edited (Jeiel 07:21–07:41) | "Copy to next term" creates draft open slots (same day, time, room). Continuing subjects are auto-filled. | Should |
| 3 | View a section's schedule across terms (Term 1, 2, 3) and grade levels (Rhessie 17:48–18:06) | Term selector and grade level filter on every schedule view. | Must |
| 4 | Adviser per section (Rhessie 18:24–18:40) | `sections.adviser_id`; one advisory per teacher per school year. | Must |
| 5 | Approver's name appears automatically on generated schedules, or can be encoded (Rhessie 18:54–19:02) | Auto from the Admin who approved; editable through `report_signatories` (Prepared / Approved / Noted by). | Must |
| 6 | Three generated schedules: class program, teacher program, room schedule; see which sections use each room or building (Rhessie 07:22, 24:39–28:08) | 3 reports in PDF/XLSX, plus a room and building usage summary. | Must |
| 7 | Conflict flagging and reports, e.g. a section's schedule (Rhessie 15:53; Jeiel 07:03, 13:29) | Hard conflicts are blocked. Soft issues are flagged in the plotter and listed in the Conflict and Validation Report. | Must |
| 8 | Teacher profile with educational qualification; maybe include non-teaching personnel (to verify) (Rhessie 08:00, 11:11–11:35) | `teacher_qualifications`; `personnel_type` = teaching / non_teaching. | Must (qualification), verify (non-teaching) |
| 9 | AM/PM shift for teachers and sections; Homeroom Guidance limited to 1 hour; break times can be set (Rhessie 19:24–20:04) | `shift` on teachers and sections; Homeroom `minutes_per_week = 60` with a flag if exceeded; `time_slots` with `is_break`. | Must |
| 10 | Sectioning: Admin encodes sections first (they change yearly), then they can be selected, including the track (Academic, TechPro, …) (Rhessie 16:12–16:29) | Admin-only section management per school year; `tracks` table. | Must |
| 11 | Strengthened SHS: fewer electives in Grade 12; subjects per term, not per semester (Rhessie 02:22–03:03) | `subjects.term_no`, `track_id`, `subject_type` (core/elective). | Must |
| 12 | Roles: one scheduler for SHS; JHS per grade level according to Rhessie 20:39 (matches client update: one GLC for JHS, one Master Teacher for SHS) | `user_grade_levels` scope supports both one GLC for all JHS and one GLC per grade. **Confirm which.** | Must |
| 13 | System must keep up every school year and stay flexible, e.g. ready if DepEd goes back to 2 terms; maybe a button for this | "Start New School Year" wizard with term presets (3 Terms / 2 Semesters / 4 Quarters / Custom); subjects per school year; copy setup from the previous year | Must |
| 14 | Fully responsive: phone portrait and landscape | Mobile-first layouts; card lists on phones; plotter uses day tabs + bottom sheet in portrait, grid in landscape | Must |
| 15 | Names on the schedule form (signatories) must be inputtable; sample JHS Class Program shows Prepared by (Head Teacher III), Conforme (Class Adviser), Recommending Approval (School Principal II), Approved by (PSDS Cluster IV) | `report_signatories` per term, document type and level; Conforme auto-filled from the section adviser; header/footer from `school_profile` and `report_settings` | Must |
| 16 | Schedule format should be enhanced and look better in the system | Enhanced interactive on-screen view; printed PDF/XLSX keeps the official structure but cleaner (auto totals, signature grid, document control footer). Mon–Thu and Friday bell schedules handled by `day_patterns` | Must |

## Team decisions on the schedule-creation flow (Nov 9, 2026)

Based on the reference prototype in `docs/reference/scheduling-demo-v2.html`.

- **Four steps** on the Chairperson / Master Teacher dashboard: Subjects & Sections → Teachers →
  Load Distribution → Plot, each with its progress, plus **Import previous data**.
- **Import previous data** copies only the teacher loading of the user's grade levels, from any
  earlier term (also last school year, matched by grade and the names of the section and subject).
  Subjects, activities, bell schedules and sections already belong to the school year; the Admin's
  Start New School Year wizard copies them. Plotted schedules are never imported.
- **Activities** (Flag Ceremony, Catch-up Friday...) are kept apart from subjects: no teacher, room or
  minutes. They can be applied to one section, a grade level or all sections. A class they replace
  goes to **Unplaced** (its teacher loading stays). Recess and lunch stay as breaks of the bell schedule.
- **Teacher program:** shows the activities of the teacher's advisory class and those that every
  section has at the same time. Activities do not count as teaching minutes.
- **Load Distribution:** hours a week from the teacher loading, against a limit per teacher
  (`teachers.max_hours_per_week`, default 30). The subject limit (`max_subjects`) stays as well.
- **Changing the teacher in the plotter** changes the teacher loading of that subject in the section,
  so all its periods follow. A conflict lists up to 5 free teachers.
- **SHS shift:** placing by hand keeps it a flag; auto-fill never places outside a shift.
- **Bell schedule presets** of 8, 10, 14 or 16 rows fill an empty bell schedule. Bell schedules stay per
  school year, level and shift.
- **Color coding** on the schedule can be turned off; the choice is kept on the account.
- **Auto-fill** (greedy, no backtracking for now): preview first, saved as drafts in one transaction,
  can be undone per run. No queue is needed: a whole school fills in about a second.

## Team decisions on roles, menus and exports (Nov 10, 2026)

- **Menu:** Main (Dashboard, Schedule, Teacher Loading), Manage (Teachers, Sections, Subjects, Rooms &
  Buildings, and Users & Roles for the Admin), Approvals (Admin), Reports, My Records (GLC/MT with a
  personnel record) and Settings (Admin: School Years, Time Slots, Report Settings).
- **The Admin can plot** any section, and manages subjects too.
- **GLC and Master Teacher manage sections** of their own grade levels (answers open question 9).
- **Teachers get a dashboard:** next class, today's classes, teaching time a week and advisory.
- **Exports:** CSV is added beside PDF and XLSX.
- **Import from a file:** a schedule template (CSV or XLSX) that is filled in, uploaded, previewed and
  imported as drafts.
- **Guest search:** by section or adviser name only. No student names (minors).
- **Landing page:** ERCIHS logo, school details from Report Settings → School profile (Admin edits them).
- **Junior High and Senior High stay apart:** a Chairperson does not see Senior High details, and the
  Master Teacher does not see Junior High details. A room or teacher shared with the other department
  shows only "Junior High section" or "Senior High section". The Admin sees everything.
- **Name:** "ERCIHS Scheduling System" in the browser tab, header, login and landing page. Signing out
  returns to the landing page.
- **Shared teacher directory:** every teacher is listed for the Chairperson and the Master Teacher, since some
  teach in both departments. A teacher who teaches only in the other department is view only; the Admin
  edits that record.
- **New schedule:** the Schedule page has "New schedule" (choose the section, then build on the timetable,
  auto-fill, copy another term or import a file) and "Add section".
- **Import from the school's own class program workbook** (the "G11/G12 _CP" sheets, sections side by side,
  four lines per class): uploaded as it is in Import from a file, read into one row per class, and checked
  in the same review. Teachers match by first initial and last name ("J. DELA CRUZ"), subjects ignore case
  and dots, rooms match "C 401" or "401". Times without AM or PM from 1:00 to 5:59 are read as PM.
- **Set up from the file, then use it or not:** when a file names sections, subjects, teachers or rooms the
  system does not have, the review lists them. "Set these up from the file" creates them (sections of the
  user's grade levels only; a Monday – Friday bell schedule from the file's periods only when the department
  has none; subjects with the minutes a week in the file; teachers with their name only, to be completed in
  Teachers; "C 401" goes to "Building C"). Nothing is saved until "Use this schedule"; "Don't use it" leaves
  everything as it was. Used classes are drafts, edited in the plotter, then submitted.
- **The Chairperson and Master Teacher make the schedules, so every step is theirs:** they also set up the
  bell schedules (Time Slots) of their own department, Junior High or Senior High. The Admin follows the same
  four steps on the dashboard and can still plot, approve, reject and reopen.
- **Plotter:** until a section has a bell schedule and teacher loading, a "Before you can plot" checklist shows
  what is missing, with a button to each place. Auto-fill says what it does: it places the subjects not placed
  yet into free periods (priority subjects first, never where the teacher, room or section is busy), shows a
  preview, and can be undone.
- **Rooms & Buildings:** each room and building has Edit and Delete.
- **Lists:** Sections and Teachers have View, Edit and Delete on each row. A Master Teacher's filters offer
  Senior High grades only, and a Chairperson's Junior High grades only.

## Team decisions on the layout and building schedules by hand (Nov 11, 2026)

- **Layout:** the Schedule, classroom, section, Section Directory, Teachers Directory and teacher pages follow the
  team's layout: breadcrumbs, gray tabs for buildings and terms (the terms come from the school year), day by day
  cards with "+" to add, and Edit and Delete in side sheets. The plotter's timetable, drag and drop, Auto-fill,
  flags and Submit stay, one tab away ("Daily schedule" or "Timetable" on the section page).
- **Typed times:** when building a schedule by hand, a class or a break is given its Start and End time. A time
  that matches a period uses it. A new time becomes a period (or break) of the department's bell schedule, so the
  conflict rules, the Class Program and Auto-fill work the same way. With no bell schedule yet, the first typed
  time starts one (Monday – Friday). A time that overlaps another period or a break is refused and says which.
  Breaks belong to the bell schedule, so the other sections on it get them too.
- **Rooms:** "+ Add Section" on a room card makes that room the section's home or usual room. Each building has a
  view of all its rooms and the sections that use them, which prints as that building's room usage.
- **Teachers shared by both departments:** a Junior High teacher can be given a Senior High class (and the other
  way around); from then on both the Chairperson and the Master Teacher can edit that teacher and schedule them.
- **Sign-up:** the Terms and Conditions (including the Data Privacy Act) must be accepted; the time is kept.
- **Fresh start for the import:** `php artisan app:clear-school-data` empties sections, teachers, subjects, rooms,
  bell schedules, loading, schedules and the audit log, and keeps accounts, school years, settings and the short
  form lists. Laravel's unused queue tables (jobs, job_batches, failed_jobs) were removed.

## Team decisions on importing (Nov 12, 2026)

- **Any Excel file name:** Import reads every sheet of an .xlsx or .xls workbook and finds the schedules by their
  TIME column and day headings: the SHS class program, the JHS class program per section ("Monday – Thursday" and
  "Friday" blocks), and the Teachers Program (the section in each cell, under "NAME OF TEACHER" and "SUBJECT").
  The grade comes from the sheet, a "GRADE 9" heading or the file name. Short subject names (AP, VE, ESP, HGP,
  TLE) match the full names. The CSV and XLSX template buttons were removed from the import sheet.
- **PDF:** not read yet (a PDF keeps no table columns, so times, subjects and teachers mix up). The import says to
  save the schedule as an Excel workbook. To be looked at after the evaluation.

## Team decisions on accounts, forms and rooms (Nov 12, 2026)

- **One teaching load for everyone:** every teacher's maximum is 5 subjects (`SCHOOL_MAX_SUBJECTS`, default 5).
  The teacher form shows it instead of asking for it.
- **Subject Type:** only the Master Teacher (SHS) sees it. GLCs (JHS) do not.
- **Emails through the school's Gmail:** Gmail SMTP on a computer or paid hosting, the Gmail API on Render's free
  plan (it blocks SMTP). The reset email shows the school's name and logo, one button and how long the link lasts.
- **Admin reset password:** when the email does not arrive, the Admin gives a temporary password from the Users
  page. The person must choose a new one at the next sign-in.
- **Backup:** `php artisan app:backup` saves the whole database as one file.
- **Class Program PDF:** follows the official JHS form: "Republic of the Philippines" and "Department of
  Education" in Old English style, region and division, one Teacher column, totals with "Inclusive of HGP",
  reference notes, 2×2 signatures, and footer logos (each logo is set to the top or the footer in Report Settings).
- **Adviser Summary:** a new report (Reports → Advisers, and "Adviser summary" on the Sections page). One table per
  grade, two grades side by side: #, Section, Room Assignment, Adviser, Co-Adviser. PDF, XLSX and CSV.
- **Room in charge:** each room can name who looks after it. The building view shows the rooms floor by floor
  (the floor comes from the room number: 101 is the 1st floor), with a list view as well.

## Open questions for the client

1. **JHS scheduler (item 12):** One GLC for all of Grades 7–10, or one GLC per grade
   level? (Rhessie 20:39 suggests per grade level; the latest update says one GLC.)
2. **Non-teaching personnel (item 8):** Why are they in the system? Teaching-related
   tasks only, or also a listing? Do they need login accounts?
3. **Item 3:** Does "iba't ibang grade level" mean viewing a section's history over the
   years (e.g. 7-Rizal last year → 8-Rizal this year), or just filtering by grade level?
4. **Signatories (item 5):** Who signs the official forms? Prepared by (GLC / Master
   Teacher)? Approved by (Principal or system Admin)? Noted by?
5. **Homeroom Guidance (item 9):** Is the limit 1 hour **per week** or **per day**?
6. **Periods and breaks:** SHS period length? Exact recess and lunch times per shift?
   Is JHS also split into AM/PM shifts?
7. **Tracks (items 10–11):** Complete list of tracks (and strands, if any) offered at
   ERCIHS? Which electives belong to each track per term?
8. **Teacher shift:** Can a teacher teach in both AM and PM shifts (whole day)?
9. ~~**Sections:** Only the Admin creates sections, or can the GLC / Master Teacher too?~~ Team decision,
   Nov 10, 2026: the GLC and Master Teacher manage the sections of their own grade levels.
10. **Copy term (item 2):** Should the copy also keep the same teachers for subjects that
    continue?
11. **Guest view:** ~~Is it okay for teacher schedules to be public?~~ Team decision, Nov 7, 2026:
    only the adviser and co-adviser are named publicly, so teachers of subjects stay private. Confirm
    with the client. Still open: should schedules appear automatically after approval, or be released
    by the Admin all at once?
12. **Signatories:** Is "Prepared by" always the Head Teacher (not the GLC)? Are the
    signatories the same for SHS, and for the teacher program and room schedule?
13. **Bell schedule:** Are the Mon–Thu and Friday times the same for every JHS grade
    level? What is the SHS bell schedule per shift?
14. **Official forms:** Please provide blank copies (Excel or photo) of the class
    program, teacher program and room schedule formats.
