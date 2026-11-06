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
9. **Sections:** Only the Admin creates sections, or can the GLC / Master Teacher too?
10. **Copy term (item 2):** Should the copy also keep the same teachers for subjects that
    continue?
11. **Guest view:** Is it okay for teacher schedules to be public? Should schedules appear
    automatically after approval, or be released by the Admin all at once?
12. **Signatories:** Is "Prepared by" always the Head Teacher (not the GLC)? Are the
    signatories the same for SHS, and for the teacher program and room schedule?
13. **Bell schedule:** Are the Mon–Thu and Friday times the same for every JHS grade
    level? What is the SHS bell schedule per shift?
14. **Official forms:** Please provide blank copies (Excel or photo) of the class
    program, teacher program and room schedule formats.
