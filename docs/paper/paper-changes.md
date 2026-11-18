# Paper Changes After the Nov 17–18, 2026 Team Decisions

The manuscript is not in this repository, so this list names each part and gives text that can be
copied in. Check the exact wording against your latest draft. Reasons come from `docs/client-notes.md`.

The three decisions behind these changes:
1. **Front-end tools changed** (Nov 17): React + TypeScript became **HTML, Tailwind CSS and JavaScript**,
   built with Vite. Back-end (PHP, Laravel) and database (PostgreSQL) stay the same.
2. **Auto-fill removed** (Nov 17): the system no longer places classes by itself. The scheduler places
   every class; the system checks each one.
3. **Exports are PDF and CSV only; imports are XLSX and PDF** (Nov 18). No more "Excel (XLSX) export".

---

## Chapter 1

### Objectives
- **Objective 1.d (Auto-fill):** remove it. If the objective list needs the same count, replace it with:
  > d. offer only the free periods that fit the subject's remaining minutes per week when placing a
  > class, and explain why a period is not available (teacher, room or section already busy);
- **Objective 2a (front-end tools):** change to:
  > a. HTML, Tailwind CSS and JavaScript for the front-end, built with Vite;
- Any objective that says the system "exports to Excel": change to "exports to PDF and CSV".

### Purpose, Scope and Limitation
- Remove every sentence about automatic schedule generation or Auto-fill.
- Add to Scope:
  > The system checks every class placed by the scheduler for teacher, room and section conflicts, and it
  > offers only the free periods that fit the subject. It does not generate schedules automatically.
- Change export wording to: "Reports can be downloaded as PDF and CSV files. Schedules can be imported
  from the school's Excel (XLSX) template."
- Add to Limitation (if not yet there):
  > The upload accepts XLSX and PDF files, but only XLSX workbooks are read. For a PDF, the system asks
  > the user to save the schedule as an Excel workbook and upload that, because reading tables out of a
  > PDF is not supported yet.

### Definition of Terms
- Remove **Auto-fill**.
- Add if missing:
  - **CSV (Comma-Separated Values):** a plain text table that opens in Excel or Google Sheets.
  - **Free period:** a period of the bell schedule where the section, the teacher and the room are all
    free.
  - **Tailwind CSS:** a CSS framework of small ready-made style classes.
  - **Vite:** a tool that runs the web app during development and builds it for the server.

## Chapter 2 (Review of Related Literature and Systems)
- Replace the **React**, **TypeScript** and React-related library sections (React Router, TanStack Query,
  dnd-kit, react-hook-form, zod) with three short sections:
  - **HTML (HyperText Markup Language):** the structure of every page.
  - **Tailwind CSS:** the styling, including the phone and desktop layouts and dark mode.
  - **JavaScript:** page behavior: forms, the plotter's tap and drag placement, and calls to the
    Laravel API.
  - Optional, one paragraph: **Vite** as the build tool.
- Keep PHP, Laravel, PostgreSQL and the rest as they are.
- **Table 1 (comparison of systems):** if a row says "automatic scheduling", the check mark for the
  proposed system must be removed or the row reworded to "conflict checking while plotting".
  (Open item: the check marks in Table 1 still need to be confirmed.)
- **References:** remove the React/TypeScript references that are no longer cited and add one source each
  for HTML, Tailwind CSS and JavaScript (for example the official documentation sites:
  developer.mozilla.org for HTML and JavaScript, tailwindcss.com for Tailwind CSS). (Open item: seven
  existing references could not be verified.)

## Chapter 3 (Methodology)
### Building stage (Agile / development)
Replace the front-end paragraph with:
> The front-end was written in HTML, Tailwind CSS and JavaScript and built with Vite. It talks to the
> Laravel REST API using Laravel Sanctum's cookie-based sign-in. The back-end uses PHP and Laravel, and
> the data is stored in PostgreSQL, whose exclusion constraints stop two classes from using the same
> teacher, room or section at the same time.

### Testing tools
Replace with:
> Back-end logic was tested with Pest (770 automated tests). The front-end was tested with Vitest (89 unit
> tests) and Playwright (41 end-to-end tests in a real browser, including phone, phone-landscape and
> laptop screen sizes). GitHub Actions runs the tests on every change.

(Numbers as of Nov 18, 2026. Update them on the final run before printing.)

### Validation framework figure
Use `docs/paper/validation-framework.svg` (or `.png`): Input → Layer 1 Input validation → Layer 2 Hard
conflict check → Layer 3 Database guard → Layer 4 Soft rules (flags) → Layer 5 Submit gate → Output.
It has no Auto-fill.

## Figures
### Figure 1 (Software requirements)
| Before | After |
|---|---|
| React, TypeScript | HTML, Tailwind CSS, JavaScript |
| Vite | Vite (same) |
| Node.js (for building) | Node.js 24 (for building only) |
| PHP, Laravel | PHP 8.4, Laravel 13 (same) |
| PostgreSQL | PostgreSQL 18 (same) |
| Browser | Any modern browser: Chrome, Edge, Firefox, Safari (same) |

### Figure 2 (HIPO)
- **Module 6.2:** remove "Auto-fill". If 6.2 becomes empty, renumber, or rename it "Copy schedule from
  another term", which is how a scheduler starts a new term quickly now.
- Any box that says "Export to Excel": change to "Export to PDF and CSV".

## Validation document (Validation_Process_Explanation.docx)
- Remove every Auto-fill step and screenshot.
- Replace the layer diagram with the new figure above.
- Point to the two new workbooks: `docs/paper/Excel1_Test_Data.xlsx` and
  `docs/paper/Excel2_Validation_Workbook.xlsx`.

## Open items to settle with the adviser (not decided here)
- SHS shift times and SHS bell schedule.
- Evaluation respondents and sampling; ISO/IEC 25010 version (2011, eight characteristics, or 2023,
  nine).
- Table 1 check marks; seven unverified references.
- Whether the "other Excel" the adviser meant is the comparison workbook.
