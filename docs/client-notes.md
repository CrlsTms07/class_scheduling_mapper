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

Based on a reference prototype the team reviewed (removed from the repo on Nov 17, 2026).

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
- **SHS shift:** placing by hand keeps it a flag.
- **Bell schedule presets** of 8, 10, 14 or 16 rows fill an empty bell schedule. Bell schedules stay per
  school year, level and shift.
- **Color coding** on the schedule can be turned off; the choice is kept on the account.
- ~~**Auto-fill**~~: removed on Nov 17, 2026 (see below).

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
  copy another term or import a file) and "Add section".
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
  what is missing, with a button to each place.
- **Rooms & Buildings:** each room and building has Edit and Delete.
- **Lists:** Sections and Teachers have View, Edit and Delete on each row. A Master Teacher's filters offer
  Senior High grades only, and a Chairperson's Junior High grades only.

## Team decisions on the layout and building schedules by hand (Nov 11, 2026)

- **Layout:** the Schedule, classroom, section, Section Directory, Teachers Directory and teacher pages follow the
  team's layout: breadcrumbs, gray tabs for buildings and terms (the terms come from the school year), day by day
  cards with "+" to add, and Edit and Delete in side sheets. The plotter's timetable, drag and drop,
  flags and Submit stay, one tab away ("Daily schedule" or "Timetable" on the section page).
- **Typed times:** when building a schedule by hand, a class or a break is given its Start and End time. A time
  that matches a period uses it. A new time becomes a period (or break) of the department's bell schedule, so the
  conflict rules and the Class Program work the same way. With no bell schedule yet, the first typed
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

## Team decisions on guidance and accounts (Nov 13, 2026)

- **Subject minutes from an import:** a new subject takes the minutes most sections have in the file (for example
  220), not the largest. One section with an extra row no longer makes every teacher look overloaded.
- **Overload help:** each overload in Load Distribution says how to fix it (give a subject to another teacher, or
  raise the limit) with a link to the teacher's form.
- **Sign-ups:** the Admin still verifies accounts, since any DepEd employee has a @deped.gov.ph email. To keep it
  fast: "Activate selected as Teacher" for many at once, a banner on the Admin dashboard, and a sign-up whose name
  matches exactly one teaching personnel record becomes an active Teacher right away (read-only). Turn this off
  with `SCHOOL_AUTO_ACTIVATE_TEACHERS=false`. Chairpersons, Master Teachers and Admins are always set by the Admin.
- **Setup steps on the dashboard:** Rooms & Buildings → Bell schedule → Subjects & Sections → Teachers → Load
  Distribution → Plot, each with a check mark and a link.
- **After an import:** next steps (set home rooms, check subjects and teachers, check loads) and the rows left out
  as a CSV file to fix.
- **Flags say how to fix them**, for example "Science needs 40 more minutes a week".
- **"How to make a schedule"** guide for the Admin, Chairperson and Master Teacher, from the dashboard: every step
  from the school year to the printed forms, who does it and where. It can be printed.
- **Later (after the evaluation):** a shorter menu with a "Setup" group, so the layout does not change during testing.
- **Time Slots delete:** a period with classes can be deleted after a warning that names how many classes go with it
  (drafts only; their subjects can be placed again). Blocked while a section in it is pending or approved.
- **Continue with Google** on Sign in and Sign up, for @deped.gov.ph Google accounts only (Laravel Socialite). It
  proves the person owns the DepEd email. Email and password still work. Hidden until the Google client is set up.
- **Limits for a school Wi-Fi** (everyone shares one internet address): public schedule pages 300 a minute per
  address; sign-up, forgot and reset password 30 a minute per address and 5 per email; change password 10 a minute per
  account; sign-in stays 5 a minute per email and address, and 20 every 15 minutes per account.
- **Junior High and Senior High kept apart:** buildings (and their rooms) and activities belong to Junior High,
  Senior High or both (Shared / School-wide). A Chairperson sees and changes Junior High ones, a Master Teacher Senior
  High ones; both see and use the shared ones, which only the Admin changes. A section is offered only rooms of its
  department and shared ones. Room conflicts are still checked across the school, naming the other department only.
  Teachers stay shared. Existing buildings and activities were sorted by who uses them.
- **Database:** Neon for now; the steps to move to Supabase are ready in `docs/deployment.md` (Nov 15, 2026), with a
  daily keep-alive ping (`.github/workflows/keep-alive.yml`) so a free Supabase project is never paused. Earlier note: Supabase was considered: it would need no code change, but its free plan pauses a
  project after 7 days without use, and Render needs its Session pooler (IPv4).

## Team decisions on sign-in, privacy and layout (Nov 16, 2026)

- **Sign-in code:** after the password, a 6-digit code is sent to the DepEd email (valid 10 minutes, 5 tries, a new
  code once a minute). "Remember this device for 30 days" skips it on that browser. "Continue with Google" needs no
  code. It turns on by itself once real emails are sent (`SCHOOL_LOGIN_CODE=auto`), so no one is locked out before
  Gmail is set up; `true` or `false` forces it.
- **Data Privacy Notice (RA 10173):** its own notice and checkbox at sign-up and at the first sign-in, apart from the
  Terms and Conditions (`users.privacy_accepted_at`). Existing accounts are asked once.
- **Notifications** drop down from the bell at the top, on phones and computers.
- **Sign out** is at the bottom of the menu (sidebar and phone drawer), no longer in the header.
- **Start New School Year:** the dates start empty, each date is shown as dd/mm/yyyy with its weekday, and Next waits
  until both are set. The date fields use the device's calendar.
- **Teacher record on Users** (was "Personnel record"): links an account to its teacher record so My Schedule and My
  Profile work. Hidden for an Admin who has none; explains when no record is free.
- **Deploys** come from `main`: branch, pull request, merge, then Manual Deploy.

## Team decisions (Nov 17, 2026)

- **Auto-fill is removed**, with its code, API routes and the `auto_fill_runs` table (migration
  `2026_11_17_100000_drop_auto_fill`). Classes it placed before stay as drafts. Schedules are made by hand,
  by import from a file, or by copying another term.
- **One place to start a schedule:** "Import from a file" and "Copy another term's schedule" are only in
  **New schedule**, not on the Schedule page toolbar. The Copy choice uses the school year's word (Term,
  Semester or Quarter).
- **Times are 12-hour everywhere**, on screen and in inputs (7:00 AM, 1:30 PM), never 13:30. Any time from
  12:00 AM to 11:59 PM can be entered.
- **Placing a class offers only fitting periods:** free periods (teacher, room and section all free) whose
  length is not more than the subject's minutes per week still unplaced.
- **Front-end stack change approved by the team:** HTML + Tailwind CSS + vanilla JavaScript (Vite), with the
  same Laravel API and PostgreSQL. The React front end stays live until the new one passes the parity checklist.
- **Design audit approved** (all Must fix items): 14 px text on phones, a shorter menu that follows the setup
  steps (Main, Setup 1–6, Admin), the schedule first on phones, one view switch (Day cards or Weekly grid), icons
  with text, one main button color, one "Add / Edit class" dialog, searchable dropdowns, toasts and 12-hour time
  pickers. They are built into the new front end (`frontend-v2/`), module by module.
- **Free periods** (`GET /terms/{term}/sections/{section}/free-periods`, read only): the free days of each period
  for the section, a teacher and a room, with the reason for each busy day. The class dialog offers only these.
- **Dashboard bell schedule step:** counts only departments that have sections, like the Admin's setup checklist
  (it said "Not set up yet" for Senior High with no SHS sections).
- **Clean-up:** unused files removed (Neon CLI config at the root, unused components, the Nov 6 analysis, the
  reference prototype and the Laravel example tests).

## Team decision (Nov 18, 2026)

- **Exports are PDF and CSV; imports are XLSX and PDF.** Every report, the Class Program and My Schedule
  download as PDF (the official form) or CSV (the data). The XLSX download routes and the Excel formula
  totals were removed. The import template is the only XLSX, since it is filled in and uploaded back.
  Imports take an Excel workbook (.xlsx) or a PDF; .xls and CSV files are no longer accepted.
- **PDF import is not read yet:** a PDF is accepted by the file chooser, but the system asks for the Excel
  workbook instead, because reading tables out of a PDF needs a new library (see the suggestion in the
  progress report of Nov 18).
- **One web app:** the React app was removed and `frontend-v2/` was renamed `frontend/`. The React code
  stays in the Git history (commit `51a4cca`).
- **Clean-up:** columns no code used were dropped (`users.phone_number`, `grade_levels.period_minutes`,
  `departments.faculty_room_id`; migration `2026_11_18_100000_drop_unused_columns`), and so was the import
  template download, which no screen offered. "Tracks" on the Subjects page and "Edit lists" on the Teachers
  page add and delete tracks, departments, designations and tasks (a name still in use stays).
- **Look of the public and sign-in pages:**
  - Home page: the school's name, core values and seal, three short cards, and "Contact us" from the
    school profile, with a red footer. The small label on top reads "Department of Education" and the
    division from the school profile (now part of the public school details).
  - Sign in: the form on the left, the system's name and a picture on the right. "Sign in to your
    account", the "Forgot your password?" link beside the Password label, and an eye button to show or
    hide the password (also on Sign up and Reset password). "View as Guest" and "No account yet? Sign up".
  - The account page is named **Sign up** (not "Create account"); its button says "Sign up".
  - Guest view: a red welcome with the search, then "Browse all sections", which lists every section by
    grade, with buttons for the department and grade level.
- **Header:** a round picture with the user's initials (Carlos Tomas: "CT"), the name, and the role as a
  red badge: Admin, GLC, MT or Teacher.
- **Notifications:** at the top center of the screen, saying "Success", "Failed" or "Notice", and shown
  above an open dialog too.

## Team decisions (Nov 19, 2026)

- **Time blocks only:** a class is placed by choosing one of the periods of the bell schedule. "Type another
  time" was removed with its endpoint (`POST .../periods`, `PeriodService`). New times are added on the Time
  Slots page. Every period shows as a block: **Available**, **Selected**, or **Full / Too long** (disabled,
  with the reason, e.g. "Teacher Sample 1 is teaching Grade 7 – Sample B"). The blocks are checked again every
  30 seconds and when the window comes back, and right after a save that someone else beat.
- **Problems show while working, not only on Save:** every form checks each field as it is filled in (required
  fields and each field's own rule). On Time Slots, a period or break that overlaps another row says so while
  the time is being chosen.
- **Time block templates:** the Time Slots preset has "Minutes between periods" (a passing time) next to the
  minutes per period, so 1-hour or 1.5-hour blocks with a gap can be made without code.
- **Lists:** names of tracks, departments, designations and tasks must read like a name (at least one vowel
  unless a short form in capitals like SSG, no symbols, no key held down) and must not repeat in other letters;
  checked while typing and again in the API (`App\Rules\ReadableName`). Done does not close while a typed name
  was not added.
- **Empty results say why:** a filtered list with nothing in it names the search and the filters that are on,
  with "Clear search and filters". The focus outline is teal, so it is never mistaken for an error.
- **Subject name** is a searchable list of the names already used, and a new name can be typed ("Use").
- **Role badge with the department:** "GLC · JHS" or "MT · SHS" under the user's name. A Chairperson still sees
  every teacher, since teachers move between Junior and Senior High.

## Team decisions (Nov 21, 2026), after the beneficiary's review (docs/paper/Update_Info for changes.pdf)

- **No schedule import:** "Why import if the system is for making schedules?" The schedule import from Excel
  (`POST /terms/{term}/schedule-import`, `ScheduleImportService`, `ClassProgramReader`) and "Import from a file" in
  New schedule were removed. Schedules are made by hand or copied from another term.
- **Master-data import instead** (Admin only), so teachers, subjects, rooms and sections are not typed one by one
  every year. Each has an Excel template with the exact headers, one example row and a "How to fill in" sheet.
  The upload is checked row by row first (new, update, skip or error, with the fix, e.g. "Row 12: department
  "TLE-ICTT" does not exist."); a key twice in one file is an error; the user chooses Skip or Update for records
  already in the system; nothing is saved until Import, and the import runs the same checks in one transaction.
  Records can still be added and edited on their own pages.
- **Imports are XLSX; a PDF is accepted but answered with "use the Excel template"** until a PDF reader is approved.
  Exports stay PDF and CSV.
- **Employee ID** (`teachers.employee_id`, unique in any letter case) is the teacher key of the import, and a field
  on the Teachers form. A teacher encoded by hand with the same name and no ID gets the ID instead of a second record.
  A row with a DepEd email gives an active Teacher account (Google sign-in or Forgot password).
- **Setup Guide** (`/setup`, Admin menu after Dashboard): the steps before a schedule, in order, each with its status,
  count, what it needs first ("Add teachers first (Step 4).") and a button to its page or its import. Teacher Loading
  is its own step, since plotting needs it. Step 10 offers the existing "Copy from another term".
- **Later (after the evaluation, before the December defense):** teacher specialization (`teacher_subjects`, from the
  beneficiary's ERD) with "qualified first" in the class dialog's teacher list; reading PDF imports.

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
