# CLAUDE.md — Class Scheduling System (ERCIHS)

Capstone project of BSIT students, Cavite State University – Trece Martires City Campus.
Web system for creating conflict-free class schedules for **Emmanuel Resurreccion
Congressional Integrated High School (ERCIHS)**, a DepEd public high school.

**Deadline:** feature-complete and deployed by **Nov 22, 2026**. Testing and ISO 25010
evaluation run **Nov 23–29, 2026**. Prefer working, tested features over many half-done ones.

Read these first:
- `docs/schema.sql`: database design (source of truth)
- `docs/ERD_Class_Scheduling_System(11-06-26).png`
- `docs/client-notes.md`: client requests, decisions and open questions

---

## Tech stack (do not change without asking)

| Layer     | Tech |
|-----------|------|
| Front-end | React + TypeScript + Vite + Tailwind CSS, React Router, TanStack Query, TanStack Table, react-hook-form + zod, dnd-kit |
| Back-end  | PHP + Laravel (REST API only), Laravel Sanctum (SPA cookie auth), spatie/laravel-permission, Laravel Excel (XLSX), barryvdh/laravel-dompdf (PDF) |
| Database  | PostgreSQL (with `btree_gist` extension) |
| Testing   | Pest (back-end), Vitest (front-end) |
| Tools     | Git + GitHub, VS Code |

## Repository layout

```
/frontend         React app (existing UI — keep its look, layout and components)
/backend          Laravel API
/docs             schema.sql, ERD_Class_Scheduling_System(11-06-26).png, client-notes.md, forms/ (official templates)
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

# frontend
cd frontend
npm install
npm run dev                       # http://localhost:5173
npm run test
npm run build
```

## Current status (Nov 6, 2026)

- **Front-end, working with the API:** login, sign-up, forgot and reset password, route
  guards, role-based menu, responsive layout with phone drawer. Tests: `npm run test`.
- **Working, JHS flow:** section list, plotter (tap-to-assign, conflicts with suggestions, flags),
  term selector, submit with flag acknowledgements, approvals by scope (approve, reject, reopen),
  revise after rejection, Class Program PDF, and activating accounts (Users page).
- **Working, Admin:** School Years page, Start New School Year wizard, Calendar settings and
  switching the active term; Time Slots page (bell schedules, periods, breaks, copy).
- **Not built yet:** teacher loading screen, sections and other CRUD screens, SHS Class Program, Teacher Program, Room Schedule, My Schedule, Guest view.
- **Front-end, not started:** all Admin screens, Guest view.
- **Back-end:** migrations, seeders, auth, plotter, approvals and JHS Class Program PDF are done.
  First Admin on a new server: `php artisan app:create-admin`.

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
| `super_admin` (Admin) | **Does not plot schedules.** Manages school years and terms, time slots and breaks, **sections** (encoded yearly), users, roles and scopes, and report signatories. Approves, rejects or reopens schedules. Views everything. |
| `glc` | Within assigned JHS grade levels: teacher loading, plot schedules, submit for approval, reports and exports. Manages teachers, subjects and rooms. |
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
- Profile includes educational qualifications (`teacher_qualifications`), department,
  designation, **shift (AM/PM/WHOLE_DAY)**, max subjects (default 5) and
  teaching-related tasks (ICT/SSG Coordinator, Lab Manager) per term.

### Sections
- Encoded by the **Admin** once per **school year** (they change yearly). Each has a
  grade level, an optional track (SHS), a shift, an **adviser** (one advisory per
  teacher per year), a home room (JHS) and a class size.
- Teacher loading (`section_subjects`) is **per term**: section + subject + teacher.

### Day patterns, time slots and breaks
- A **day pattern** groups days that share one bell schedule, per school year, level and
  shift. Example (JHS): "Monday – Thursday" = days {1,2,3,4}, and "Friday" = {5}.
  - A day must not belong to two patterns of the same year, level and shift (check in the app).
- `time_slots` = the periods and breaks of a pattern, each with its own start and end.
  Lengths may differ.
- The Admin edits patterns and slots, with a "copy pattern" button.
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
- Scheduled minutes are not equal to the subject's `minutes_per_week`. Example:
  **Homeroom Guidance is limited to 60 minutes**. Use the `subject_minutes_check` view.
- The entry is outside the section's or teacher's shift, or overlaps a break.
- The teacher is over `max_subjects` (`teacher_load` view).
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
Three main documents, in **PDF and XLSX** (CSV optional), matching the school's official
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
- Teacher names on documents use `teachers.display_name` (fallback: first name + middle
  initial + last name).

**On-screen view (enhanced, not a copy of the paper):**
- Color per subject and highlighted break or lunch rows
- Click an entry to see teacher and room details
- Flag badges and Mon–Thu / Friday tabs
- Weekly grid on wide screens; day-by-day list on phones
- Print and Export buttons produce the official format above.

**History:** users can view any section's schedule for **any term** (term selector), and
filter by grade level.

## Guest view (no login)
- "View Schedule" button on the login page.
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
- 3 generated schedules (PDF/XLSX) with signatories
- Teacher "My Schedule"
- Guest view

**Should have:** copy to next term, Conflict and Validation Report, QR links.

**Nice to have:** auto-fill (priority subjects first, then first valid slot), custom
color schemes. Basic light/dark mode is fine.

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
  - Drag-and-drop must also work by **tap** (dnd-kit touch sensor + tap-to-assign fallback).
- **Schedule views** (teacher, guest): grid on wide screens, day-by-day list on phones.
- **Reports:** preview fits the screen. Phones get Download PDF/XLSX buttons.
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
- **Front-end**
  - Function components and TypeScript types for all API data.
  - Server state goes through TanStack Query hooks in `src/api/`.
  - Reuse existing components and Tailwind styles. Do not redesign the existing UI.
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
