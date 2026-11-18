// @ts-check
/**
 * Ways to start a schedule, all from "New schedule" (team decision, Nov 17, 2026): build it on a
 * timetable, copy another term's schedule, or import the school's Excel file. Plus "Add section"
 * on a room card.
 */
import { h, replace } from "@/lib/dom.js";
import { openDialog, setBusy } from "@/components/dialog.js";
import { icon } from "@/components/icons.js";
import { searchableSelect } from "@/components/searchable-select.js";
import { toast } from "@/components/toast.js";
import { errorMessage } from "@/api/client.js";
import { copySchedule, getYearSections, importSchedule, setSectionRoom } from "@/api/schedule.js";
import { STATUS_LABELS } from "@/lib/schedule.js";
import { copyScopes, copySummaryLines, scopeToInput } from "@/lib/schedule-map.js";
import { termWord } from "@/state/term.js";

/**
 * @typedef {import("@/state/term.js").Term} Term
 * @typedef {import("@/lib/schedule-map.js").SectionSummary} SectionSummary
 */

/**
 * New schedule: choose the section, then how to start it.
 * @param {{ term: Term, otherTerms: Term[], sections: SectionSummary[], navigate: (path: string) => void }} props
 */
export function openNewScheduleDialog({ term, otherTerms, sections, navigate }) {
  // Sections not started yet come first, since those are the ones to make.
  const ordered = [...sections].sort((a, b) => Number(a.status !== "not_started") - Number(b.status !== "not_started") || a.grade - b.grade || a.name.localeCompare(b.name));
  let sectionId = ordered[0]?.id ?? null;

  if (ordered.length === 0) {
    const { close } = openDialog({
      title: "New schedule",
      size: "sm",
      body: h("p", { class: "text-sm" }, "There is no section to schedule yet. Add the sections of your grade levels first."),
      footer: [h("button", { type: "button", class: "btn btn-outline", onclick: () => close() }, "Close"), h("a", { href: "/sections", class: "btn btn-primary", onclick: () => close() }, icon("plus"), "Add a section")],
    });
    return;
  }

  const way = (/** @type {import("@/components/icons.js").IconName} */ iconName, /** @type {string} */ title, /** @type {string} */ detail, /** @type {() => void} */ onChoose) =>
    h(
      "li",
      null,
      h(
        "button",
        { type: "button", class: "flex w-full items-start gap-3 rounded-xl border bg-surface p-3 text-left hover:border-brand hover:bg-brand-soft", onclick: onChoose },
        h("span", { class: "flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand" }, icon(iconName, "size-5")),
        h("span", { class: "min-w-0" }, h("span", { class: "block font-semibold" }, title), h("span", { class: "block text-small text-muted-foreground" }, detail)),
      ),
    );

  const { close } = openDialog({
    title: "New schedule",
    description: "Choose the section, then how you want to start.",
    body: h(
      "div",
      { class: "space-y-5" },
      searchableSelect({
        label: "1. Section",
        value: sectionId,
        options: ordered.map((section) => ({ value: section.id, label: `Grade ${section.grade} – ${section.name}`, hint: STATUS_LABELS[section.status] })),
        onChange: (value) => (sectionId = Number(value)),
      }),
      h("a", { href: "/sections", class: "btn btn-quiet -mt-3 px-0 text-brand", onclick: () => close() }, icon("plus"), "The section is not here? Add a section"),
      h(
        "div",
        { class: "space-y-2" },
        h("p", { class: "field-label" }, "2. How do you want to start?"),
        h(
          "ul",
          { class: "space-y-2" },
          way("calendar-plus", "Build it on a timetable", "Open the section's week. Tap a period, then choose the subject, teacher and room. Minutes add up by themselves.", () => {
            close();
            navigate(`/schedule/sections/${sectionId}`);
          }),
          otherTerms.length > 0
            ? way("copy", `Copy another ${termWord(term)}'s schedule`, "Start from a schedule already made this school year, then edit only what changed.", () => {
                close();
                openCopyDialog({ term, otherTerms, sections });
              })
            : null,
          way("file-up", "Import from a file", "Choose the school's Excel schedule, and review every row first.", () => {
            close();
            openImportDialog({ term });
          }),
        ),
      ),
      h("p", { class: "flex gap-2 rounded-lg bg-surface-muted p-3 text-small text-muted-foreground" }, icon("clipboard", "size-4 shrink-0 text-brand"), h("span", null, "Each subject needs its teacher first. If a section has no subjects on its timetable, set them in ", h("a", { href: "/teacher-loading", class: "inline-flex min-h-11 items-center font-medium text-brand underline md:min-h-0", onclick: () => close() }, "Teacher Loading"), ".")),
    ),
    footer: h("button", { type: "button", class: "btn btn-outline", onclick: () => close() }, "Close"),
  });
}

/**
 * Copy another term's schedule: choose, review what would happen, then confirm.
 * @param {{ term: Term, otherTerms: Term[], sections: SectionSummary[] }} props
 */
export function openCopyDialog({ term, otherTerms, sections }) {
  const choice = { fromTermId: otherTerms[0].id, scope: "all", fillSubjects: true };
  /** @type {import("@/lib/schedule-map.js").CopyResult | null} */
  let review = null;
  const reviewArea = h("div", { "aria-live": "polite" });
  const errorArea = h("div", { role: "alert" });

  const fill = /** @type {HTMLInputElement} */ (h("input", { type: "checkbox", checked: true, class: "mt-0.5 size-5 shrink-0 accent-[var(--brand)]", onchange: () => { choice.fillSubjects = fill.checked; outdated(); } }));
  const action = /** @type {HTMLButtonElement} */ (h("button", { type: "button", class: "btn btn-primary", onclick: () => send() }, "Review"));

  const outdated = () => {
    review = null;
    reviewArea.replaceChildren();
    action.textContent = "Review";
    action.hidden = false;
  };

  const send = async () => {
    const isReview = review === null;
    errorArea.replaceChildren();
    setBusy(action, true, isReview ? "Checking..." : "Copying...");
    try {
      const result = await copySchedule(term.id, { from_term_id: choice.fromTermId, ...scopeToInput(choice.scope), fill_subjects: choice.fillSubjects, preview: isReview });
      setBusy(action, false);
      const lines = copySummaryLines(result);
      if (isReview) {
        review = result;
        replace(reviewArea, h("div", { class: "space-y-1 rounded-lg border border-warning/40 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100" }, h("p", { class: "font-medium" }, result.entries > 0 ? "This is what will happen:" : "There is nothing to copy."), lines.map((line) => h("p", null, line))));
        action.textContent = "Confirm copy";
        action.hidden = result.entries === 0;
      } else {
        toast.success(result.entries > 0 ? `Copied ${result.entries} periods. Open each section to finish it.` : "Nothing was copied.");
        close();
      }
    } catch (error) {
      setBusy(action, false);
      replace(errorArea, h("p", { class: "rounded-lg border border-danger/40 bg-danger/5 p-3 text-sm text-danger" }, errorMessage(error)));
      toast.error(error);
    }
  };

  const { close } = openDialog({
    title: `Copy from another ${termWord(term)}`,
    description: `Starts ${term.name} with the same days, times and rooms. Sections that already have a schedule in ${term.name} stay as they are.`,
    body: h(
      "div",
      { class: "space-y-4" },
      errorArea,
      searchableSelect({ label: "Copy from", value: choice.fromTermId, options: otherTerms.map(({ id, name }) => ({ value: id, label: name })), onChange: (value) => { choice.fromTermId = Number(value); outdated(); } }),
      searchableSelect({ label: "Which sections", value: choice.scope, options: copyScopes(sections), onChange: (value) => { choice.scope = String(value); outdated(); } }),
      h("label", { class: "flex min-h-11 items-start gap-3 rounded-lg border p-3 text-sm" }, fill, h("span", null, `Also copy the teachers, and fill in subjects that continue to ${term.name}. Otherwise every period becomes an open slot.`)),
      reviewArea,
    ),
    footer: [h("button", { type: "button", class: "btn btn-outline", onclick: () => close() }, "Cancel"), action],
  });
}

/** @type {Record<string, [string, string]>} */
const MISSING_LABELS = {
  sections: ["section", "sections"],
  bell_schedules: ["bell schedule", "bell schedules"],
  subjects: ["subject", "subjects"],
  teachers: ["teacher", "teachers"],
  rooms: ["room", "rooms"],
};

/** @param {any} result */
const missingKinds = (result) => Object.keys(MISSING_LABELS).filter((kind) => (result.missing?.[kind]?.count ?? 0) > 0);
/**
 * @param {number} count
 * @param {[string, string]} words
 */
const plural = (count, [one, many]) => `${count} ${count === 1 ? one : many}`;

/**
 * The rows left out, as a CSV the user can open in Excel and fix.
 * @param {any} result
 */
function downloadLeftOut(result) {
  const cell = (/** @type {string | number} */ value) => `"${String(value).replace(/"/g, '""')}"`;
  const lines = [
    ["Row", "Section", "Day", "Time", "Subject", "Teacher", "Room", "Why it was left out"].map(cell).join(","),
    ...result.rows.filter((/** @type {any} */ row) => row.status === "error").map((/** @type {any} */ row) => [row.row, row.section, row.day, row.time, row.subject, row.teacher, row.room, row.message ?? ""].map(cell).join(",")),
  ];
  const url = URL.createObjectURL(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: "rows-left-out.csv" });
  link.click();
  URL.revokeObjectURL(url);
  toast.success("rows-left-out.csv was downloaded.");
}

/**
 * Import from a file: every row is reviewed first. What the file names but the system lacks can
 * be set up from the file. Used classes become drafts to edit on each section's schedule.
 * @param {{ term: Term }} props
 */
export function openImportDialog({ term }) {
  /** @type {File | null} */
  let file = null;
  let isDone = false;
  /** @type {any} */
  let review = null;
  const errorArea = h("div", { role: "alert" });
  const reviewArea = h("div", { "aria-live": "polite" });
  const fileInput = /** @type {HTMLInputElement} */ (h("input", { type: "file", accept: ".xlsx,.pdf", class: "hidden", "aria-label": "Schedule file" }));
  const fileButton = h("button", { type: "button", class: "btn btn-outline w-full", onclick: () => fileInput.click() }, icon("file-up"), h("span", { class: "truncate" }, "Choose an Excel (.xlsx) or PDF file"));
  const main = /** @type {HTMLButtonElement} */ (h("button", { type: "button", class: "btn btn-primary", disabled: true, onclick: () => (isDone ? close() : send(review === null, review?.set_up ?? false)) }, "Review"));
  const secondary = /** @type {HTMLButtonElement} */ (h("button", { type: "button", class: "btn btn-outline", onclick: () => close() }, "Cancel"));

  fileInput.addEventListener("change", () => {
    file = fileInput.files?.[0] ?? null;
    fileInput.value = "";
    review = null;
    reviewArea.replaceChildren();
    errorArea.replaceChildren();
    replace(fileButton, icon("file-up"), h("span", { class: "truncate" }, file ? file.name : "Choose an Excel (.xlsx) or PDF file"));
    main.disabled = !file;
    main.textContent = "Review";
  });

  const missingList = (/** @type {any} */ result) =>
    h("ul", { class: "space-y-2 text-sm" }, missingKinds(result).map((kind) => {
      const { count, names } = result.missing[kind];
      return h("li", null, h("p", { class: "font-medium" }, plural(count, MISSING_LABELS[kind])), h("p", { class: "text-small text-muted-foreground" }, `${names.join(", ")}${count > names.length ? `, and ${count - names.length} more` : ""}`));
    }));

  const rowsList = (/** @type {any} */ result) => {
    let showAll = result.errors === 0;
    const area = h("div", { class: "space-y-2" });
    const draw = () => {
      const rows = showAll ? result.rows : result.rows.filter((/** @type {any} */ row) => row.status === "error");
      replace(
        area,
        result.errors > 0 ? h("button", { type: "button", class: "btn btn-quiet px-0 text-brand", onclick: () => { showAll = !showAll; draw(); } }, showAll ? "Show only the rows with problems" : `Show all ${result.total} rows`) : null,
        h("ul", { class: "max-h-[40dvh] divide-y overflow-y-auto rounded-lg border text-sm" }, rows.map((/** @type {any} */ row) =>
          h("li", { class: `flex gap-2 p-2 ${row.status === "error" ? "bg-danger/5" : ""}` },
            icon(row.status === "ok" ? "circle-check" : "alert", `mt-0.5 size-4 ${row.status === "ok" ? "text-success" : "text-danger"}`),
            h("div", { class: "min-w-0" },
              h("p", { class: "font-medium" }, `Row ${row.row}: ${row.section}, ${row.day} ${row.time}`),
              h("p", { class: "text-small text-muted-foreground" }, [row.subject, row.teacher, row.room && `Room ${row.room}`].filter(Boolean).join(" · ")),
              row.message ? h("p", { class: `text-small ${row.status === "error" ? "text-danger" : "text-muted-foreground"}` }, row.message) : null,
            ),
          ),
        )),
      );
    };
    draw();
    return area;
  };

  const drawReview = () => {
    const canSetUp = !review.set_up && missingKinds(review).length > 0;
    const setUpButton = /** @type {HTMLButtonElement} */ (h("button", { type: "button", class: "btn btn-primary w-full", onclick: () => send(true, true, setUpButton) }, "Set these up from the file"));
    replace(
      reviewArea,
      h(
        "section",
        { class: "space-y-3" },
        h("p", { class: "field-label" }, "2. Review"),
        review.source === "class_program" ? h("p", { class: "rounded-lg bg-sky-50 p-2 text-small text-sky-900 dark:bg-sky-950 dark:text-sky-100" }, `Read from the school's schedule: ${review.sections_found?.length ?? 0} sections.`) : null,
        canSetUp
          ? h("div", { class: "space-y-3 rounded-xl border border-warning/40 bg-amber-50 p-3 text-amber-950 dark:bg-amber-950 dark:text-amber-50" }, h("p", { class: "font-medium" }, "Not in the system yet"), missingList(review), h("p", { class: "text-small" }, "These can be set up from the file: new teachers get their name only, to be completed later on the Teachers page. Nothing is saved until you choose to use the schedule."), setUpButton)
          : null,
        review.set_up && missingKinds(review).length > 0 ? h("div", { class: "space-y-2 rounded-xl border border-success/40 bg-success/5 p-3" }, h("p", { class: "font-medium" }, "Will be set up from the file"), missingList(review)) : null,
        h("p", { class: "text-sm" }, `${review.ok} of ${review.total} rows are ready${review.errors > 0 ? `, ${review.errors} have problems and will be left out` : ""}${review.new_loadings > 0 ? `. ${review.new_loadings} subjects get teacher loading` : ""}.`),
        rowsList(review),
      ),
    );
    main.textContent = `Use this schedule (${review.ok} ${review.ok === 1 ? "class" : "classes"})`;
    main.disabled = review.ok === 0;
    secondary.textContent = "Don't use it";
  };

  /**
   * @param {any} done
   */
  const drawDone = (done) => {
    const noRoom = new Set(done.rows.filter((/** @type {any} */ row) => row.status === "ok" && row.message?.includes("No room yet")).map((/** @type {any} */ row) => row.section));
    const steps = [];
    if (noRoom.size > 0) steps.push({ text: `${noRoom.size} ${noRoom.size === 1 ? "section has" : "sections have"} classes without a room. Give each section its home room; its classes take it.`, to: "/sections", label: "Set home rooms" });
    if (done.set_up && (done.missing?.subjects?.count ?? 0) > 0) steps.push({ text: "Check the minutes per week of the new subjects.", to: "/subjects", label: "Check subjects" });
    if (done.set_up && (done.missing?.teachers?.count ?? 0) > 0) steps.push({ text: "Complete the new teachers' details, like their full names and shift.", to: "/teachers", label: "Check teachers" });
    steps.push({ text: "See if any teacher carries too much.", to: "/teacher-loading?view=teachers", label: "Check the teachers' loads" });

    replace(
      body,
      h(
        "div",
        { class: "space-y-3", role: "status" },
        h("div", { class: "space-y-1 rounded-xl border border-success/40 bg-success/5 p-3 text-sm" }, h("p", { class: "font-medium" }, `Imported ${done.ok} ${done.ok === 1 ? "class" : "classes"} as drafts.${done.errors > 0 ? ` ${done.errors} rows were left out.` : ""}`), done.set_up && missingKinds(done).length ? h("p", { class: "text-small" }, `Also set up: ${missingKinds(done).map((kind) => plural(done.missing[kind].count, MISSING_LABELS[kind])).join(", ")}.`) : null),
        h("div", { class: "space-y-2 rounded-xl border p-3" }, h("p", { class: "field-label" }, "Next steps"), h("ol", { class: "space-y-2" }, steps.map((step, index) => h("li", { class: "flex flex-wrap items-center justify-between gap-2 text-sm" }, h("span", { class: "min-w-0 flex-1" }, `${index + 1}. ${step.text}`), h("a", { href: step.to, class: "btn btn-quiet text-brand", onclick: () => close() }, step.label, icon("arrow-right"))))),
          done.errors > 0 ? h("button", { type: "button", class: "btn btn-outline w-full", onclick: () => downloadLeftOut(done) }, icon("download"), done.errors === 1 ? "Download the row left out (CSV)" : `Download the ${done.errors} rows left out (CSV)`) : null),
      ),
    );
    main.textContent = "Go to the schedules";
    main.disabled = false;
    isDone = true;
    secondary.hidden = true;
  };

  /**
   * @param {boolean} preview
   * @param {boolean} setUp
   * @param {HTMLButtonElement} [button]
   */
  const send = async (preview, setUp, button = main) => {
    if (!file) return;
    errorArea.replaceChildren();
    setBusy(button, true, preview ? "Checking..." : "Saving...");
    try {
      const result = await importSchedule(term.id, { file, preview, setUp });
      setBusy(button, false);
      if (preview) {
        review = result;
        drawReview();
      } else {
        toast.success(`Imported ${result.ok} ${result.ok === 1 ? "class" : "classes"} as drafts.`);
        drawDone(result);
      }
    } catch (error) {
      setBusy(button, false);
      replace(errorArea, h("p", { class: "rounded-lg border border-danger/40 bg-danger/5 p-3 text-sm text-danger" }, errorMessage(error)));
      toast.error(error);
    }
  };

  const body = h(
    "div",
    { class: "space-y-5" },
    errorArea,
    h(
      "section",
      { class: "space-y-2" },
      h("p", { class: "field-label" }, "1. Choose the school's Excel schedule"),
      h("p", { class: "field-help" }, "Any file name works. The system finds the schedules inside: class programs per section (JHS or SHS), the Teachers Program, or rows of Grade, Section, Day, Start, End, Subject, Teacher and Room."),
      fileInput,
      fileButton,
    ),
    reviewArea,
  );

  const { close } = openDialog({
    title: "Import from a file",
    description: `Into ${term.name}, SY ${term.school_year.name}. Classes come in as drafts, for your sections only.`,
    size: "lg",
    body,
    footer: [secondary, main],
  });
}

/**
 * "Add section" on a room: this room becomes the section's home (or usual) room.
 * @param {{ term: Term, roomId: number, roomLabel: string }} props
 */
export async function openRoomSectionDialog({ term, roomId, roomLabel }) {
  let sectionId = /** @type {number | null} */ (null);
  const select = searchableSelect({ label: "Section", placeholder: "Choose a section", options: [], onChange: (value) => { sectionId = Number(value); save.disabled = false; } });
  const save = /** @type {HTMLButtonElement} */ (
    h("button", {
      type: "button",
      class: "btn btn-primary",
      disabled: true,
      onclick: async () => {
        if (!sectionId) return;
        setBusy(save, true);
        try {
          await setSectionRoom(term.id, sectionId, roomId);
          toast.success(`${roomLabel} is now the room of that section.`);
          close();
        } catch (error) {
          toast.error(error);
          setBusy(save, false);
        }
      },
    }, "Use this room")
  );

  const { close } = openDialog({
    title: `Add a section to ${roomLabel}`,
    description: "The room becomes the one its classes use by default. Each class can still use another room.",
    size: "sm",
    body: select,
    footer: [h("button", { type: "button", class: "btn btn-outline", onclick: () => close() }, "Cancel"), save],
  });

  try {
    const sections = await getYearSections(term.school_year.id);
    select.setOptions(sections.map((section) => ({ value: section.id, label: section.label, hint: section.home_room ? `Now in ${section.home_room}` : "No room yet" })));
  } catch (error) {
    toast.error(error);
  }
}
