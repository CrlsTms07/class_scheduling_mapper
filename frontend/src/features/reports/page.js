// @ts-check
/**
 * Reports: every official form and summary of the term, with a preview on screen and downloads
 * as PDF (the official form) or CSV (the data). Phones get the downloads; previews that need a
 * wide screen say so.
 */
import { h, replace } from "@/lib/dom.js";
import { icon } from "@/components/icons.js";
import { downloadButtons } from "@/components/download-buttons.js";
import { skeletonList } from "@/components/loading.js";
import { emptyState, noMatches, pageHeader } from "@/components/page-header.js";
import { searchableSelect } from "@/components/searchable-select.js";
import { weekFromReportGrid, weekTable } from "@/components/week-table.js";
import { errorMessage } from "@/api/client.js";
import { getSections } from "@/api/schedule.js";
import { getTeacherLoad } from "@/api/teacher-loading.js";
import { getAdviserSummary, getGradeTimetable, getReportOptions, getRoomUsage, getTeacherProgram, getValidationReport } from "@/api/reports.js";
import { termState } from "@/state/term.js";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/schedule.js";

/** @type {{ key: string, label: string, icon: import("@/components/icons.js").IconName, about: string }[]} */
const TABS = [
  { key: "schedules", label: "Schedules", icon: "calendar", about: "Every section with its status. Each prints as the official Class Program." },
  { key: "rooms", label: "Rooms & Buildings", icon: "building", about: "Which sections use each room, and the Room Schedule of each room." },
  { key: "timetable", label: "Grade Timetable", icon: "table", about: "Every section of a grade level side by side." },
  { key: "teacher", label: "Teacher Program", icon: "user", about: "One teacher's week, with the total teaching minutes." },
  { key: "load", label: "Teacher Load", icon: "clipboard", about: "Who carries what: subjects and minutes a week against each limit." },
  { key: "advisers", label: "Advisers", icon: "team", about: "Every section with its room, adviser and co-adviser, grade by grade." },
  { key: "validation", label: "Validation", icon: "circle-check", about: "Everything that needs checking, section by section." },
];

/** @type {import("@/router.js").RenderPage} */
export async function render(container, { query, navigate }) {
  const term = termState.term;
  if (!term) {
    container.append(h("div", { class: "p-4 sm:p-6" }, emptyState({ title: "No school year yet", text: "The Admin starts a school year on the School Years page." })));
    return;
  }
  const termId = term.id;
  const tab = TABS.find(({ key }) => key === query.get("tab")) ?? TABS[0];
  const panel = h("div", { class: "space-y-4" }, skeletonList(4));

  replace(
    container,
    h(
      "div",
      { class: "space-y-5 p-4 sm:p-6" },
      pageHeader({ icon: "folder", title: "Reports", description: `Official forms for ${term.name}, SY ${term.school_year.name}. Download as PDF (the official form) or CSV (the data).`, crumbs: [{ label: "Home", to: "/dashboard" }, { label: "Reports" }] }),
      h(
        "details",
        { class: "card" },
        h("summary", { class: "flex min-h-11 cursor-pointer items-center px-3 text-sm font-medium" }, "How this works"),
        h("ul", { class: "list-disc space-y-1 px-3 pb-3 pl-8 text-sm text-muted-foreground" }, [
          "Choose a report, narrow it down, then download it as PDF or CSV.",
          "Forms follow the term at the top. A form with classes not approved yet prints with a DRAFT mark.",
          "The school details, titles and signatories come from Report Settings.",
        ].map((line) => h("li", null, line))),
      ),
      h(
        "div",
        { class: "space-y-2" },
        h(
          "div",
          { role: "tablist", "aria-label": "Report", class: "grid grid-cols-2 gap-1 rounded-xl border bg-surface-muted p-1 sm:grid-cols-4 xl:grid-cols-7" },
          TABS.map((item) => h("a", { href: `/reports?tab=${item.key}`, role: "tab", "aria-selected": String(item.key === tab.key), class: `btn whitespace-normal px-2 text-center leading-tight ${item.key === tab.key ? "bg-brand text-white" : "text-muted-foreground"}` }, icon(item.icon), item.label)),
        ),
        h("p", { class: "px-1 text-sm text-muted-foreground" }, tab.about),
      ),
      panel,
    ),
  );

  /** A wide preview: phones are told to download the file instead. */
  const widePreview = (/** @type {import("@/lib/dom.js").Child} */ content) => [h("p", { class: "text-sm text-muted-foreground md:hidden" }, "The preview needs a wider screen. Download the PDF to see the form."), h("div", { class: "hidden md:block" }, content)];
  const draftBadge = (/** @type {boolean} */ isDraft) => (isDraft ? h("span", { class: "badge bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100" }, "Draft") : null);

  /* ---------- Schedules: every section, each a Class Program ---------- */

  const schedules = async () => {
    const sections = await getSections(termId);
    if (sections.length === 0) {
      replace(panel, emptyState({ title: "No sections in your grade levels yet", text: "Add the sections first. Their schedules show up here, ready to download.", action: h("a", { href: "/sections", class: "btn btn-primary" }, icon("plus"), "Add a section") }));
      return;
    }
    const ui = { level: "", grade: "", status: "", search: "" };
    const list = h("div");
    const hasBoth = new Set(sections.map(({ level }) => level)).size > 1;
    const searchInput = /** @type {HTMLInputElement} */ (h("input", { type: "search", class: "input", placeholder: "Section or adviser", "aria-label": "Search sections or advisers", oninput: () => { ui.search = searchInput.value; draw(); } }));

    const draw = () => {
      const words = ui.search.trim().toLowerCase();
      const filtered = sections.filter((section) => (!ui.level || section.level === ui.level) && (!ui.grade || section.grade === Number(ui.grade)) && (!words || `grade ${section.grade} ${section.name} ${section.adviser ?? ""}`.toLowerCase().includes(words)));
      const shown = filtered.filter((section) => !ui.status || section.status === ui.status);
      replace(
        list,
        h("p", { class: "pb-2 text-small text-muted-foreground", "aria-live": "polite" }, `${shown.length} of ${sections.length} ${sections.length === 1 ? "section" : "sections"}`),
        shown.length === 0
          ? noMatches({
              noun: "section",
              search: ui.search,
              filters: [ui.level ? (ui.level === "JHS" ? "Junior High School" : "Senior High School") : null, ui.grade ? `Grade ${ui.grade}` : null, ui.status ? STATUS_LABELS[/** @type {keyof typeof STATUS_LABELS} */ (ui.status)] : null],
              onClear: () => {
                Object.assign(ui, { level: "", grade: "", status: "", search: "" });
                searchInput.value = "";
                for (const select of filterSelects) select?.setValue("");
                draw();
              },
            })
          : h("ul", { class: "grid gap-3 lg:grid-cols-2" }, shown.map((section) => {
              const label = `Grade ${section.grade} – ${section.name}`;
              return h("li", { class: "card space-y-3 p-4" },
                h("div", { class: "flex items-start justify-between gap-2" }, h("div", { class: "min-w-0" }, h("p", { class: "font-semibold" }, label), h("p", { class: "text-small text-muted-foreground" }, `${section.level} · Adviser: ${section.adviser ?? "None yet"}`)), h("span", { class: `badge shrink-0 ${STATUS_COLORS[section.status]}` }, STATUS_LABELS[section.status])),
                h("div", { class: "flex flex-col gap-2 sm:flex-row" }, h("a", { href: `/schedule/sections/${section.id}`, class: "btn btn-outline" }, "View"), downloadButtons({ basePath: `/terms/${termId}/sections/${section.id}/class-program`, label: `Class Program of ${label}` })),
              );
            })),
      );
    };

    const grades = [...new Set(sections.map(({ grade }) => grade))].sort((a, b) => a - b);
    // Kept, so "Clear search and filters" can set them back.
    const filterSelects = [
      hasBoth ? searchableSelect({ label: "Department", value: "", options: [{ value: "", label: "All departments" }, { value: "JHS", label: "Junior High School" }, { value: "SHS", label: "Senior High School" }], onChange: (value) => { ui.level = String(value); draw(); } }) : null,
      searchableSelect({ label: "Grade level", value: "", options: [{ value: "", label: "All grades" }, ...grades.map((grade) => ({ value: String(grade), label: `Grade ${grade}` }))], onChange: (value) => { ui.grade = String(value); draw(); } }),
      searchableSelect({ label: "Status", value: "", options: [{ value: "", label: "Any status" }, ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))], onChange: (value) => { ui.status = String(value); draw(); } }),
    ];
    replace(
      panel,
      h(
        "div",
        { class: `card grid gap-3 p-3 sm:grid-cols-2 ${hasBoth ? "xl:grid-cols-4" : "xl:grid-cols-3"}` },
        filterSelects,
        h("div", { class: "space-y-1" }, h("label", { class: "field-label" }, "Search"), searchInput),
      ),
      list,
    );
    draw();
  };

  /* ---------- Rooms and buildings ---------- */

  const rooms = async () => {
    const data = await getRoomUsage(termId);
    const total = data.buildings.reduce((sum, /** @type {any} */ building) => sum + building.rooms.length, 0);
    replace(
      panel,
      downloadButtons({ basePath: `/terms/${termId}/reports/room-usage`, label: "Room Usage" }),
      h("p", { class: "text-small text-muted-foreground" }, `${total} ${total === 1 ? "room" : "rooms"} in ${data.buildings.length} ${data.buildings.length === 1 ? "building" : "buildings"}.`),
      data.buildings.length === 0 ? emptyState({ title: "No rooms yet", text: "Add the buildings and rooms first.", action: h("a", { href: "/buildings", class: "btn btn-outline" }, "Open Rooms & Buildings") }) : null,
      data.buildings.map((/** @type {any} */ building) =>
        h("section", { "aria-label": building.name, class: "space-y-2" },
          h("h2", { class: "font-semibold text-accent" }, building.name),
          h("ul", { class: "card divide-y" }, building.rooms.map((/** @type {any} */ room) =>
            h("li", { class: "flex flex-col gap-3 p-3 text-sm lg:flex-row lg:items-start lg:justify-between" },
              h("div", { class: "min-w-0" },
                h("p", { class: "font-medium" }, `Room ${room.room_number}${room.room_name ? ` – ${room.room_name}` : ""}`, h("span", { class: "ml-2 text-small font-normal text-muted-foreground" }, `${room.periods_per_week} periods a week`)),
                room.sections.length === 0 ? h("p", { class: "text-small text-muted-foreground" }, "Not used yet.") : h("ul", { class: "mt-1 flex flex-wrap gap-1" }, room.sections.map((/** @type {any} */ section) => h("li", { class: "badge bg-surface-muted" }, `${section.label}: ${section.periods_per_week}`))),
              ),
              h("div", { class: "flex shrink-0 flex-col gap-2 sm:flex-row" }, h("a", { href: `/schedule/rooms/${room.id}`, class: "btn btn-outline" }, "View"), downloadButtons({ basePath: `/terms/${termId}/reports/rooms/${room.id}/schedule`, label: `Room Schedule of Room ${room.room_number}` })),
            ),
          )),
        ),
      ),
    );
  };

  /* ---------- Teacher Program ---------- */

  const teacher = async () => {
    const options = await getReportOptions(termId);
    if (options.teachers.length === 0) {
      replace(panel, emptyState({ title: "No teachers with classes yet", text: "No teacher has loading in your grade levels yet." }));
      return;
    }
    const wanted = Number(query.get("teacher"));
    const chosen = options.teachers.find(({ id }) => id === wanted) ?? options.teachers[0];
    const preview = h("div", null, skeletonList(2));
    replace(
      panel,
      h("div", { class: "sm:w-96" }, searchableSelect({ label: "Teacher", value: chosen.id, options: options.teachers.map(({ id, label }) => ({ value: id, label })), onChange: (value) => navigate(`/reports?tab=teacher&teacher=${value}`) })),
      downloadButtons({ basePath: `/terms/${termId}/reports/teachers/${chosen.id}/program`, label: `Teacher Program of ${chosen.label}` }),
      preview,
    );
    const grid = await getTeacherProgram(termId, chosen.id);
    replace(
      preview,
      h("div", { class: "space-y-2" },
        h("div", { class: "flex flex-wrap items-center gap-2" }, h("h2", { class: "font-semibold text-accent" }, grid.heading), draftBadge(grid.isDraft)),
        grid.details.length ? h("p", { class: "text-small text-muted-foreground" }, grid.details.join(" · ")) : null,
        grid.rows.length === 0 ? h("p", { class: "text-sm text-muted-foreground" }, "Nothing is scheduled for this teacher yet.") : weekTable(weekFromReportGrid(grid)),
        h("p", { class: "text-sm" }, "Total per week: ", h("strong", null, `${grid.totals.week} minutes`), grid.totals.week_duration && grid.totals.week_duration !== `${grid.totals.week} minutes` ? ` (${grid.totals.week_duration})` : ""),
      ),
    );
  };

  /* ---------- Teacher Load ---------- */

  const load = async () => {
    const data = await getTeacherLoad(termId);
    replace(
      panel,
      downloadButtons({ basePath: `/terms/${termId}/reports/teacher-load`, label: "Teacher Load Report" }),
      h("p", { class: "text-sm" }, `${data.summary.teachers} ${data.summary.teachers === 1 ? "teacher" : "teachers"}, ${data.summary.overloaded} over their limit.`),
      data.teachers.length === 0
        ? h("p", { class: "text-sm text-muted-foreground" }, "No teacher has loading yet.")
        : h("ul", { class: "card divide-y" }, data.teachers.map((/** @type {any} */ item) =>
            h("li", { class: "space-y-1 p-3 text-sm" },
              h("div", { class: "flex flex-wrap items-center justify-between gap-2" }, h("p", { class: "font-medium" }, item.name), item.is_overloaded ? h("span", { class: "badge bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100" }, "Over the limit") : null),
              h("p", { class: "text-small text-muted-foreground" }, `${item.assigned} of ${item.limit} subjects · ${item.minutes} minutes a week${item.department ? ` · ${item.department}` : ""}`),
              item.classes.length ? h("p", { class: "text-small text-muted-foreground" }, item.classes.join(", ")) : null,
            ),
          )),
    );
  };

  /* ---------- Advisers ---------- */

  const advisers = async () => {
    const data = await getAdviserSummary(termId);
    replace(
      panel,
      downloadButtons({ basePath: `/terms/${termId}/reports/adviser-summary`, label: "Adviser Summary" }),
      h("p", { class: "text-sm" }, `${data.summary.sections} ${data.summary.sections === 1 ? "section" : "sections"}${data.summary.without_adviser ? `, ${data.summary.without_adviser} without an adviser` : ""}.`),
      data.grades.length === 0 ? h("p", { class: "text-sm text-muted-foreground" }, "No section has been encoded for this school year yet.") : null,
      h("div", { class: "grid gap-4 lg:grid-cols-2" }, data.grades.map((/** @type {any} */ grade) =>
        h("section", { "aria-label": `${grade.title} advisers`, class: "card overflow-hidden" },
          h("h2", { class: "bg-brand p-2 text-center text-sm font-semibold tracking-wide text-white" }, grade.title),
          h("div", { class: "overflow-x-auto" }, h("table", { class: "w-full text-left text-sm" },
            h("thead", { class: "bg-brand-soft" }, h("tr", null, ["#", "Section", "Room", "Adviser", "Co-Adviser"].map((title) => h("th", { scope: "col", class: "p-2 font-medium" }, title)))),
            h("tbody", { class: "divide-y" }, grade.sections.map((/** @type {any} */ section) => h("tr", null,
              h("td", { class: "p-2 text-muted-foreground" }, String(section.number)),
              h("td", { class: "p-2 font-medium" }, section.name),
              h("td", { class: "p-2" }, section.room ?? "–"),
              h("td", { class: `p-2 ${section.adviser ? "" : "text-warning"}` }, section.adviser ?? "No adviser yet"),
              h("td", { class: "p-2" }, section.co_adviser ?? ""),
            ))),
          )),
        ),
      )),
    );
  };

  /* ---------- Grade Timetable ---------- */

  const timetable = async () => {
    const options = await getReportOptions(termId);
    if (options.grades.length === 0) {
      replace(panel, emptyState({ title: "No grade levels", text: "No grade level here is assigned to you." }));
      return;
    }
    const wanted = Number(query.get("grade"));
    const grade = options.grades.includes(wanted) ? wanted : options.grades[0];
    const preview = h("div", null, skeletonList(2));
    replace(
      panel,
      h("div", { class: "sm:w-80" }, searchableSelect({ label: "Grade level", value: grade, options: options.grades.map((item) => ({ value: item, label: `Grade ${item} (${item <= 10 ? "Junior High" : "Senior High"})` })), onChange: (value) => navigate(`/reports?tab=timetable&grade=${value}`) })),
      downloadButtons({ basePath: `/terms/${termId}/reports/grades/${grade}/timetable`, label: `Grade ${grade} Timetable` }),
      preview,
    );
    const data = await getGradeTimetable(termId, grade);
    replace(
      preview,
      data.tables.length === 0
        ? h("p", { class: "text-sm text-muted-foreground" }, "This grade has no sections with a bell schedule yet.")
        : widePreview(h("div", { class: "space-y-4" }, draftBadge(data.isDraft), data.tables.map((/** @type {any} */ table) =>
            h("section", { "aria-label": table.name, class: "space-y-1" },
              h("h2", { class: "text-sm font-semibold text-accent" }, table.name),
              h("div", { class: "overflow-x-auto rounded-xl border" }, h("table", { class: "w-full text-left text-sm" },
                h("thead", { class: "bg-brand-soft" }, h("tr", null, h("th", { scope: "col", class: "sticky left-0 bg-surface p-2 font-medium whitespace-nowrap" }, "Time"), table.sections.map((/** @type {any} */ section) => h("th", { scope: "col", class: "p-2 font-medium" }, section.label)))),
                h("tbody", { class: "divide-y" }, table.rows.map((/** @type {any} */ row) => h("tr", null,
                  h("td", { class: "sticky left-0 bg-surface p-2 whitespace-nowrap" }, row.time),
                  row.break !== null
                    ? h("td", { colspan: String(table.sections.length), class: "bg-surface-muted p-2 text-center font-semibold" }, row.break)
                    : table.sections.map((/** @type {any} */ section) => h("td", { class: "min-w-32 p-2 align-top" }, (row.cells[section.id] ?? []).map((/** @type {any} */ group) => h("div", null, h("p", { class: "font-medium" }, `${group.subject}${group.days ? ` (${group.days})` : ""}`), group.teacher ? h("p", { class: "text-small text-muted-foreground" }, group.teacher) : null, group.room ? h("p", { class: "text-small text-muted-foreground" }, group.room) : null)))),
                ))),
              )),
            ),
          ))),
    );
  };

  /* ---------- Validation ---------- */

  const validation = async () => {
    const data = await getValidationReport(termId);
    replace(
      panel,
      downloadButtons({ basePath: `/terms/${termId}/reports/validation`, label: "Conflict and Validation Report" }),
      h("p", { class: "text-sm" }, h("strong", null, `${data.summary.issues} ${data.summary.issues === 1 ? "issue" : "issues"}`), ` in ${data.summary.sections_with_issues} of ${data.summary.sections} ${data.summary.sections === 1 ? "section" : "sections"}. ${data.summary.urgent} urgent, ${data.summary.not_acknowledged} not acknowledged yet.`),
      data.sections.length === 0 ? h("p", { class: "text-sm text-muted-foreground" }, "Nothing to check. Every section is clear.") : null,
      h("div", { class: "grid items-start gap-3 xl:grid-cols-2" }, data.sections.map((/** @type {any} */ section) =>
        h("div", { class: "card space-y-2 p-4" },
          h("div", { class: "flex flex-wrap items-center justify-between gap-2" }, h("a", { href: `/schedule/sections/${section.id}`, class: "inline-flex min-h-11 items-center font-semibold text-brand underline-offset-2 hover:underline" }, section.label), h("span", { class: `badge ${STATUS_COLORS[/** @type {import("@/lib/schedule.js").ScheduleStatus} */ (section.status)]}` }, section.status_label)),
          h("ul", { class: "divide-y" }, section.issues.map((/** @type {any} */ issue) =>
            h("li", { class: "flex items-start gap-2 py-2 text-sm" }, h("span", { class: `badge shrink-0 ${issue.severity === "red" ? "bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100" : "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100"}` }, issue.level), h("span", { class: "min-w-0" }, issue.message, issue.acknowledged ? h("span", { class: "text-muted-foreground" }, " (acknowledged)") : null)),
          )),
        ),
      )),
    );
  };

  const panels = { schedules, rooms, timetable, teacher, load, advisers, validation };
  try {
    await panels[/** @type {keyof typeof panels} */ (tab.key)]();
  } catch (error) {
    replace(panel, h("p", { role: "alert", class: "text-danger" }, `Could not load the report. ${errorMessage(error)}`));
  }
}
