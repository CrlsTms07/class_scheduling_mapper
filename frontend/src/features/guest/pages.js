// @ts-check
/**
 * The public pages: the home page, the Guest view (find a section by department and grade, or
 * by searching a section or adviser name), and a section's approved schedule with Print, PDF,
 * a shareable link and a QR code. Student names are never searched or shown (privacy of minors).
 */
import QRCode from "qrcode";
import { h, replace } from "@/lib/dom.js";
import { icon } from "@/components/icons.js";
import { downloadButtons } from "@/components/download-buttons.js";
import { skeletonList } from "@/components/loading.js";
import { toast } from "@/components/toast.js";
import { weekTable } from "@/components/week-table.js";
import { colorKeyOf } from "@/components/week-table.js";
import { API_URL, ApiError } from "@/api/client.js";
import { getGuestSection, getGuestSections, getPublicSchool } from "@/api/guest.js";
import { publicShell } from "@/layout/public-shell.js";
import { formatTime } from "@/lib/time.js";

/**
 * The school's details, or nothing when they cannot be loaded (the page still works).
 * @returns {Promise<import("@/api/guest.js").PublicSchool | null>}
 */
async function schoolOrNothing() {
  try {
    return await getPublicSchool();
  } catch {
    return null;
  }
}

/* ---------- Home ---------- */

/** @type {import("@/router.js").RenderPage} */
export async function renderHome(container) {
  const school = await schoolOrNothing();
  const name = school?.school_name ?? "Emmanuel Resurreccion Congressional Integrated High School";
  const feature = (/** @type {import("@/components/icons.js").IconName} */ iconName, /** @type {string} */ title, /** @type {string} */ text) =>
    h("div", { class: "card space-y-2 p-5 shadow-sm" }, h("span", { class: "flex size-9 items-center justify-center rounded-lg bg-brand-soft text-brand" }, icon(iconName, "size-5")), h("h3", { class: "pt-2 font-semibold" }, title), h("p", { class: "text-sm text-muted-foreground" }, text));

  /** One way to reach the school, with its round icon. */
  const contact = (/** @type {import("@/components/icons.js").IconName} */ iconName, /** @type {string} */ label, /** @type {import("@/lib/dom.js").Child} */ value) =>
    h(
      "div",
      { class: "flex gap-3" },
      h("span", { class: "flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-white" }, icon(iconName, "size-5")),
      h("div", { class: "min-w-0 text-sm" }, h("p", { class: "text-small font-semibold uppercase tracking-wide text-brand" }, label), value),
    );
  const outside = (/** @type {string} */ href, /** @type {string} */ text) => h("a", { href, target: "_blank", rel: "noopener noreferrer", class: "flex min-h-11 items-center text-foreground underline-offset-2 hover:text-brand hover:underline" }, text);
  const links = [school?.facebook_url ? outside(school.facebook_url, "Facebook page") : null, school?.website ? outside(school.website, "School website") : null].filter(Boolean);

  container.append(
    publicShell(
      h(
        "div",
        null,
        // The campus photo (when the Admin uploaded one) or the seal, faint behind the welcome.
        h(
          "section",
          { class: "relative overflow-hidden" },
          school?.has_photo
            ? h("img", { src: `${API_URL}/api/public/school/photo`, alt: "", class: "absolute inset-0 size-full object-cover opacity-10" })
            : h("img", { src: "/hero-logo.png", alt: "", class: "pointer-events-none absolute left-1/2 top-1/2 w-[38rem] max-w-none -translate-x-1/2 -translate-y-1/2 opacity-[0.05]" }),
          h(
            "div",
            { class: "relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-10 sm:px-5 md:grid-cols-[1.4fr_1fr] md:py-16" },
            h(
              "div",
              { class: "space-y-5" },
              h("p", { class: "inline-flex rounded-full border border-brand/30 bg-surface px-3 py-1 text-small font-medium text-brand" }, ["Department of Education", school?.division].filter(Boolean).join(" · ")),
              h("h1", { class: "text-3xl font-bold leading-tight text-brand sm:text-5xl" }, name),
              school?.tagline ? h("p", { class: "font-semibold" }, school.tagline) : null,
              h("p", { class: "max-w-xl text-muted-foreground" }, "Find your section's approved class schedule, no account needed. Teachers and school staff sign in to plan and approve schedules."),
              h("div", { class: "flex flex-col gap-3 sm:flex-row" }, h("a", { href: "/guest", class: "btn btn-primary min-h-12 px-5" }, icon("calendar-search"), "View class schedules"), h("a", { href: "/login", class: "btn btn-outline min-h-12 px-5" }, icon("login"), "Sign in")),
            ),
            h(
              "div",
              { class: "flex justify-center" },
              h("div", { class: "flex size-56 items-center justify-center rounded-full border-8 border-brand-soft bg-surface shadow-xl sm:size-72" }, h("img", { src: "/hero-logo.png", alt: `The seal of ${name}`, class: "size-40 sm:size-52" })),
            ),
          ),
        ),
        h(
          "section",
          { class: "bg-brand-soft/50 py-10", "aria-label": "What you can do here" },
          h(
            "div",
            { class: "mx-auto grid max-w-6xl gap-4 px-4 sm:px-5 md:grid-cols-3" },
            feature("calendar-search", "Find your section", "Pick the department, grade level and section, or search by section or adviser."),
            feature("shield", "Only final schedules", "Schedules show here once the school approves them, so what you see is what is followed."),
            feature("printer", "Print or save", "Print the class program, save it as PDF, or share its link and QR code."),
          ),
        ),
        school && (school.vision || school.mission || school.core_values)
          ? h(
              "section",
              { class: "py-10" },
              h(
                "div",
                { class: "mx-auto grid max-w-6xl gap-6 px-4 sm:px-5 md:grid-cols-3" },
                [["Vision", school.vision], ["Mission", school.mission], ["Core Values", school.core_values]].filter(([, text]) => text).map(([title, text]) => h("div", null, h("h2", { class: "font-semibold text-accent" }, title), h("p", { class: "mt-2 whitespace-pre-line text-sm text-muted-foreground" }, text))),
              ),
            )
          : null,
        h(
          "section",
          { class: "mx-auto max-w-6xl space-y-5 px-4 py-10 sm:px-5", "aria-labelledby": "contact-us" },
          h("h2", { id: "contact-us", class: "text-xl font-bold text-brand" }, "Contact us"),
          h(
            "div",
            { class: "grid gap-6 sm:grid-cols-2 lg:grid-cols-4" },
            school?.address ? contact("map-pin", "Address", h("p", null, school.address)) : null,
            school?.phone ? contact("phone", "Phone", h("p", null, school.phone)) : null,
            school?.email ? contact("mail", "Email", h("a", { href: `mailto:${school.email}`, class: "flex min-h-11 items-center break-all hover:text-brand hover:underline" }, school.email)) : null,
            links.length ? contact("external", "Online", h("div", null, links)) : null,
          ),
        ),
      ),
      { school },
    ),
  );
}

/* ---------- Find a section ---------- */

/** @type {import("@/router.js").RenderPage} */
export async function renderGuestIndex(container) {
  const content = h("div", { class: "mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-5" }, skeletonList(4));
  const hero = h("section", { class: "bg-gradient-to-br from-brand via-brand to-[#5a0910] text-white" });
  container.append(publicShell(h("div", { class: "bg-surface-muted/50" }, hero, content), { school: await schoolOrNothing() }));

  /** @type {{ term: import("@/api/guest.js").GuestTerm | null, sections: import("@/api/guest.js").GuestSectionItem[] }} */
  let data;
  try {
    data = await getGuestSections();
  } catch {
    replace(content, h("p", { role: "alert", class: "text-danger" }, "The sections could not be loaded. Please try again later."));
    return;
  }

  // browse: the list of every section is open (after "Browse all sections").
  const ui = { search: "", browse: false, level: /** @type {"" | "JHS" | "SHS"} */ (""), grade: /** @type {number | null} */ (null) };
  const results = h("div", { class: "space-y-4" });
  const searchId = "guest-search";
  const searchInput = /** @type {HTMLInputElement} */ (h("input", { id: searchId, type: "search", class: "input min-h-14 rounded-xl border-0 pl-12 text-base shadow-lg", placeholder: "Section or adviser name", "aria-label": "Search a section or adviser", oninput: () => { ui.search = searchInput.value; draw(); } }));

  replace(
    hero,
    h(
      "div",
      { class: "mx-auto grid max-w-6xl items-center gap-8 px-4 py-10 sm:px-5 md:py-14 lg:grid-cols-[1fr_auto]" },
      h(
        "div",
        { class: "space-y-4" },
        h("p", { class: "text-small font-semibold uppercase tracking-[0.15em] text-white/85" }, "View as guest"),
        h("h1", { class: "text-3xl font-bold sm:text-5xl" }, "Find your class schedule"),
        h("p", { class: "text-lg text-white/90" }, "Class schedules for students, parents and visitors."),
        data.term ? h("span", { class: "inline-flex rounded-full bg-white/15 px-3 py-1 text-sm font-medium" }, `${data.term.name}, SY ${data.term.school_year}`) : null,
        h(
          "div",
          { class: "max-w-3xl space-y-2 pt-3" },
          h("p", { class: "font-medium", "aria-hidden": "true" }, "Search"),
          h("div", { class: "relative text-foreground" }, h("span", { class: "pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" }, icon("search", "size-5")), searchInput),
        ),
      ),
      h("div", { class: "hidden size-72 items-center justify-center rounded-full border-8 border-white/15 bg-white shadow-2xl lg:flex" }, h("img", { src: "/hero-logo.png", alt: "", class: "size-56" })),
    ),
  );

  /** @param {import("@/api/guest.js").GuestSectionItem} section */
  const sectionLink = (section) =>
    h(
      "a",
      { href: `/guest/sections/${section.id}`, class: "card flex min-h-16 items-center justify-between gap-2 p-3 hover:border-brand hover:bg-brand-soft" },
      h("span", { class: "min-w-0" }, h("span", { class: "block font-medium" }, `Grade ${section.grade} – ${section.name}${section.track ? ` (${section.track})` : ""}`), h("span", { class: "block text-small text-muted-foreground" }, section.adviser ? `Adviser: ${section.adviser}` : "Adviser not set yet")),
      section.is_ready ? h("span", { class: "text-small font-medium text-brand" }, "Open") : h("span", { class: "badge bg-surface-muted text-muted-foreground" }, "Not ready yet"),
    );

  const draw = () => {
    if (!data.term || data.sections.length === 0) {
      replace(results, h("p", { class: "text-sm text-muted-foreground" }, "No schedule is open right now. Please check again later."));
      return;
    }
    const words = ui.search.trim().toLowerCase();
    if (words) {
      const found = data.sections.filter((section) => `grade ${section.grade} ${section.name} ${section.adviser ?? ""} ${section.co_adviser ?? ""}`.toLowerCase().includes(words));
      replace(results, h("section", { "aria-label": "Search results", class: "space-y-2" }, h("h2", { class: "font-semibold text-accent" }, "Search results"), found.length ? h("div", { class: "grid gap-2 md:grid-cols-2" }, found.map(sectionLink)) : h("p", { class: "text-sm text-muted-foreground" }, "No section or adviser matches your search.")));
      return;
    }

    const total = data.sections.length;
    if (!ui.browse) {
      replace(
        results,
        h(
          "div",
          { class: "card flex flex-col gap-4 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6" },
          h("div", { class: "space-y-1" }, h("h2", { class: "text-lg font-semibold" }, "Not sure of the section name?"), h("p", { class: "text-muted-foreground" }, `Search above, or browse the sections by department and grade level (${total} ${total === 1 ? "section" : "sections"}).`)),
          h("button", { type: "button", class: "btn btn-primary min-h-12 shrink-0 px-5", onclick: () => { ui.browse = true; draw(); } }, icon("layers", "size-5"), "Browse all sections"),
        ),
      );
      return;
    }

    // Every section, by department and grade; narrow it down with the buttons on top.
    const departments = /** @type {const} */ ([["", "All departments"], ["JHS", "Junior High School"], ["SHS", "Senior High School"]]);
    const inLevel = data.sections.filter((section) => !ui.level || section.level === ui.level);
    const grades = [...new Set(inLevel.map(({ grade }) => grade))].sort((a, b) => a - b);
    const shown = inLevel.filter((section) => ui.grade === null || section.grade === ui.grade);
    const byGrade = [...new Set(shown.map(({ grade }) => grade))].sort((a, b) => a - b);
    const chip = (/** @type {boolean} */ isOn) => `btn border ${isOn ? "border-brand bg-brand text-white" : "bg-surface"}`;

    replace(
      results,
      h(
        "div",
        { class: "flex flex-wrap items-center justify-between gap-2" },
        h("h2", { class: "text-lg font-semibold text-accent" }, `All sections (${shown.length})`),
        h("button", { type: "button", class: "btn btn-quiet", onclick: () => { ui.browse = false; draw(); } }, icon("x"), "Hide the list"),
      ),
      h("div", { role: "group", "aria-label": "Department", class: "flex flex-wrap gap-2" }, departments.map(([key, title]) => h("button", { type: "button", "aria-pressed": String(ui.level === key), class: chip(ui.level === key), onclick: () => { ui.level = key; ui.grade = null; draw(); } }, title))),
      grades.length > 1 ? h("div", { role: "group", "aria-label": "Grade level", class: "flex flex-wrap gap-2" }, [null, ...grades].map((grade) => h("button", { type: "button", "aria-pressed": String(ui.grade === grade), class: chip(ui.grade === grade), onclick: () => { ui.grade = grade; draw(); } }, grade === null ? "All grades" : `Grade ${grade}`))) : null,
      shown.length
        ? byGrade.map((grade) => h("section", { "aria-label": `Grade ${grade}`, class: "space-y-2" }, h("h3", { class: "font-semibold" }, `Grade ${grade}`), h("div", { class: "grid gap-2 md:grid-cols-2 lg:grid-cols-3" }, shown.filter((section) => section.grade === grade).map(sectionLink))))
        : h("p", { class: "text-sm text-muted-foreground" }, "There are no sections here yet."),
    );
  };

  replace(
    content,
    results,
    h("ul", { class: "grid gap-3 border-t pt-5 text-sm text-muted-foreground md:grid-cols-2" }, h("li", { class: "flex gap-2" }, icon("shield", "size-5 shrink-0 text-brand"), "Only schedules approved by the school are shown, so what you see is what is followed."), h("li", { class: "flex gap-2" }, icon("users", "size-5 shrink-0 text-brand"), "Student names are never shown. Only the adviser and co-adviser of each section are named.")),
  );
  draw();
}

/* ---------- One section's schedule ---------- */

/**
 * The approved week as one table per bell schedule (Mon–Thu, Friday), like the official form.
 * Teachers are left out on the public page; subject and room only.
 * @param {import("@/api/guest.js").GuestWeek} week
 */
export function guestBlocks(week) {
  return week.patterns.map((pattern) => {
    const days = week.days.filter(({ day }) => pattern.days.includes(day));
    const rows = week.rows
      .filter((row) => row.days.some((day) => pattern.days.includes(day)))
      .map((row) => {
        const breaks = Array.isArray(row.breaks) ? {} : row.breaks;
        const labels = days.map(({ day }) => breaks[day]);
        const wide = labels.length > 0 && labels.every((label) => label && label === labels[0]) ? labels[0] : null;
        return {
          key: `${row.start_time}-${row.end_time}`,
          time: `${formatTime(row.start_time)} – ${formatTime(row.end_time)}`,
          minutes: row.minutes,
          breakLabel: wide,
          cells: Object.fromEntries(days.map(({ day }) => {
            if (breaks[day]) return [day, [{ lines: [breaks[day]], colorKey: -1 }]];
            const cell = row.cells[day];
            return [day, cell ? [{ lines: [cell.subject, cell.room].filter((line) => Boolean(line)).map(String), colorKey: colorKeyOf(cell.subject) }] : []];
          })),
        };
      });
    return { name: pattern.name, week: { days, rows, totals: Object.fromEntries(days.map(({ day }) => [day, week.totals[day] ?? "–"])), totalLabel: "Total time" } };
  });
}

/** @type {import("@/router.js").RenderPage} */
export async function renderGuestSection(container, { params }) {
  const sectionId = Number(params.sectionId);
  const content = h("div", { class: "mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-5 print:p-0" }, skeletonList(3));
  container.append(publicShell(content, { school: await schoolOrNothing() }));

  /** @type {import("@/api/guest.js").GuestSection} */
  let data;
  try {
    data = await getGuestSection(sectionId);
  } catch (error) {
    replace(content, h("a", { href: "/guest", class: "btn btn-quiet px-0" }, icon("arrow-left"), "All sections"), h("p", { role: "alert", class: "rounded-lg border border-danger/40 bg-danger/5 p-3 text-danger" }, error instanceof ApiError && error.status === 404 ? "This schedule could not be found. The link may be from another school year." : "This schedule could not be loaded. Please try again later."));
    return;
  }

  const qrArea = h("div", { hidden: true, class: "card w-fit space-y-2 bg-white p-4 text-center" });
  const shareLink = location.href;

  const actions = h(
    "div",
    { class: "no-print grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" },
    h("button", { type: "button", class: "btn btn-outline", onclick: () => window.print() }, icon("printer"), "Print"),
    h("button", {
      type: "button",
      class: "btn btn-outline",
      onclick: async () => {
        try {
          await navigator.clipboard.writeText(shareLink);
          toast.success("The link was copied. Share it with your class.");
        } catch {
          toast.info(`Copy this link: ${shareLink}`);
        }
      },
    }, icon("link"), "Copy link"),
    h("button", {
      type: "button",
      class: "btn btn-outline",
      "aria-expanded": "false",
      onclick: async (/** @type {MouseEvent} */ event) => {
        const button = /** @type {HTMLElement} */ (event.currentTarget);
        if (qrArea.hidden) {
          // The QR library makes the picture; it holds only the link to this page.
          const svg = await QRCode.toString(shareLink, { type: "svg", margin: 2, width: 200 });
          replace(qrArea, h("div", { role: "img", "aria-label": `QR code for the schedule of ${data.label}`, class: "mx-auto size-48 [&_svg]:size-full" }), h("p", { class: "text-small text-neutral-700" }, "Scan to open this schedule."));
          /** @type {HTMLElement} */ (qrArea.firstElementChild).innerHTML = svg;
        }
        qrArea.hidden = !qrArea.hidden;
        button.setAttribute("aria-expanded", String(!qrArea.hidden));
      },
    }, icon("qr"), "QR code"),
    downloadButtons({ basePath: `/guest/sections/${sectionId}/class-program`, label: `Class Program of ${data.label}`, formats: ["pdf"] }),
  );

  replace(
    content,
    h("a", { href: "/guest", class: "no-print btn btn-quiet px-0" }, icon("arrow-left"), "All sections"),
    h(
      "div",
      null,
      h("h1", { class: "text-2xl font-bold text-brand" }, data.label),
      h("p", { class: "text-sm text-muted-foreground" }, `${data.term.name}, SY ${data.term.school_year}`),
      data.state === "ready" && data.adviser ? h("p", { class: "text-sm" }, `Class Adviser: ${data.adviser}`) : null,
      data.state === "ready" && data.co_adviser ? h("p", { class: "text-sm" }, `Co-Adviser: ${data.co_adviser}`) : null,
    ),
    data.state !== "ready"
      ? h("div", { role: "status", class: "rounded-lg border border-warning/40 bg-amber-50 p-4 text-amber-900 dark:bg-amber-950 dark:text-amber-100" }, h("p", { class: "font-medium" }, data.state === "updating" ? "Schedule is being updated" : "This schedule is not ready yet"), h("p", { class: "text-sm" }, "Please check again once the school has approved it."))
      : [
          actions,
          qrArea,
          guestBlocks(/** @type {import("@/api/guest.js").GuestWeek} */ (data.week)).map((block) => h("section", { "aria-label": block.name, class: "space-y-2" }, h("h2", { class: "font-semibold text-accent" }, block.name), weekTable(block.week))),
        ],
  );
}
