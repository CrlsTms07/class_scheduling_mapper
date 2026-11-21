# CLAUDE.md — Class Scheduling System (ERCIHS)

Capstone project of BSIT students, Cavite State University – Trece Martires City Campus.
Web system for creating conflict-free class schedules for **Emmanuel Resurreccion
Congressional Integrated High School (ERCIHS)**, a DepEd public high school.

**Deadline:** feature-complete and deployed by **Nov 22, 2026**. Testing and ISO 25010
evaluation run **Nov 23–29, 2026**. Prefer working, tested features over many half-done ones.

Read these first:
- `docs/schema.sql`: database design (source of truth)
- `docs/ERD_Class_Scheduling_System(11-18-26).png`
- `docs/client-notes.md`: client requests, decisions and open questions

---

## Tech stack (do not change without asking)

| Layer     | Tech |
|-----------|------|
| Front-end | HTML + Tailwind CSS v4 + plain JavaScript (ES modules, JSDoc with `// @ts-check`), built with Vite; `lucide` icons, `qrcode` (team decision, Nov 17, 2026: replaces React + TypeScript) |
| Back-end  | PHP + Laravel (REST API only), Laravel Sanctum (SPA cookie auth), Laravel Socialite (Google sign-in, approved Nov 13, 2026), spatie/laravel-permission, Laravel Excel (CSV exports, XLSX import), barryvdh/laravel-dompdf (PDF) |
| Database  | PostgreSQL (with `btree_gist` extension) |
| Testing   | Pest (back-end), Vitest + jsdom and Playwright (front-end) |
| Tools     | Git + GitHub, VS Code |

## Repository layout

```
/frontend         The web app (HTML, Tailwind CSS, plain JavaScript)
/backend          Laravel API
/docs             schema.sql, ERD_Class_Scheduling_System(11-18-26).png, client-notes.md, forms/ (official templates)
CLAUDE.md
```
<!-- Adjust the folder names above if the actual project differs. -->

## Common commands

```bash
# backend
cd backend
composer install
createdb ercihs_scheduling_updatedDB   # once; also: createdb ercihs_scheduling_test (Pest wipes it)
php artisan migrate:fresh --seed
php artisan serve                 # http://localhost:8000
./vendor/bin/pest

# web app
cd frontend
npm install
npm run dev                       # http://localhost:5173
npm run test                      # Vitest
npm run build
npm run test:e2e                  # Playwright; only against a throwaway database (see docs/deployment.md)
```

## Current status (Nov 18, 2026)

- **Front-end, working with the API:** login, sign-up, forgot and reset password, route
  guards, role-based menu, responsive layout with phone drawer. Tests: `npm run test`.
- **Working, JHS flow:** section list, plotter (tap-to-assign and drag-and-drop, also to move a placed class, conflicts with suggestions, flags),
  term selector, submit with flag acknowledgements, approvals by scope (approve, reject, reopen),
  revise after rejection, and Class Program PDF.
- **Working, Admin:** School Years page, Start New School Year wizard, Calendar settings and
  switching the active term; Time Slots page (bell schedules, periods, breaks, copy);
  Sections page (yearly encoding, tracks, advisers, home rooms); Users page (activate, decline,
  change access, deactivate, reactivate, delete); Report Settings page (school profile and logos,
  document control block, signatories per term); Admin Dashboard (counts, setup checklist,
  schedules by grade level, overloaded teachers).
- **Working, Admin, Chairperson and Master Teacher:** Teachers page (personnel, qualifications, tasks
  per term) and Buildings and Rooms page.
- **Working, Chairperson and Master Teacher within scope (Admin views):** Subjects page (per school
  year, term, track, minutes per week); Teacher Loading page (per section and term, quick-add teacher,
  locks with pending or approved schedules, copy from another term).
- **Working, Schedule module:** Building tabs, room cards, Room Schedule page, and plotter with day
  cards (team decision, Nov 7, 2026: the default on wide screens) and the weekly grid as a choice.
- **Working, Copy schedule:** from another term of the year, by section, grade or all, with a review
  first. Periods become draft open slots; teachers and subjects that continue can be filled in.
- **Working, Reports page:** JHS and SHS Class Program, Teacher Program, Room Schedule, room usage, the
  Conflict and Validation Report, Teacher Load Report and Grade Level Timetable, in PDF and CSV. Teacher Program and Room Schedule have no official form yet, so their layout is to be
  confirmed with the school.
- **Working, Teacher:** My Schedule (approved entries only, PDF and CSV) and My Profile. Chairpersons
  and Master Teachers with a personnel record have them too.
- **Working, Chairperson and Master Teacher:** dashboard with their own counts and next steps.
- **Working, Guest:** pick department, grade and section; approved schedules of the active term only;
  Print, PDF, shareable link and QR code.
- **Working, schedule-creation flow (team decisions, Nov 9, 2026, see `docs/client-notes.md`):**
  four steps on the scheduler dashboard with Import previous data (teacher loading only), activities
  applied to a section, grade or all sections with an Unplaced list, Load Distribution in hours a week
  (`max_hours_per_week`, default 30), free teachers on a conflict, bell schedule presets (8/10/14/16 rows),
  and color coding per user. (Auto-fill was removed, team decision, Nov 17, 2026.)
- **Working, layout and hand-built schedules (team decisions, Nov 11, 2026, see `docs/client-notes.md`):**
  breadcrumbs and term tabs, classroom and section pages with day cards (typed Start/End times were replaced by
  time blocks only, team decision, Nov 19, 2026), break times, "+ Add Section" on rooms, building view with print,
  Section and Teachers Directories, teacher detail, Terms and Conditions at sign-up, and
  `php artisan app:clear-school-data` for a fresh import.
- **Working, accounts, forms and rooms (team decisions, Nov 12, 2026, see `docs/client-notes.md`):** one
  maximum load of 5 subjects, Admin reset password with a required change, Gmail email (SMTP or Gmail API),
  `php artisan app:backup`, the Class Program PDF matching the official form, logo placement, the Adviser
  Summary report, room "in charge" and the building floor plan.
- **Working, guidance and accounts (team decisions, Nov 13, 2026, see `docs/client-notes.md`):** "How to make a
  schedule" guide (`/guide`, button on the Schedule page), setup steps from rooms to plotting, flags and overloads that say
  how to fix them, next steps after an import, bulk "Activate selected as Teacher", auto-activation of sign-ups on
  the teachers list, deleting a time slot with its draft classes, and "Continue with Google" (Laravel Socialite,
  @deped.gov.ph only), and Junior High and Senior High keeping their own buildings, rooms and activities
  (`buildings.department`, `activities.department`; NULL = shared, Admin only; see `App\Support\DepartmentScope`).
- **Working, sign-in and privacy (team decisions, Nov 16, 2026, see `docs/client-notes.md`):** 6-digit sign-in code
  to the DepEd email with "Remember this device for 30 days" (`LoginCodeService`, `SCHOOL_LOGIN_CODE=auto`), a
  separate Data Privacy Notice (RA 10173) with its own checkbox, notifications under the bell, Sign out at the
  bottom of the menu, empty dd/mm/yyyy school year dates, and deploys from `main`.
- **New web app, done (team decision, Nov 17, 2026):** `frontend/` (HTML, Tailwind CSS and plain JavaScript
  with Vite) has every module of the parity checklist: sign-in with the 6-digit code and Google, sign-up, forgot,
  reset and forced password change, the frame (setup menu in step order, term picker, alerts, dark mode button),
  shared components (centered dialog, searchable select, 12-hour time picker, toasts, skeleton loaders), every
  dashboard, the Schedule module and plotter (only free periods that fit the subject's remaining minutes are
  offered), Teacher Loading, Approvals, Reports (PDF and CSV), every setup and Admin page, My Schedule, My
  Profile, the guide and the Guest view with QR codes. Tests: 100 Vitest and 44 Playwright (sizes 360×640,
  844×390, 1366×768). It was built as `frontend-v2/`; on Nov 18, 2026 the React app was removed (still in the
  Git history, commit `51a4cca`) and the folder was renamed `frontend/`.
- **Beneficiary review (team decisions, Nov 21, 2026, see `docs/client-notes.md` and
  `docs/paper/Update_Info for changes.pdf`):** no Excel import of any kind (schedules or master data; exports stay
  PDF and CSV). One process in one order on the Setup menu and the Dashboard: 1 Teachers, 2 Subjects, 3 Sections,
  4 Rooms & Buildings, 5 Teacher Loading, then Make the schedule (the Setup Guide page, the separate setup
  checklist and the "How to make a schedule" page were removed). Teachers: department required, `employee_id`,
  no typed "most hours a week" or "name on printed forms" (printed names come from the record), and a 6th subject
  is refused with "Full load". Class times are chosen while plotting: a typed start and end becomes a period of the
  section's bell schedule (`PeriodService`, `POST /terms/{term}/sections/{section}/periods`); Time Slots is the
  optional "Class Hours" page. Subjects are names only (no grade, no typed minutes; migration
  `2026_11_21_110000_subjects_name_only`): "Add a subject" in Teacher Loading joins subject, section and teacher,
  minutes are counted from the schedule, and the only minutes rule left is Homeroom at most 60.
- **Screen review (team decisions, Nov 21, 2026, afternoon, see `docs/client-notes.md`):** live checks in every form
  (`lib/calendar-rules.js` for school years and terms); the school year name comes from its dates; no Copy step;
  teaching personnel only (non-teaching is a stated limitation); no employee ID or education; departments and
  designations edited in their dropdowns (`searchableSelect` `manage`); Subjects & Class Hours as one step with
  Senior High details for the Admin only; activities added in the class form; school details and logo built in
  (`App\Support\SchoolProfile`, `config/school.php`, `resources/images/ercihs-logo.png`); 4 fixed signatories
  (`PUT /terms/{term}/signatories/slots`); buildings "Used by".
- **Back-end:** migrations, seeders, auth, plotter, approvals and JHS Class Program PDF are done.
- **Deployment:** Render (one Docker service for Laravel and the web app) with a Supabase database (Neon as a
  fallback). Steps, including
  the first Admin (`php artisan app:create-admin`), are in `docs/deployment.md`.

---

## Domain rules

### School calendar and yearly flexibility (client requirement)
- The system must keep working **every school year** and adapt to DepEd changes
  (e.g. going back to 2 semesters) **without code changes**.
- A **school year** has `term_count` (1–4) and `term_label` ("Term", "Semester",
  "Quarter"). Never hard-code "3" or the word "Term" in code or UI. Read them from the DB.
- Every term has a name, a start date and an **end date**. Only one term is active.
- **Subjects are per school year** (`subjects.school_year_id`), so curriculum changes
  never alter past records. Tracks, rooms, buildings and teachers are reused across years.
- **"Start New School Year" wizard** (Admin, one button on the Terms page):
  1. Enter the school year name and dates.
  2. Pick the term structure with preset buttons: **3 Terms (current DepEd)**,
     **2 Semesters**, **4 Quarters**, or Custom. Terms are generated with editable dates.
  3. Choose what to copy from the previous year (checkboxes): subjects, time slots and
     breaks, report signatories. Sections are **not** copied (they change yearly). Offer
     "copy section names with grade + 1" as an option.
  4. Review the summary, then confirm. Run in one DB transaction and write an audit log.
- **Changing the term structure later:** allowed in a "Calendar settings" page. Removing
  a term is blocked if that term already has schedules (show which ones).

### Departments and roles
- **JHS (Grades 7–10)**
  - Scheduled by the **Grade Level Chairperson (GLC)**.
  - Fixed home rooms, Monday–Friday.
  - **Period lengths vary** (e.g. 45 and 80 minutes, 20-minute break and lunch).
  - **Mon–Thu and Friday use different bell schedules.** Friday has shorter 40-minute
    periods plus HGP. See "Time slots" below.
  - Main concern: teacher conflicts.
- **SHS (Grades 11–12)**
  - Scheduled by **one Master Teacher**.
  - Uses **Strengthened SHS** rules: subjects are **per term**, Grade 12 has fewer
    electives, and sections and subjects can belong to a **track** (Academic, TechPro, …).
  - Rooms are not fixed. Main concern: room conflicts.
  - PE and Homeroom are priority subjects.
- **Scope of a GLC or Master Teacher** = the grade levels assigned in `user_grade_levels`.
  This supports both "one GLC for all of JHS" and "one GLC per grade level" (still being
  confirmed with the client). Every query and policy must filter by this scope.

| Role | Access |
|------|--------|
| `super_admin` (Admin) | **Can also plot any section** (team decision, Nov 10, 2026). Manages school years and terms, time slots and breaks, sections, teachers, subjects, rooms, users, roles and scopes, and report signatories. Approves, rejects or reopens schedules. Views everything. |
| `glc` | Within assigned JHS grade levels: teacher loading, plot schedules, submit for approval, reports and exports. Manages teachers, **sections of their grade levels** (team decision, Nov 10, 2026), subjects, rooms, and the **bell schedules (Time Slots) of their department** (team decision, Nov 10, 2026: they make the schedules, so every step is theirs). |
| `master_teacher` | Same as `glc`, for assigned SHS grade levels. |
| `teacher` | Read-only: own schedule (weekly and list view) and own profile. |
| Guest (no login) | Approved schedules of the active term only (see Guest view). |

### Accounts
- Emails must be official DepEd emails (`@deped.gov.ph`). Validate in the API and the form.
- Sign-up creates a `pending` account. The Admin activates it and assigns a role and scope.
- Login, logout, forgot password and reset password are required.

### Personnel (teachers)
- `teachers` holds both **teaching** and **non-teaching** personnel (`personnel_type`).
  Only `teaching` personnel can be assigned to subjects or as advisers.
- A personnel record may exist **without a login account** (`user_id` is nullable).
- **Quick-add teacher:** in the plotter's teacher dropdown, typing a name that does not
  exist offers "+ Add new teacher". This creates a minimal teacher record (name only, to
  be completed later). Never store teacher names as free text on schedule entries.
- Profile includes department and designation (both required), **shift (AM/PM/WHOLE_DAY)**, max subjects
  (5) and teaching-related tasks (ICT/SSG Coordinator, Lab Manager) per term. Teaching personnel only, and no
  educational qualifications (team decisions, Nov 21, 2026).

### Sections
- Encoded once per **school year** (they change yearly) by the **Admin**, or by a GLC or Master Teacher
  for their own grade levels (team decision, Nov 10, 2026). Each has a
  grade level, an optional track (SHS), a shift, an **adviser** (one advisory per
  teacher per year), an optional **co-adviser**, a home room (JHS) or optional usual room (SHS; team decision, Nov 7,
  2026: the plotter's default, each class can still use another room) and a class size.
- Teacher loading (`section_subjects`) is **per term**: section + subject + teacher.

### Day patterns, time slots and breaks
- A **day pattern** groups days that share one bell schedule, per school year, level and
  shift. Example (JHS): "Monday – Thursday" = days {1,2,3,4}, and "Friday" = {5}.
  - A day must not belong to two patterns of the same year, level and shift (check in the app).
- `time_slots` = the periods and breaks of a pattern, each with its own start and end.
  Lengths may differ.
- The Admin edits patterns and slots, with a "copy pattern" button. A GLC or Master Teacher edits those of
  their own department (JHS or SHS), since they make the schedules (team decision, Nov 10, 2026).
- Class times are chosen while plotting (Nov 21, 2026): a typed start and end uses the matching period or
  becomes a new one of the section's pattern (a day with none gets one), so time slots need no setup first.
- The plotter shows the slots of the selected pattern. A subject placed in a pattern is
  saved as one `schedule_entries` row **per day** of that pattern. Each entry must
  match a slot of its day's pattern and must not overlap a break.

---

## Conflict detection and flagging

**Hard rules: saving is blocked.**
- Enforced by PostgreSQL exclusion constraints on `schedule_entries`:
  - `no_teacher_conflict`
  - `no_room_conflict`
  - `no_section_conflict`
- They apply to the same term, same day and overlapping `[start, end)` time.
  Rejected entries are ignored.
- The API checks first and returns a **422** that says who or what conflicts and when,
  plus suggested free slots or rooms. It also catches SQLSTATE `23P01` and turns it into
  the same message.

**Soft rules: entry is saved but flagged** (red or amber badge in the plotter, and listed
in the Conflict and Validation Report). Submitting is blocked until fixed or
acknowledged:
- **Homeroom Guidance is over 60 minutes** a week (`config('school.homeroom_minutes')`, from the
  `subject_minutes_check` view). Other subjects have no typed minutes since Nov 21, 2026 (beneficiary
  review): their minutes are counted from the schedule and are not a flag.
- The entry is outside the section's or teacher's shift, or overlaps a break.
- The teacher is over `max_subjects` (`teacher_load` view). Since Nov 21, 2026 a 6th subject is refused in
  Teacher Loading ("Full load"), so this flag only shows for older data.
- The section has no adviser, or an open slot is still unfilled.

## Copy schedule to the next term
- Admin, GLC or Master Teacher picks a source term and a target term (and a scope).
- The system copies `schedule_entries` as **draft "open slots"**: same day, time and
  room, but `section_subject_id` and `teacher_id` are NULL. `copied_from_id` points to
  the source entry.
- It optionally copies the teacher loading of subjects that continue to the next term,
  and fills those slots automatically.
- The user only edits or chooses the subjects. Open slots cannot be submitted.

## Schedule and approval flow
`draft` → GLC or Master Teacher **submits** → `pending` → Admin **approves** or
**rejects** (rejection needs remarks).

- Scopes:
  - one **section**
  - one **grade level**
  - the whole **JHS** or **SHS**
  - **all** pending schedules of a term
- One Admin click = one `schedule_reviews` row. Update all matching entries in **one
  transaction** and set their `review_id`.
- Before approving, show a summary: number of sections and entries, and any flagged or
  incomplete sections.
- Approved entries are locked. The Admin can **reopen** them, with a reason.

## Generated schedules (reports)
Three main documents, in **PDF and CSV** (team decision, Nov 18, 2026: every export is PDF or CSV; imports are XLSX or PDF), matching the school's official
forms in `docs/forms/`:
1. **Class Program**: per section.
2. **Teacher Program**: per teacher, with total teaching minutes.
3. **Room Schedule**: per room. Also a **room and building usage** summary showing which
   sections use each room and building (`room_usage` view).

Other reports:
- Conflict and Validation Report
- Teacher load report
- Grade level timetable

**Printed format** (based on the school's official JHS Class Program, see
`docs/forms/`). Keep the official structure so the school recognizes it, but make it
cleaner:
- **Header:** logos and school info from `school_profile`. The title comes from
  `report_settings.title_format` (e.g. "JHS GRADE 7 – CLASS PROGRAM"), followed by the
  school year, "GRADE 7 – HONESTY" and the class adviser.
- **Body:** one block per day pattern side by side (Mon–Thu | Friday), with columns
  Time, No. of Mins., Subject and Teacher. Break and lunch rows are shaded.
- **Totals:** total minutes and hours per day, **computed automatically**, plus
  `reference_note` (e.g. "DO 12, s. 2024").
- **Signature block** (2×2 grid) from `report_signatories`, in `sort_order`:
  - **Prepared by:** Head Teacher III
  - **Conforme:** Class Adviser. `auto_source = section_adviser`, so it is filled from
    the section.
  - **Recommending Approval:** School Principal II
  - **Approved by:** PSDS Cluster IV, an external person, so it is **typed by the Admin**.
  - Names and positions are **encoded and editable** in Admin → Report Signatories.
    Never hard-code them.
- **Footer:** school contact info and the document control block (Doc. Ref. Code,
  Rev, Effectivity, Page X of Y) from `report_settings`.
- Teacher names on documents are first name + middle initial + last name, made by the code
  (`Teacher::printedName()`; the typed "name on printed forms" was removed, Nov 21, 2026).

**On-screen view (enhanced, not a copy of the paper):**
- Color per subject and highlighted break or lunch rows
- Click an entry to see teacher and room details
- Flag badges and Mon–Thu / Friday tabs
- Weekly grid on wide screens; day-by-day list on phones
- Print and Export buttons produce the official format above.

**History:** users can view any section's schedule for **any term** (term selector), and
filter by grade level.

## Guest view (no login)
- "View as Guest" button on the login page.
- **Only the adviser and co-adviser are named** (team decision, Nov 7, 2026). Teachers of subjects and
  signatories are left out, on screen and in the public PDF.
- Pick **Department → Grade Level → Section** (searchable). **No student-name search**,
  for privacy reasons (minors).
- Shows approved schedules of the **active term only**, and only when the whole section
  is approved. If the section is reopened, show "Schedule is being updated".
- Mobile-friendly, with Print and PDF buttons. Each section has a shareable link or QR code.

## Admin module
- **Dashboard:** pending approvals per department and grade level, active term, flags,
  overloaded teachers.
- **Approvals**
- **School years and terms:** term count, dates, active term
- **Time slots and breaks**
- **Sections:** yearly encoding, track, adviser, shift
- **Users, roles and scopes**
- **Report signatories, school profile (header/footer, logos) and document settings**

---

## Scope priority

**Must have (by Nov 22)**
- Fully responsive UI (phone portrait and landscape)
- Auth and RBAC with scopes
- School years and terms, with the "Start New School Year" wizard
- Time slots and breaks
- Sections (Admin), with tracks and advisers
- CRUD for teachers (with qualifications), subjects (per term, track) and rooms/buildings
- Teacher loading
- Plotter with hard conflicts and soft flags
- Approvals by scope
- 3 generated schedules (PDF/CSV) with signatories
- Teacher "My Schedule"
- Guest view

**Should have:** copy to next term, Conflict and Validation Report, QR links.

**Nice to have:** custom color schemes. (Auto-fill was removed, team decision, Nov 17, 2026.) Basic light/dark mode is fine.

---

## Responsive design (client requirement)

The **whole system must be fully responsive** on phones in **portrait and landscape**,
tablets and desktops. Test at 360×640, 390×844, 844×390 (landscape), 768×1024 and 1366×768.

- Mobile-first Tailwind. Use `portrait:` / `landscape:` variants where layout differs.
  Use `dvh` instead of `vh`.
- **Navigation:** sidebar on desktop; hamburger drawer or bottom nav on phones.
- **Tables** (CRUD lists): full table on desktop, **card list** on phones. Keep search
  and filters in a collapsible panel.
- **Schedule Plotter**
  - Desktop and landscape: weekly grid with a **sticky time column** and horizontal scroll.
  - Phone portrait: **day tabs (Mon–Fri) + list of periods**. Tap a period to open a
    bottom sheet to assign subject, teacher and room.
  - Drag-and-drop must also work by **tap** (Pointer Events + tap-to-assign fallback).
- **Schedule views** (teacher, guest): grid on wide screens, day-by-day list on phones.
- **Reports:** preview fits the screen. Phones get Download PDF/CSV buttons.
- Touch targets are at least 44×44 px. No hover-only actions. Forms use the right input
  types (`email`, `time`, `date`).
- Every new screen must be checked in portrait and landscape before a task is done.

## Coding conventions

- **Back-end**
  - Controllers stay thin. Logic goes in `app/Services` (`ConflictService`,
    `ScheduleService`, `ApprovalService`, `TermCopyService`, `ReportService`).
  - Validation goes in Form Requests. Authorization goes in Policies, which always check
    the user's grade-level scope.
  - Routes are under `/api` and return JSON through API Resources.
- **Front-end** (`frontend/src`)
  - One folder per feature in `features/`, shared parts in `components/`, `layout/`, `lib/` and `state/`.
  - Plain JavaScript with `// @ts-check` and JSDoc types for API data. Build pages with `h()` from `lib/dom.js`
    (text, never `innerHTML` with data).
  - API calls go through `src/api/` and the cache in `state/cache.js`.
  - Reuse the shared components and the design tokens in `src/styles/main.css` (brand red, teal subheadings, dark mode).
- UI text in English. Times shown as `7:00 AM`. Days Monday–Friday.
- No secrets in Git (`.env` is ignored, `.env.example` is kept updated).

## How to work on this repo (instructions for Claude)

1. **Plan first.** Read the relevant code and docs, propose a short plan, and wait for
   approval before big changes or installing packages.
2. **One feature per task.** Keep changes small.
3. **Test what you build.**
   - Pest tests for back-end logic. Conflict tests must cover: overlap, back-to-back,
     different day, different term, rejected entry ignored, open slot, and Homeroom
     over 60 minutes flagged.
   - Run the tests and the build before saying a task is done.
4. **Ask, don't guess.** Check the "Open questions" in `docs/client-notes.md`. Do not
   decide those yourself.
5. **Explain changes simply:** what changed, which files, how to test it. The team must
   be able to explain the code in the capstone defense.
6. Suggest a commit message after each feature. Do not push unless asked.
7. **Always look for a better way.** Whenever you see a better approach for the system's
   flow, UX, structure, performance or security, propose it **before** implementing.
   Use this format:

   > 💡 **Suggestion:** what to change
   > **Why:** the benefit to users or the team
   > **Effort:** small / medium / large
   > **When:** now (before Nov 22) or after evaluation

   - Don't apply a suggestion until the team approves it.
   - Never change the tech stack or drop a client requirement through a suggestion.
8. **Respect the deadline.** If a suggestion or a task risks the Nov 22 deadline, say so
   and offer a smaller version.
