# ROLE
Act as a professional full-stack engineer and technical lead on this capstone project. Work carefully,
explain decisions simply, and protect the deadline. Follow CLAUDE.md in both repositories
(class_scheduling_system and class_scheduling_mapper) unless this prompt says otherwise.

# CONTEXT
- Project: Class Scheduling System for Emmanuel Resurreccion Congressional Integrated High School (ERCIHS),
  a BSIT capstone (Cavite State University – Trece Martires City Campus).
- Deadline: feature-complete and deployed by Nov 22, 2026. Testing and ISO/IEC 25010 evaluation: Nov 23–29, 2026.
- Current stack: React + TypeScript + Vite + Tailwind (frontend), Laravel REST API (backend), PostgreSQL (database),
  deployed on Render (one Docker service) with a Neon database. CI: .github/workflows/ci.yml (Pest, Vitest, build).
- Current frontend size: about 22,800 lines in 167 files, 16 feature modules, 47 test files.
  Backend: 159 API routes, logic in app/Services.
- The team approves this stack change (it overrides the "do not change the tech stack" rule in CLAUDE.md):
  * Frontend: HTML + Tailwind CSS + JavaScript (vanilla, no React/TypeScript).
  * Backend: Laravel (unchanged).
  * Database: PostgreSQL (unchanged).

# GROUND RULES
1. Plan first. Read the code and docs, then give a written plan with phases, effort and risks, and WAIT for approval.
2. Work on a new branch. Never commit to main, never push, never deploy unless I say so.
3. Do not change backend behavior or business rules: conflict detection (ConflictService + PostgreSQL exclusion
   constraints), flags (FlagService), approvals, copy schedule, import, reports and PDFs must give the SAME results.
   The backend API stays the contract for the new frontend.
4. Feature parity: every feature and role that works today must work in the new frontend (see checklist below),
   with a clean, consistent design (reuse the Tailwind classes and improve what Task B finds), fully responsive at
   360×640, 390×844, 844×390, 768×1024 and 1366×768, touch targets at least 44×44 px, and no hover-only actions.
5. Keep the current React frontend deployable until the new frontend passes the parity checklist and all tests.
   If everything cannot be finished and tested before Nov 22, say so in the plan and propose what to do first.
   Suggested order: small safe tasks first (C, F1), then D and E, then the new frontend module by module
   (Schedule plotter → Teacher Loading → Approvals → Reports → Guest view → setup modules → the rest),
   then G, H and I. What the ISO evaluation needs comes first if time runs out.
6. Run all tests and the build before saying a task is done. Report failures honestly with the output.
7. Ask, don't guess, on anything marked CONFIRM below and on the open questions in docs/client-notes.md.
8. After each phase: explain in simple Taglish what changed, which files, how to test, and suggest a commit message.

# TASKS

## A. Rewrite the frontend in HTML + Tailwind CSS + vanilla JavaScript
Parity checklist (all must work): login, sign-up (Terms and Conditions + separate Data Privacy Notice),
6-digit sign-in code with "Remember this device for 30 days", Continue with Google, forgot/reset password,
forced password change, route guards and role-based menu (Admin, GLC, Master Teacher, Teacher, Guest), notifications
under the bell, dashboards (Admin, Chairperson/Master Teacher setup steps, Teacher), School Years + Start New School Year
wizard + Calendar settings, Time Slots (bell schedules, periods, breaks, presets, copy), Sections, Teachers
(qualifications, tasks), Subjects, Buildings and Rooms (floor plan, room in charge), Teacher Loading (import previous
data, load distribution), Schedule module (building tabs, room cards, classroom/section pages with day cards,
plotter with weekly grid, drag-and-drop AND tap-to-assign, move a class, conflicts with suggestions, flags and
acknowledgements, submit), import from Excel with review, copy schedule to another term, approvals by scope
(approve, reject with remarks, reopen with reason), Reports (all PDF/XLSX/CSV), My Schedule and My Profile,
Guest view (department → grade → section, approved schedules of the active term only, adviser and co-adviser only,
print, PDF, shareable link, QR code), "How to make a schedule" guide, color coding, light/dark mode.

New UI requirements (apply everywhere):
1. Loading states: replace them with a polished animated loader (skeletons for lists/tables, spinner or progress
   on buttons while saving). Consistent across the system; respect prefers-reduced-motion.
2. Center the input/plot form: placing or editing a class (and other forms) opens in a centered dialog that fits
   the screen without scrolling, so every field is visible. On phones, use the full screen width with no page scroll.
3. Every dropdown in every feature is searchable: one reusable "searchable select" component (type to filter,
   keyboard and touch friendly, "No results" state). Keep "+ Add new teacher" in the teacher dropdown.
4. Every action shows a pop-up notification (toast): success or error, for every create, update, delete, submit,
   approve, reject, reopen, import, export, login, etc. Errors show the API message (e.g. the conflict message).
5. Time format: every time on screen and in inputs is shown in 12-hour format with AM/PM (e.g. 7:00 AM, 1:30 PM),
   never 24-hour/military time (13:30). Any time of the day (12:00 AM–11:59 PM) can be used.
   CONFIRM this reading with me before building.
6. Plotting choices follow the subject's time: when placing a class, offer ONLY the time slots that match the
   subject's time (e.g. the period length that fits the subject and its remaining minutes per week) and are still
   free. CONFIRM the exact rule with me before building.

Technical notes:
- Use Vite as the build tool with plain JavaScript (no framework) unless you propose a better option and I approve.
- Keep the same API calls (Sanctum SPA cookie auth with CSRF, same endpoints).
- Drag-and-drop must also work by tap. Use Pointer Events or HTML5 drag-and-drop plus a tap-to-assign fallback.
- Replace frontend tests with tests that fit vanilla JS (Vitest for modules, Playwright for key end-to-end flows:
  login, plot a class with a conflict, submit, approve, guest view).

## B. Fix designs and features that look bad, are messy or are hard to understand
Goal: a teacher who has never used the system can make a schedule without help, on a phone or a computer.
1. Audit first. Run the current system with sample data, open every page as each role (Admin, GLC, Master Teacher,
   Teacher, Guest), and take screenshots at 360×640, 844×390 and 1366×768. For each problem write: page, screenshot,
   what is wrong, why it confuses users, the fix, effort. Group them as Must fix (before evaluation) and Later.
   Show me the list and WAIT for approval before changing how a feature works.
2. Check every page against these rules:
   - One clear main action per page (one primary button); other actions are secondary or in a "More" menu.
   - Plain labels and help text in simple English, no technical words, the same word for the same thing everywhere.
   - Same layout on every page: title, short description, search/filters, content, actions. Same buttons, spacing,
     colors and icons (icons always with a text label). Tables become cards on phones.
   - Helpful empty states ("No sections yet. Add your first section.") with a button to the next step.
   - Errors say what happened and how to fix it. Delete, reject, reopen and clear ask for confirmation and say
     what will be lost.
   - Forms: only the needed fields, grouped, sensible defaults, inline validation, searchable dropdowns, right input
     types, all fields visible in a centered dialog.
   - Readable: WCAG AA contrast, at least 14 px text on phones, clear hierarchy, light/dark mode.
3. Known candidates (from reading the code; confirm with screenshots before changing):
   - Menu: "Approvals" and "Reports" are groups with one item each; Time Slots is under Manage but School Years is
     under Settings; the menu order does not follow the dashboard's setup steps (Rooms & Buildings → Bell schedule →
     Subjects & Sections → Teachers → Teacher Loading → Plot). Propose a shorter menu that follows the workflow
     (e.g. a "Setup" group in step order), as planned in docs/client-notes.md.
   - Two different forms place a class: the plotter's EntrySheet and the daily view's ClassFormSheet. Use ONE centered
     "Add / Edit class" dialog everywhere.
   - Three similar ways to bring data in: "Import previous data", "Copy schedule" and "Import from a file". Make one
     clear "Import or copy" entry with a short description of each.
   - Two views of one schedule (day cards and timetable): make the switch obvious and remember the user's choice.
   - Always show which school year and term the user is working on.
   - Show flags and conflicts next to the class they belong to, in plain words, with a "Fix" button.
4. Never drop a client requirement, never change business rules, and keep the official printed forms (Class Program
   layout, signatories) exactly as approved. Use the suggestion format from CLAUDE.md for any bigger change.

## C. Remove Auto-fill completely (including code)
- Backend: AutoFillService, AutoFillController, AutoFillRequest, AutoFillRun model, its routes, and its references in
  PlotterService, ScheduleService, PeriodService and ClearSchoolData.
- Database: a new migration that drops auto_fill_runs and the related column on schedule_entries. Existing classes
  stay as drafts. Update docs/schema.sql.
- Frontend: the Auto-fill button, sheet, badge, API calls, types and guide text.
- Tests: remove the Auto-fill tests; all other tests must still pass.
- Docs: update CLAUDE.md and docs/client-notes.md (team decision, Nov 17, 2026).

## D. Real Excel formulas in XLSX exports
In every XLSX export, write totals as real Excel formulas, not only numbers: e.g. total minutes per day =SUM(...),
hours =minutes/60, Teacher Load hours per week, Room Usage periods per week, and summary counts.
The values shown must stay exactly the same as today (add tests that compare them).

## E. Validation deliverables (for the paper and the adviser)
Base them on the existing files in /home/user/Paper_Review/ (Validation_Process_Explanation.docx and the mockups in
Suggestion_Mockups/).
1. "Validation Framework" figure for Chapter 3: Input (manual entry, Excel import) → Layer 1 Input validation →
   Layer 2 Hard conflict check → Layer 3 Database guard → Layer 4 Soft rules (flags) → Layer 5 Submit gate → Output.
   Update it to the final system (no Auto-fill).
2. Excel 1 – Test data: a real .xlsx in the import template (Grade, Section, Day, Start, End, Subject, Teacher, Room)
   using the school's real bell schedule, with valid rows and mistakes put in on purpose (teacher conflict, room
   conflict, back-to-back, class during a break, wrong day, misspelled teacher, Homeroom over 60 minutes, teacher over
   5 subjects). Times must match real periods of the bell schedule.
3. Excel 2 – Validation workbook: a real .xlsx with working formulas: test case, manual computation, Expected,
   System result, =IF(D2=E2,"PASS","FAIL"), =COUNTIF(...), accuracy %, plus a sheet for minutes/hours computations.
   Actually run Excel 1 through the system and fill in the real System results. Never mark a case PASS without
   running it.

## F. Clean-up and structure
1. Remove unused folders and files (list them first and wait for approval before deleting).
2. Add clear comments to the important functions (PHPDoc in the backend, JSDoc in the frontend): what the function
   does and why, in plain English the team can explain in the defense.
3. Folder and file structure: keep frontend and backend separate. Make names and structure easy to understand.
   Keep Laravel's standard folders (app/Http/Controllers, app/Services, app/Models, routes, database, ...) because
   the framework depends on them. Propose the new frontend structure first (e.g. one folder per feature, a shared
   components folder, an api folder) and wait for approval.

## G. Deployment and CI
Update the Dockerfile (frontend build stage) and .github/workflows/ci.yml for the new frontend.
Update docs/deployment.md. The live server keeps deploying from main by Manual Deploy (autoDeploy stays false).
Note any database migration that must be run on the live server (Neon).

## H. Documentation and paper
Update CLAUDE.md (tech stack, current status). List every paper change needed: Objectives 2a (front-end tools),
Chapter 2 (React/TypeScript/Vite sections → HTML, Tailwind CSS, JavaScript), Chapter 3 (Building stage, Testing tools),
Figure 1 (software requirements), Figure 2 HIPO (remove Auto-fill from 6.2), and every Auto-fill mention
(Objective 1.d, Purpose, Scope and Limitation, Definition of Terms, Module 6.2, the validation docx).

## I. Report to me (verify from the code and config, do not guess)
1. Everything used in the system, grouped: languages, frameworks, libraries and packages (with versions), database
   features (btree_gist, exclusion constraints, views), hosting, email, CI, testing tools.
2. Security, in detail: how passwords are stored (algorithm and settings, e.g. bcrypt or Argon2; say clearly whether
   SHA-256 is used anywhere and for what), session and cookie settings, CSRF protection, Sanctum, the 6-digit sign-in
   code (how it is generated, stored, expires, attempt limits), "remember this device", Google sign-in
   (Socialite, @deped.gov.ph only), password reset tokens, rate limits, roles and permissions (spatie/laravel-permission,
   Policies, grade-level scope), input validation, SQL injection and XSS protection, HTTPS, secrets handling (.env),
   audit log, backups.
3. Data Privacy Notice and Terms and Conditions: where the text is in the code, where it came from (law cited:
   Republic Act No. 10173, Data Privacy Act of 2012, and any National Privacy Commission references), who wrote it, and
   whether it needs review by the school before the evaluation. Do not claim a legal source that is not in the repo.

# DEFINITION OF DONE (each phase)
- Backend tests (Pest) and frontend tests pass; build passes; the parity items of that phase checked at all five
  screen sizes in portrait and landscape.
- Same results as before for conflicts, flags, approvals, reports and computations.
- The approved design fixes of that module are done, with before/after screenshots.
- Clear Taglish summary: what changed, files, how to test, risks, commit message.

# OPEN ITEMS (do not decide; remind me when relevant)
- SHS shift times and SHS bell schedule (client open question).
- Evaluation respondents and sampling; ISO/IEC 25010 version (2011 eight characteristics vs 2023 nine).
- Table 1 check marks in Chapter 2; seven references that could not be verified.
- Whether the "other Excel" the adviser meant is the comparison workbook.

Start with the plan only, including the design audit list (Task B) and the folder structure proposal (Task F3).
