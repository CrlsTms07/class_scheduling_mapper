// @ts-check
/**
 * A section's schedule: where classes are placed, moved and submitted.
 *
 * - The schedule comes first on phones (design audit, Must fix #3); the subjects are one tap away.
 * - One view switch, Day cards or Weekly grid, remembered (Must fix #4).
 * - Placing: tap a period, or pick a subject and tap the periods that light up (they fit and are
 *   free, UI requirement 6), or drag a subject or a class. Everything else goes through the one
 *   "Add / Edit class" dialog (Must fix #10).
 */
import { h, replace } from "@/lib/dom.js";
import { icon } from "@/components/icons.js";
import { confirmAction, setBusy } from "@/components/dialog.js";
import { skeletonPage } from "@/components/loading.js";
import { toast } from "@/components/toast.js";
import { api, downloadFile } from "@/api/client.js";
import { assignSlot, clearSchedule, conflictDetailsOf, getFreePeriods, getPlotter, moveEntry, plotterKey, reviseSchedule } from "@/api/schedule.js";
import { watch } from "@/state/cache.js";
import { isColorCoding, session } from "@/state/session.js";
import { termState } from "@/state/term.js";
import { DAY_NAMES, FLAG_FIXES, STATUS_COLORS, STATUS_LABELS, entryAt, fittingPeriods, hasSubject, minutesText, patternOfSlot, planMove, subjectColor } from "@/lib/schedule.js";
import { openClassDialog } from "./class-dialog.js";
import { openSubmitDialog } from "./submit-dialog.js";
import { dayCardsView, gridView, phoneDayView, readView, saveView } from "./schedule-views.js";
import { enableDrag } from "./drag.js";

/** @typedef {import("@/lib/schedule.js").Plotter} Plotter */
/** @typedef {import("@/lib/schedule.js").TimeSlot} TimeSlot */

/** @type {import("@/router.js").RenderPage} */
export async function render(container, { params }) {
  const sectionId = Number(params.sectionId);
  const term = termState.term;

  if (!term) {
    container.append(h("p", { class: "p-6 text-sm" }, "There is no school year yet. The Admin starts one on the School Years page."));
    return;
  }
  const termId = term.id;

  replace(container, skeletonPage());

  /** @type {Plotter} */
  let plotter;
  try {
    plotter = await getPlotter(termId, sectionId);
  } catch (error) {
    replace(
      container,
      h("div", { class: "space-y-3 p-4 sm:p-6" }, h("a", { href: "/schedule", class: "btn btn-quiet px-0" }, icon("arrow-left"), "All sections"), h("p", { role: "alert", class: "text-danger" }, "This section is not available in the term selected at the top.")),
    );
    return;
  }

  /** @type {{ view: "days" | "grid", day: number, patternId: number | null, placingId: number | null, fitting: Set<string>, removed: string[] }} */
  const ui = { view: readView(), day: 1, patternId: null, placingId: null, fitting: new Set(), removed: [] };

  const draw = () => {
    const { section, status, loading, patterns, entries, flags } = plotter;
    const canEdit = plotter.can_edit;
    const isColored = isColorCoding();
    const placing = loading.find(({ id }) => id === ui.placingId);
    const viewProps = { plotter, isColored, canEdit, fitting: ui.fitting, onTap };
    const completeCount = loading.filter((item) => item.scheduled_minutes === item.required_minutes).length;

    const header = h(
      "div",
      { class: "card overflow-hidden" },
      h(
        "div",
        { class: "flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between" },
        h(
          "div",
          { class: "flex min-w-0 items-start gap-3" },
          h("div", { class: "flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand text-white" }, icon("table", "size-5")),
          h(
            "div",
            { class: "min-w-0" },
            h("div", { class: "flex flex-wrap items-center gap-2" }, h("h1", { class: "text-xl font-semibold text-brand" }, section.label), h("span", { class: `badge ${STATUS_COLORS[status]}` }, STATUS_LABELS[status])),
            h("p", { class: "text-sm text-muted-foreground" }, `Adviser: ${section.adviser ?? "None yet"} · ${section.level === "SHS" ? "Senior High" : "Junior High"} · ${term.name}, SY ${term.school_year.name}`),
          ),
        ),
        canEdit && status === "draft" ? h("button", { type: "button", class: "btn btn-primary", onclick: () => openSubmitDialog({ plotter, termId }) }, icon("send"), "Submit for approval") : null,
      ),
      h(
        "div",
        { class: "flex flex-wrap items-center gap-1 border-t bg-surface-muted px-4 py-1" },
        h("span", { class: "mr-2 text-small font-medium uppercase tracking-wide text-muted-foreground" }, "Class Program"),
        ["pdf", "csv"].map((extension) => downloadButton(extension)),
      ),
    );

    const alerts = [];
    if (status === "pending") alerts.push(notice("success", "Submitted. This schedule is locked while it waits for the Admin."));
    if (status === "approved") alerts.push(notice("success", `Approved${plotter.last_review ? ` by ${plotter.last_review.reviewed_by}` : ""}. This schedule is locked.`));
    if (status === "rejected") {
      alerts.push(
        h(
          "div",
          { class: "space-y-2" },
          notice("danger", `Rejected${plotter.last_review ? ` by ${plotter.last_review.reviewed_by}: ${plotter.last_review.remarks}` : "."}`),
          plotter.can_plot ? reviseButton() : null,
        ),
      );
    }
    if (status === "draft" && plotter.last_review && plotter.last_review.action !== "approve") {
      alerts.push(notice("danger", `${plotter.last_review.action === "reject" ? "Rejected" : "Reopened"} by ${plotter.last_review.reviewed_by}: ${plotter.last_review.remarks}`));
    }
    if (ui.removed.length) {
      alerts.push(h("div", { role: "alert", class: "rounded-lg border border-danger/40 bg-danger/5 p-3 text-sm text-danger" }, h("p", { class: "font-medium" }, "These classes could not come back. Please place them again:"), h("ul", { class: "list-disc pl-5" }, ui.removed.map((item) => h("li", null, item)))));
    }

    const setup =
      loading.length === 0
        ? notice("info", h("span", null, "This section has no subjects with teachers yet. ", h("a", { href: "/teacher-loading", class: "inline-flex min-h-11 items-center font-medium text-brand underline" }, "Open Teacher Loading"), " to add them first."))
        : patterns.length === 0
          ? h(
              "div",
              { class: "card space-y-2 p-4" },
              h("p", { class: "text-sm" }, "This section has no class times yet. Add its first class by choosing the start and end time; the class hours are made from it."),
              h("div", { class: "flex flex-wrap gap-2" }, canEdit ? h("button", { type: "button", class: "btn btn-primary", onclick: () => openClassDialog({ plotter, termId, target: { day: 1 } }) }, icon("plus"), "Add a class by time") : null, h("a", { href: "/time-slots", class: "btn btn-outline" }, icon("clock"), "Class Hours (optional)")),
            )
          : null;

    const subjects = loading.length
      ? h(
          "details",
          { class: "card group lg:open", open: window.matchMedia("(min-width: 1024px)").matches },
          h(
            "summary",
            { class: "flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 p-3 font-medium" },
            h("span", null, `Subjects · ${completeCount} of ${loading.length} complete`),
            icon("chevron-down", "size-4 transition group-open:rotate-180"),
          ),
          h(
            "div",
            { class: "space-y-2 p-3 pt-0" },
            canEdit ? h("p", { class: "field-help" }, "Tap a subject, then tap a lit period to place it. You can also drag a subject onto a period.") : null,
            h(
              "ul",
              { class: "space-y-2" },
              loading.map((item) => {
                const isOn = ui.placingId === item.id;
                const subjectFlags = flags.filter((flag) => flag.section_subject_id === item.id);
                const progress = Math.min(100, Math.round((item.scheduled_minutes / Math.max(1, item.required_minutes)) * 100));
                return h(
                  "li",
                  null,
                  h(
                    "button",
                    {
                      type: "button",
                      "aria-pressed": String(isOn),
                      disabled: !canEdit,
                      "data-drag": canEdit ? `new:${item.id}` : null,
                      class: `w-full rounded-lg border p-2 text-left text-sm ${subjectColor(item.id, isColored)} ${isOn ? "ring-2 ring-brand" : ""}`,
                      onclick: () => choosePlacing(isOn ? null : item.id),
                    },
                    h("span", { class: "flex items-start justify-between gap-2" }, h("span", { class: "font-medium" }, item.subject), item.is_priority ? h("span", { class: "badge bg-surface text-foreground" }, "Priority") : null),
                    h("span", { class: "block text-small opacity-90" }, item.teacher),
                    h("span", { class: "block text-small opacity-90" }, minutesText(item)),
                    h("span", { class: "mt-1 block h-1.5 overflow-hidden rounded-full bg-black/10" }, h("span", { class: "block h-full bg-current opacity-60", style: { width: `${progress}%` } })),
                    subjectFlags.length ? h("span", { class: "mt-1 flex items-center gap-1 text-small font-medium text-danger" }, icon("warning"), subjectFlags[0].message) : null,
                  ),
                );
              }),
            ),
          ),
        )
      : null;

    const viewSwitch = h(
      "div",
      { role: "tablist", "aria-label": "View", class: "grid w-full grid-cols-2 overflow-hidden rounded-lg border sm:w-80 max-md:portrait:hidden" },
      /** @type {const} */ ([["days", "Day cards"], ["grid", "Weekly grid"]]).map(([value, label]) =>
        h("button", { type: "button", role: "tab", "aria-selected": String(ui.view === value), class: `btn rounded-none ${ui.view === value ? "bg-brand text-white" : "bg-surface"}`, onclick: () => { ui.view = value; saveView(value); draw(); } }, label),
      ),
    );

    const pattern = patterns.find(({ id }) => id === ui.patternId) ?? patterns[0];
    const wide =
      patterns.length === 0
        ? null
        : ui.view === "days"
          ? dayCardsView(viewProps)
          : h(
              "div",
              { class: "space-y-3" },
              patterns.length > 1 ? h("div", { role: "tablist", "aria-label": "Bell schedule", class: "flex flex-wrap gap-2" }, patterns.map((item) => h("button", { type: "button", role: "tab", "aria-selected": String(item.id === pattern.id), class: `btn border ${item.id === pattern.id ? "border-brand bg-brand text-white" : "bg-surface"}`, onclick: () => { ui.patternId = item.id; draw(); } }, item.name))) : null,
              gridView(viewProps, pattern),
            );

    const schedule =
      patterns.length === 0
        ? null
        : h(
            "div",
            { class: "space-y-3", "data-schedule": "" },
            placing
              ? h(
                  "div",
                  { role: "status", class: "sticky top-[5rem] z-20 flex items-center justify-between gap-2 rounded-lg border-2 border-brand bg-surface p-2 text-sm shadow" },
                  h("p", { class: "min-w-0" }, h("strong", null, `Placing ${placing.subject}. `), ui.fitting.size ? "Tap a lit period." : "No free period fits it right now."),
                  h("button", { type: "button", class: "btn btn-outline shrink-0", onclick: () => choosePlacing(null) }, icon("check"), "Done"),
                )
              : null,
            h(
              "div",
              { class: "flex flex-wrap items-center justify-between gap-2" },
              viewSwitch,
              h("button", { type: "button", class: "btn btn-quiet", "aria-pressed": String(isColored), onclick: toggleColors }, icon("table"), isColored ? "Colors: on" : "Colors: off"),
            ),
            h("div", { class: "max-md:portrait:hidden" }, wide),
            h("div", { class: "hidden max-md:portrait:block" }, phoneDayView(viewProps, ui.day, (day) => { ui.day = day; draw(); })),
          );

    const clearArea =
      plotter.can_plot && (status === "draft" || status === "rejected") && entries.length > 0
        ? h("div", { class: "border-t pt-4" }, clearButton())
        : null;

    replace(
      container,
      h(
        "div",
        { class: "space-y-4 p-4 sm:p-6" },
        h("nav", { "aria-label": "Breadcrumb", class: "flex flex-wrap items-center gap-1 text-sm text-muted-foreground" }, h("a", { href: "/dashboard", class: "inline-flex min-h-11 min-w-11 items-center justify-center px-1 hover:text-brand" }, "Home"), " · ", h("a", { href: "/schedule", class: "inline-flex min-h-11 min-w-11 items-center justify-center px-1 hover:text-brand" }, "Schedule"), " · ", h("span", { class: "text-brand", "aria-current": "page" }, section.label)),
        header,
        alerts,
        flagsPanel(),
        setup,
        h("div", { class: "gap-4 space-y-4 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:space-y-0" }, h("div", { class: "lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:self-start lg:overflow-y-auto" }, subjects), h("div", { class: `min-w-0 ${subjects ? "" : "lg:col-span-2"}` }, schedule)),
        clearArea,
      ),
    );
  };

  /* ---------- Pieces ---------- */

  /**
   * @param {"success" | "danger" | "info"} kind
   * @param {import("@/lib/dom.js").Child} message
   */
  function notice(kind, message) {
    const styles = { success: "border-success/40 bg-success/5 text-success", danger: "border-danger/40 bg-danger/5 text-danger", info: "border-border bg-surface-muted text-foreground" };
    return h("div", { role: kind === "danger" ? "alert" : "status", class: `rounded-lg border p-3 text-sm ${styles[kind]}` }, message);
  }

  /** The flags of the schedule, each with how to fix it (design audit, Must fix: plain words and a fix). */
  function flagsPanel() {
    if (plotter.patterns.length === 0 || plotter.loading.length === 0) return null;
    if (plotter.flags.length === 0) return notice("success", "No flags. This schedule follows the rules so far.");
    const red = plotter.flags.filter(({ severity }) => severity === "red").length;
    return h(
      "details",
      { class: "card" },
      h("summary", { class: "flex min-h-11 cursor-pointer items-center gap-2 p-3 text-sm" }, icon("warning", "size-4 text-warning"), h("span", { class: "font-medium" }, `${plotter.flags.length} ${plotter.flags.length === 1 ? "flag" : "flags"} to check`), red ? h("span", { class: "badge bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100" }, `${red} urgent`) : null),
      h(
        "ul",
        { class: "space-y-2 p-3 pt-0" },
        plotter.flags.map((flag) => {
          const fix = FLAG_FIXES[flag.type];
          return h(
            "li",
            { class: `rounded-lg p-2 text-sm ${flag.severity === "red" ? "bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100" : "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100"}` },
            h("p", null, flag.message, flag.acknowledged ? " (acknowledged)" : ""),
            fix ? h("p", { class: "text-small" }, `How to fix: ${fix.text} `, fix.to ? h("a", { href: fix.to, class: "inline-flex min-h-11 items-center font-medium underline" }, `Open ${fix.label}`) : null) : null,
            flag.section_subject_id && plotter.can_edit ? h("button", { type: "button", class: "btn btn-outline mt-1", onclick: () => choosePlacing(flag.section_subject_id ?? null) }, icon("pencil"), "Fix") : null,
          );
        }),
      ),
    );
  }

  /** @param {string} extension */
  function downloadButton(extension) {
    const button = /** @type {HTMLButtonElement} */ (
      h(
        "button",
        {
          type: "button",
          class: "btn btn-quiet px-3",
          onclick: async () => {
            setBusy(button, true, "Preparing...");
            try {
              const name = await downloadFile(`/terms/${termId}/sections/${sectionId}/class-program.${extension}`);
              toast.success(`${name} was downloaded.`);
            } catch (error) {
              toast.error(error);
            } finally {
              setBusy(button, false);
            }
          },
        },
        icon("download"),
        extension.toUpperCase(),
      )
    );
    return button;
  }

  function reviseButton() {
    const button = /** @type {HTMLButtonElement} */ (
      h(
        "button",
        {
          type: "button",
          class: "btn btn-primary",
          onclick: async () => {
            setBusy(button, true, "Opening...");
            try {
              ui.removed = await reviseSchedule(termId, sectionId);
              toast.success("The schedule is open for changes again.");
            } catch (error) {
              toast.error(error);
              setBusy(button, false);
            }
          },
        },
        icon("pencil"),
        "Revise this schedule",
      )
    );
    return button;
  }

  function clearButton() {
    return h(
      "button",
      {
        type: "button",
        class: "btn btn-outline text-danger",
        onclick: async () => {
          const isSure = await confirmAction({
            title: "Clear this schedule?",
            message: `This removes all ${plotter.entries.length} classes of ${plotter.section.label} so you can start over. The teacher loading stays.`,
            confirmLabel: "Yes, clear it",
          });
          if (!isSure) return;
          try {
            await clearSchedule(termId, sectionId);
            toast.success(`The schedule of ${plotter.section.label} was cleared.`);
          } catch (error) {
            toast.error(error);
          }
        },
      },
      icon("eraser"),
      "Clear this schedule",
    );
  }

  async function toggleColors() {
    const next = !isColorCoding();
    try {
      const { data } = /** @type {{ data: any }} */ (await api("/me/preferences", { method: "PUT", body: { color_coding: next } }));
      session.user = data;
      draw();
      toast.success(next ? "Subject colors are on." : "Subject colors are off.");
    } catch (error) {
      toast.error(error);
    }
  }

  /* ---------- Placing ---------- */

  /**
   * Picks a subject to place by tapping, and lights the periods it fits (UI requirement 6).
   * @param {number | null} loadingId
   */
  async function choosePlacing(loadingId) {
    ui.placingId = loadingId;
    ui.fitting = new Set();
    draw();
    const item = plotter.loading.find(({ id }) => id === loadingId);
    if (!item) return;
    try {
      const free = await getFreePeriods(termId, sectionId, { teacherId: item.teacher_id, roomId: plotter.section.home_room_id });
      if (ui.placingId !== loadingId) return;
      ui.fitting = new Set(fittingPeriods({ patterns: plotter.patterns, loading: item, free }).flatMap(({ slot, freeDays }) => freeDays.map((day) => `${slot.id}:${day}`)));
      draw();
      document.querySelector("[data-schedule]")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      toast.error(error);
    }
  }

  /**
   * A tap on a period. With a subject picked and a lit period, it is placed at once;
   * anything else opens the "Add / Edit class" dialog.
   * @param {TimeSlot} slot
   * @param {number} day
   */
  function onTap(slot, day) {
    const entry = entryAt(plotter.entries, day, slot);
    if (ui.placingId && !hasSubject(entry) && ui.fitting.has(`${slot.id}:${day}`)) {
      placeQuickly(slot, day, ui.placingId);
      return;
    }
    if (!plotter.can_edit && !hasSubject(entry)) return;
    openClassDialog({ plotter, termId, target: { slot, day, loadingId: hasSubject(entry) ? undefined : ui.placingId ?? undefined } });
  }

  /**
   * Places a subject on a free period: JHS on every lit day of that period, SHS on the one day.
   * A conflict opens the dialog to explain it and offer free rooms and teachers.
   * @param {TimeSlot} slot
   * @param {number} day
   * @param {number} loadingId
   */
  async function placeQuickly(slot, day, loadingId) {
    const pattern = patternOfSlot(plotter.patterns, slot.id);
    const roomId = entryAt(plotter.entries, day, slot)?.room_id ?? plotter.section.home_room_id;
    const item = plotter.loading.find(({ id }) => id === loadingId);
    if (!pattern || !item) return;
    if (!roomId) {
      openClassDialog({ plotter, termId, target: { slot, day, loadingId } });
      return;
    }
    const days = (plotter.section.level === "JHS" ? pattern.days : [day]).filter((item2) => ui.fitting.has(`${slot.id}:${item2}`) && !hasSubject(entryAt(plotter.entries, item2, slot)));
    try {
      await assignSlot(termId, sectionId, { slotId: slot.id, section_subject_id: loadingId, room_id: roomId, days });
      toast.success(`${item.subject} was placed on ${days.map((item2) => DAY_NAMES[item2]).join(", ")}.`);
      if (ui.placingId) choosePlacing(ui.placingId);
    } catch (error) {
      openClassDialog({ plotter, termId, target: { slot, day, loadingId, error } });
    }
  }

  /**
   * A drop from the subject list ("new:<subject>") or a placed class ("<subject>:<period>:<day>").
   * @param {string} dragged
   * @param {string} target  "<period>:<day>"
   */
  async function onDrop(dragged, target) {
    const [slotId, day] = target.split(":").map(Number);
    const slot = plotter.patterns.flatMap(({ slots }) => slots).find(({ id }) => id === slotId);
    if (!slot || slot.is_break) return;

    if (dragged.startsWith("new:")) {
      const loadingId = Number(dragged.slice(4));
      if (hasSubject(entryAt(plotter.entries, day, slot))) {
        openClassDialog({ plotter, termId, target: { slot, day } });
        return;
      }
      const item = plotter.loading.find(({ id }) => id === loadingId);
      const roomId = plotter.section.home_room_id;
      const pattern = patternOfSlot(plotter.patterns, slot.id);
      if (!item || !roomId || !pattern) {
        openClassDialog({ plotter, termId, target: { slot, day, loadingId } });
        return;
      }
      const days = (plotter.section.level === "JHS" ? pattern.days : [day]).filter((item2) => !hasSubject(entryAt(plotter.entries, item2, slot)));
      try {
        await assignSlot(termId, sectionId, { slotId: slot.id, section_subject_id: loadingId, room_id: roomId, days });
        toast.success(`${item.subject} was placed.`);
      } catch (error) {
        openClassDialog({ plotter, termId, target: { slot, day, loadingId, error } });
      }
      return;
    }

    const [loadingId, fromSlotId, fromDay] = dragged.split(":").map(Number);
    const fromSlot = plotter.patterns.flatMap(({ slots }) => slots).find(({ id }) => id === fromSlotId);
    if (!fromSlot) return;
    const plan = planMove({ loadingId, slot, day, from: { slot: fromSlot, day: fromDay } }, plotter.patterns, plotter.entries, plotter.section.level);
    if (!plan) return;
    try {
      await moveEntry(termId, sectionId, { slotId: slot.id, from_slot_id: fromSlot.id, ...plan });
      toast.success("The class was moved.");
    } catch (error) {
      const details = conflictDetailsOf(error);
      toast.error(details ? `Not moved. ${details.conflicts.map(({ message }) => message).join(" ")}` : error);
    }
  }

  /* ---------- Staying in step ---------- */

  const stopWatching = watch(plotterKey(termId, sectionId), async () => {
    try {
      plotter = await getPlotter(termId, sectionId);
      if (ui.placingId && !plotter.loading.some(({ id }) => id === ui.placingId)) ui.placingId = null;
      draw();
    } catch (error) {
      toast.error(error);
    }
  });
  const stopDrag = enableDrag(container, onDrop);

  draw();

  return () => {
    stopWatching();
    stopDrag();
  };
}
