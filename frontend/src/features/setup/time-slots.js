// @ts-check
/**
 * Class Hours (was Time Slots), optional: the bell schedules. They are made by themselves from the
 * times typed while plotting (beneficiary review, Nov 21, 2026); this page is for changing them.
 * A bell schedule groups days that share the
 * same periods and breaks (like Monday – Thursday, and Friday) for a department and shift.
 * Times are typed in 12-hour form (UI requirement 5).
 */
import { defaultShift, shiftChoices } from "@/lib/shifts.js";
import { subjectTabs } from "./subject-tabs.js";
import { h, replace } from "@/lib/dom.js";
import { icon } from "@/components/icons.js";
import { openFormDialog } from "@/components/form-dialog.js";
import { skeletonList } from "@/components/loading.js";
import { emptyState, pageHeader } from "@/components/page-header.js";
import { errorMessage } from "@/api/client.js";
import { changeRecord, getRecords } from "@/api/records.js";
import { watch } from "@/state/cache.js";
import { session } from "@/state/session.js";
import { termState } from "@/state/term.js";
import { DAY_NAMES } from "@/lib/schedule.js";
import { minutesBetween, timeRange } from "@/lib/time.js";

export const PRESET_ROWS = [8, 10, 14, 16];

/**
 * The rows of a preset bell schedule, one after another from the start time: periods of the same
 * length, with a recess and a lunch after the chosen periods. Null when it does not fit in one day,
 * or a break comes after a period that does not exist.
 * @param {{ rows: number, start: string, periodMinutes: number, gapMinutes?: number, recess: { after: number, minutes: number }, lunch: { after: number, minutes: number } }} options
 *   gapMinutes: minutes between two periods in a row (a passing time), 0 by default
 * @returns {{ is_break: boolean, label: string, start_time: string, end_time: string }[] | null}
 */
export function presetRows(options) {
  const toMinutes = (/** @type {string} */ time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  const toTime = (/** @type {number} */ minutes) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  const breaks = [{ ...options.recess, label: "Recess" }, { ...options.lunch, label: "Lunch" }].filter(({ minutes }) => minutes > 0);
  const periods = options.rows - breaks.length;
  if (breaks.some(({ after }) => after < 1 || after >= periods) || options.periodMinutes < 1) return null;

  const gap = Math.max(0, options.gapMinutes ?? 0);
  const rows = [];
  let time = toMinutes(options.start);
  for (let period = 1; period <= periods; period += 1) {
    rows.push({ is_break: false, label: "", start_time: toTime(time), end_time: toTime(time + options.periodMinutes) });
    time += options.periodMinutes;
    let hadBreak = false;
    for (const { after, minutes, label } of breaks) {
      if (after === period) {
        rows.push({ is_break: true, label, start_time: toTime(time), end_time: toTime(time + minutes) });
        time += minutes;
        hadBreak = true;
      }
    }
    // A passing time between two periods in a row; a recess or lunch already gives one.
    if (!hadBreak && period < periods) time += gap;
  }
  return time < 24 * 60 ? rows : null;
}

/**
 * The row a new or changed time would overlap in the same bell schedule, said in plain words, or null.
 * Times are [start, end): a row that ends at 7:15 does not overlap one that starts at 7:15.
 * @param {{ id: number, start_time: string, end_time: string, is_break: boolean, label?: string | null, period_no?: number | null }[]} slots
 * @param {string | null} start  "HH:MM"
 * @param {string | null} end
 * @param {number | null} [exceptId]  the row being edited
 * @returns {string | null}
 */
export function slotOverlap(slots, start, end, exceptId = null) {
  if (!start || !end || end <= start) return null;
  const other = slots.find((slot) => slot.id !== exceptId && slot.start_time.slice(0, 5) < end && slot.end_time.slice(0, 5) > start);
  if (!other) return null;
  const name = other.is_break ? other.label || "the break" : `Period ${other.period_no ?? ""}`.trim();
  return `This overlaps ${name} (${timeRange(other.start_time, other.end_time)}). Choose a time before or after it.`;
}

/**
 * Time between two rows that is neither a period nor a break (like 7:15 – 7:45), so it is seen at
 * once instead of being missed. Rows are in time order.
 * @param {{ start_time: string, end_time: string, is_break: boolean, label?: string | null, period_no?: number | null }[]} slots
 * @returns {{ after: number, start: string, end: string, minutes: number }[]}  after: the index of the row before the gap
 */
export function gapsBetween(slots) {
  const sorted = [...slots].sort((a, b) => a.start_time.localeCompare(b.start_time));
  /** @type {{ after: number, start: string, end: string, minutes: number }[]} */
  const gaps = [];
  sorted.forEach((slot, index) => {
    const next = sorted[index + 1];
    if (next && slot.end_time.slice(0, 5) < next.start_time.slice(0, 5)) {
      gaps.push({ after: index, start: slot.end_time.slice(0, 5), end: next.start_time.slice(0, 5), minutes: minutesBetween(slot.end_time.slice(0, 5), next.start_time.slice(0, 5)) });
    }
  });
  return gaps;
}

/** @type {import("@/router.js").RenderPage} */
export async function render(container) {
  const year = termState.term?.school_year;
  if (!year) {
    container.append(h("div", { class: "p-4 sm:p-6" }, emptyState({ title: "No school year yet", text: "Start a school year first, on the School Years page." })));
    return;
  }
  const user = session.user;
  const levels = user?.role === "glc" || user?.role === "master_teacher" ? ["JHS", "SHS"].filter((level) => user.grade_levels.some((grade) => grade.level === level)) : ["JHS", "SHS"];
  const ui = { level: levels[0] ?? "JHS", shift: defaultShift(session.user?.role) };
  const content = h("div", { class: "space-y-4" }, skeletonList(3));
  // A Chairperson (Junior High) works with Morning and Afternoon only (Nov 21, 2026).
  const shifts = shiftChoices(session.user?.role);
  const dayOptions = [1, 2, 3, 4, 5].map((day) => ({ value: day, label: DAY_NAMES[day] }));

  /** @param {{ mode: "create" | "edit" | "copy", pattern?: any }} action */
  const patternForm = ({ mode, pattern }) =>
    openFormDialog({
      title: mode === "create" ? "Add a bell schedule" : mode === "copy" ? `Copy ${pattern.name}` : `Edit ${pattern.name}`,
      description: mode === "copy" ? "The copy gets the same periods and breaks, for other days, department or shift." : "Days that share the same periods and breaks, like Monday – Thursday.",
      fields: [
        { name: "name", label: "Name", required: true, value: mode === "copy" ? `${pattern.name} (copy)` : pattern?.name, help: "Like Monday – Thursday" },
        { name: "days", label: "Days", type: "multi", required: true, value: mode === "edit" ? pattern.days : [], options: dayOptions, help: "A day can belong to only one bell schedule of a department and shift." },
        { name: "level", label: "Department", type: "select", required: true, value: pattern?.level ?? ui.level, options: levels.map((level) => ({ value: level, label: level === "JHS" ? "Junior High" : "Senior High" })) },
        { name: "shift", label: "Shift", type: "select", required: true, value: pattern?.shift ?? ui.shift, options: Object.entries(shifts).map(([value, label]) => ({ value, label })) },
      ],
      submitLabel: mode === "create" ? "Add bell schedule" : mode === "copy" ? "Copy" : "Save changes",
      onSubmit: async (values) => {
        const path = mode === "create" ? `/school-years/${year.id}/day-patterns` : mode === "copy" ? `/day-patterns/${pattern.id}/copy` : `/day-patterns/${pattern.id}`;
        await changeRecord(path, mode === "edit" ? "PUT" : "POST", values);
        return `${values.name} was ${mode === "copy" ? "copied" : mode === "create" ? "added" : "saved"}.`;
      },
      remove: mode === "edit" ? { label: "Delete this bell schedule", message: `This deletes ${pattern.name} with its periods and breaks.`, blockedReason: pattern.locked_reason, run: async () => { await changeRecord(`/day-patterns/${pattern.id}`, "DELETE"); return `${pattern.name} was deleted.`; } } : undefined,
    });

  /** @param {any} pattern @param {any} [slot] */
  const slotForm = (pattern, slot = null) =>
    openFormDialog({
      title: slot ? `Edit ${slot.is_break ? slot.label || "break" : `period ${slot.period_no ?? ""}`}` : `Add a period or break to ${pattern.name}`,
      fields: [
        // Checked while choosing: no overlap with the other rows of this bell schedule.
        { name: "start_time", label: "Start time", type: "time", required: true, value: slot?.start_time?.slice(0, 5) ?? null, check: (start, values) => slotOverlap(pattern.slots, start, values.end_time, slot?.id ?? null) },
        { name: "end_time", label: "End time", type: "time", required: true, value: slot?.end_time?.slice(0, 5) ?? null, check: (end, values) => (end && values.start_time && minutesBetween(values.start_time, end) <= 0 ? "The end time must be after the start time." : null) },
        { name: "is_break", label: "This is a break (recess or lunch)", type: "checkbox", value: slot?.is_break ?? false },
        // Senior High: the asynchronous session after the break (Nov 21, 2026). Its classes need no room.
        ...(pattern.level === "SHS" ? [{ name: "is_async", label: "Asynchronous session (Senior High): classes here need no room", type: /** @type {const} */ ("checkbox"), value: slot?.is_async ?? false, check: (/** @type {any} */ value, /** @type {any} */ values) => (value && values.is_break ? "A break cannot be asynchronous; only a period can." : null) }] : []),
        { name: "label", label: "Break name", value: slot?.label ?? "", help: "Like Recess or Lunch. Leave it empty for a period." },
      ],
      submitLabel: slot ? "Save changes" : "Add",
      onSubmit: async (values) => {
        const body = { ...values, label: values.label || "" };
        await changeRecord(slot ? `/time-slots/${slot.id}` : `/day-patterns/${pattern.id}/slots`, slot ? "PUT" : "POST", body);
        return `${timeRange(values.start_time, values.end_time)} was ${slot ? "saved" : "added"}.`;
      },
      remove: slot
        ? {
            label: "Delete",
            message: slot.in_use?.classes ? `This deletes ${timeRange(slot.start_time, slot.end_time)} and its ${slot.in_use.classes} draft classes in ${slot.in_use.sections} sections.` : `This deletes ${timeRange(slot.start_time, slot.end_time)}.`,
            blockedReason: slot.delete_blocked_reason ?? slot.locked_reason,
            run: async () => { await changeRecord(`/time-slots/${slot.id}?with_classes=1`, "DELETE"); return `${timeRange(slot.start_time, slot.end_time)} was deleted.`; },
          }
        : undefined,
    });

  /** @param {any} pattern */
  const presetForm = (pattern) =>
    openFormDialog({
      title: `Fill ${pattern.name} with a preset`,
      description: "Periods of the same length, one after another, with a recess and a lunch. Change any row afterwards.",
      fields: [
        { name: "rows", label: "Rows (periods and breaks together)", type: "select", required: true, value: 10, options: PRESET_ROWS.map((rows) => ({ value: rows, label: `${rows} rows` })) },
        { name: "start", label: "First period starts", type: "time", required: true, value: "07:00" },
        { name: "periodMinutes", label: "Minutes per period", type: "number", required: true, min: 1, max: 180, value: 45, help: "Like 60 for 1-hour blocks or 90 for 1.5-hour blocks." },
        { name: "gapMinutes", label: "Minutes between periods", type: "number", min: 0, max: 60, value: 0, help: "A passing time between periods; 0 for none." },
        { name: "recessAfter", label: "Recess after period", type: "number", min: 0, value: 3 },
        { name: "recessMinutes", label: "Recess minutes", type: "number", min: 0, value: 20, help: "0 leaves it out" },
        { name: "lunchAfter", label: "Lunch after period", type: "number", min: 0, value: 6 },
        { name: "lunchMinutes", label: "Lunch minutes", type: "number", min: 0, value: 60, help: "0 leaves it out" },
      ],
      submitLabel: "Fill the bell schedule",
      onSubmit: async (values) => {
        const rows = presetRows({ rows: Number(values.rows), start: values.start, periodMinutes: Number(values.periodMinutes), gapMinutes: Number(values.gapMinutes ?? 0), recess: { after: Number(values.recessAfter ?? 0), minutes: Number(values.recessMinutes ?? 0) }, lunch: { after: Number(values.lunchAfter ?? 0), minutes: Number(values.lunchMinutes ?? 0) } });
        if (!rows) throw new Error("This preset does not fit: check that each break comes after an existing period, and that the day ends before midnight.");
        await changeRecord(`/day-patterns/${pattern.id}/slots/preset`, "POST", { slots: rows });
        return `${pattern.name} now has ${rows.length} rows.`;
      },
    });

  replace(
    container,
    h(
      "div",
      { class: "space-y-5 p-4 sm:p-6" },
      pageHeader({ icon: "clock", title: "Class Hours", description: `Optional: the periods and breaks of SY ${year.name}. They are also made by themselves when you type a class time while plotting.`, crumbs: [{ label: "Home", to: "/dashboard" }, { label: "Time Slots" }], actions: h("button", { type: "button", class: "btn btn-primary", onclick: () => patternForm({ mode: "create" }) }, icon("plus"), "Add bell schedule") }),
      subjectTabs("hours"),
      h(
        "details",
        { class: "card p-4 text-sm", open: true },
        h("summary", { class: "min-h-11 cursor-pointer font-semibold text-accent" }, "How this page works"),
        h(
          "ul",
          { class: "mt-2 list-disc space-y-1 pl-5" },
          h("li", null, `Choose the shift first (${Object.values(shifts).join(", ")}): each shift has its own class hours.`),
          h("li", null, "A bell schedule is the days that share the same times, like Monday – Thursday and Friday."),
          h("li", null, "Each row is a period (a class time) or a break (recess or lunch, shaded). Time with neither is shown in amber, so nothing is missed."),
          h("li", null, h("strong", null, "Conflicts here: "), "two rows of the same bell schedule cannot overlap. The form says so while you choose the time, and the database refuses it too."),
          h("li", null, h("strong", null, "Conflicts of classes "), "(the same teacher, room or section at the same time) are checked when classes are placed on the schedule, not here."),
          h("li", null, "Senior High: mark a period as an asynchronous session (like the one after the break). Its classes keep their subject and teacher but need no room, and print under an ASYNCHRONOUS SESSION banner."),
          h("li", null, "This page is optional: a class time typed while plotting is added here by itself."),
        ),
      ),
      content,
    ),
  );

  /** "Classes 315 mins · Breaks 80 mins · 6:30 AM to 1:35 PM" under a bell schedule. */
  const dayTotals = (/** @type {any[]} */ slots) => {
    const sorted = [...slots].sort((a, b) => a.start_time.localeCompare(b.start_time));
    const sum = (/** @type {boolean} */ isBreak) => sorted.filter((slot) => slot.is_break === isBreak).reduce((total, slot) => total + slot.minutes, 0);
    return h("p", { class: "text-small text-muted-foreground" }, `Classes ${sum(false)} mins · Breaks ${sum(true)} mins · ${timeRange(sorted[0].start_time, sorted[sorted.length - 1].end_time)}`);
  };

  const draw = async () => {
    try {
      const patterns = await getRecords(`/school-years/${year.id}/day-patterns`);
      const shown = patterns.filter((/** @type {any} */ pattern) => pattern.level === ui.level && pattern.shift === ui.shift);
      const toggle = (/** @type {boolean} */ isOn) => `btn border ${isOn ? "border-brand bg-brand text-white" : "bg-surface"}`;
      replace(
        content,
        h(
          "div",
          { class: "flex flex-col gap-2 sm:flex-row" },
          levels.length > 1 ? h("div", { role: "tablist", "aria-label": "Department", class: "grid grid-cols-2 gap-2 sm:w-64" }, levels.map((level) => h("button", { type: "button", role: "tab", "aria-selected": String(ui.level === level), class: toggle(ui.level === level), onclick: () => { ui.level = level; draw(); } }, level === "JHS" ? "Junior High" : "Senior High"))) : null,
          h("div", { role: "tablist", "aria-label": "Shift", class: `grid gap-2 ${Object.keys(shiftChoices(session.user?.role, ui.level)).length === 2 ? "grid-cols-2 sm:w-64" : "grid-cols-2 sm:grid-cols-4 sm:w-[32rem]"}` }, Object.entries(shiftChoices(session.user?.role, ui.level)).map(([key, label]) => h("button", { type: "button", role: "tab", "aria-selected": String(ui.shift === key), class: toggle(ui.shift === key), onclick: () => { ui.shift = key; draw(); } }, label))),
        ),
        shown.length === 0
          ? emptyState({ title: "No bell schedule here yet", text: "Add one for these days, then fill it with a preset or add its periods one by one.", action: h("button", { type: "button", class: "btn btn-primary", onclick: () => patternForm({ mode: "create" }) }, icon("plus"), "Add bell schedule") })
          : h("div", { class: "grid gap-4 lg:grid-cols-2" }, shown.map((/** @type {any} */ pattern) =>
              h("section", { "aria-label": pattern.name, class: "card space-y-3 p-4" },
                h("div", { class: "flex flex-col gap-2" },
                  h("div", null, h("h2", { class: "text-lg font-semibold text-accent" }, pattern.name), h("p", { class: "text-small text-muted-foreground" }, pattern.days.map((/** @type {number} */ day) => DAY_NAMES[day]).join(", "))),
                  pattern.locked_reason ? h("p", { class: "flex gap-2 text-small text-warning" }, icon("lock", "size-4 shrink-0"), pattern.locked_reason) : null,
                  h("div", { class: "flex flex-wrap gap-2" },
                    h("button", { type: "button", class: "btn btn-outline", "aria-label": `Edit ${pattern.name}`, onclick: () => patternForm({ mode: "edit", pattern }) }, icon("pencil"), "Edit"),
                    h("button", { type: "button", class: "btn btn-outline", onclick: () => slotForm(pattern) }, icon("plus"), "Add row"),
                    pattern.slots.length === 0 ? h("button", { type: "button", class: "btn btn-outline", onclick: () => presetForm(pattern) }, icon("table"), "Use a preset") : null,
                    h("button", { type: "button", class: "btn btn-quiet", onclick: () => patternForm({ mode: "copy", pattern }) }, icon("copy"), "Copy"),
                  ),
                ),
                pattern.slots.length === 0
                  ? h("p", { class: "text-sm text-muted-foreground" }, "No periods yet.")
                  : h("ol", { class: "divide-y rounded-lg border" }, pattern.slots.flatMap((/** @type {any} */ slot, /** @type {number} */ index) => [
                      h("li", { class: `flex items-center justify-between gap-2 p-2 text-sm ${slot.is_break ? "bg-surface-muted" : ""}` },
                        h("div", { class: "min-w-0" }, h("p", { class: `font-medium ${slot.is_break ? "uppercase text-muted-foreground" : ""}` }, slot.is_break ? slot.label || "Break" : `Period ${slot.period_no ?? ""}`, slot.is_async ? h("span", { class: "badge ml-2 bg-sky-100 text-sky-900 dark:bg-sky-900 dark:text-sky-100" }, "Asynchronous") : null), h("p", { class: "text-small text-muted-foreground" }, `${timeRange(slot.start_time, slot.end_time)} · ${slot.minutes} mins${slot.in_use?.classes ? ` · ${slot.in_use.classes} classes` : ""}`)),
                        h("button", { type: "button", class: "btn btn-outline shrink-0", "aria-label": `Edit ${slot.is_break ? slot.label || "break" : `period ${slot.period_no ?? ""}`}, ${timeRange(slot.start_time, slot.end_time)}`, onclick: () => slotForm(pattern, slot) }, icon("pencil"), "Edit"),
                      ),
                      ...gapsBetween(pattern.slots).filter((gap) => gap.after === index).map((gap) => h("li", { class: "flex items-center gap-2 bg-amber-50 p-2 text-small text-amber-900 dark:bg-amber-950 dark:text-amber-100" }, icon("warning", "size-4 shrink-0"), `No class or break: ${timeRange(gap.start, gap.end)} (${gap.minutes} mins). Add a row here, or change the next row's start.`)),
                    ])),
                pattern.slots.length ? dayTotals(pattern.slots) : null,
              ),
            )),
      );
    } catch (error) {
      replace(content, h("p", { role: "alert", class: "text-danger" }, errorMessage(error)));
    }
  };

  const stop = watch(["records"], draw);
  await draw();
  return stop;
}

