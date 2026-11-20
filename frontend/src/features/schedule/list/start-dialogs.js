// @ts-check
/**
 * Ways to start a schedule, all from "New schedule" (team decision, Nov 17, 2026): build it on a
 * timetable or copy another term's schedule. Schedules are never imported from a file (beneficiary
 * review, Nov 20, 2026). Plus "Add section" on a room card.
 */
import { h, replace } from "@/lib/dom.js";
import { openDialog, setBusy } from "@/components/dialog.js";
import { icon } from "@/components/icons.js";
import { searchableSelect } from "@/components/searchable-select.js";
import { toast } from "@/components/toast.js";
import { errorMessage } from "@/api/client.js";
import { copySchedule, getYearSections, setSectionRoom } from "@/api/schedule.js";
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
