// @ts-check
/**
 * The ways to see a section's week. Day cards and the weekly grid are one switch, remembered
 * (design audit, Must fix #4). Phones held upright get day tabs with a list of periods.
 * Every period is a button: tap it to add or edit a class there. Classes can be dragged.
 */
import { h } from "@/lib/dom.js";
import { icon } from "@/components/icons.js";
import { readSetting, saveSetting } from "@/lib/storage.js";
import { ACTIVITY_COLOR, DAY_NAMES, entryAt, hasSubject, isActivity, isLocked, slotTimeLabel, subjectColor } from "@/lib/schedule.js";
import { formatTime } from "@/lib/time.js";

/**
 * @typedef {import("@/lib/schedule.js").Plotter} Plotter
 * @typedef {import("@/lib/schedule.js").TimeSlot} TimeSlot
 * @typedef {import("@/lib/schedule.js").DayPattern} DayPattern
 *
 * @typedef {object} ViewProps
 * @property {Plotter} plotter
 * @property {boolean} isColored
 * @property {boolean} canEdit
 * @property {Set<string>} fitting  "slotId:day" places that fit the subject being placed
 * @property {(slot: TimeSlot, day: number) => void} onTap
 */

const VIEW_KEY = "plotter-view";

/** @returns {"days" | "grid"} the view the user last chose (day cards at first) */
export function readView() {
  return readSetting(VIEW_KEY) === "grid" ? "grid" : "days";
}

/** @param {"days" | "grid"} view */
export function saveView(view) {
  saveSetting(VIEW_KEY, view);
}

/**
 * One period of one day: the class in it, or "Add class".
 * @param {ViewProps} props
 * @param {TimeSlot} slot
 * @param {number} day
 * @param {{ compact?: boolean }} [options]
 */
function periodCell({ plotter, isColored, canEdit, fitting, onTap }, slot, day, { compact = false } = {}) {
  if (slot.is_break) {
    return h(
      "div",
      { class: "flex min-h-11 items-center justify-between gap-2 rounded-lg bg-surface-muted px-3 py-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground" },
      h("span", null, slot.label ?? "Break"),
      compact ? null : h("span", { class: "font-normal normal-case" }, slotTimeLabel(slot)),
    );
  }

  const entry = entryAt(plotter.entries, day, slot);
  const isTaken = hasSubject(entry);
  const isFit = fitting.has(`${slot.id}:${day}`);
  const locked = entry ? isLocked(entry) : false;
  const color = isActivity(entry) ? ACTIVITY_COLOR : subjectColor(entry?.section_subject_id ?? null, isColored);
  const label = isTaken ? `${entry?.subject}, ${DAY_NAMES[day]} ${slotTimeLabel(slot)}` : `Add class on ${DAY_NAMES[day]} at ${slotTimeLabel(slot)}`;

  return h(
    "button",
    {
      type: "button",
      "aria-label": label,
      disabled: !canEdit && !isTaken,
      "data-drop": `${slot.id}:${day}`,
      "data-drag": isTaken && canEdit && !locked && entry?.section_subject_id ? `${entry.section_subject_id}:${slot.id}:${day}` : null,
      class: `group relative flex min-h-14 w-full flex-col items-start justify-center rounded-lg border px-3 py-2 text-left text-sm transition ${
        isTaken ? color : isFit ? "border-2 border-dashed border-brand bg-brand-soft text-brand" : "border-dashed text-muted-foreground hover:bg-surface-muted"
      }`,
      onclick: () => onTap(slot, day),
    },
    isTaken
      ? [
          h("span", { class: "flex w-full items-start justify-between gap-2" }, h("span", { class: "font-medium leading-tight" }, entry?.subject ?? ""), locked ? icon("lock", "size-4 shrink-0") : null),
          entry?.teacher ? h("span", { class: "text-small leading-tight opacity-90" }, entry.teacher) : null,
          !compact && entry?.room ? h("span", { class: "text-small leading-tight opacity-80" }, entry.room) : null,
        ]
      : entry
        ? h("span", { class: "flex items-center gap-1 font-medium" }, icon("plus"), "Open slot · Add subject")
        : h("span", { class: "flex items-center gap-1 font-medium" }, icon("plus"), isFit ? "Place here" : "Add class"),
  );
}

/**
 * The periods of one day, in time order, with the time of each.
 * @param {ViewProps} props
 * @param {number} day
 */
function dayPeriods(props, day) {
  const pattern = props.plotter.patterns.find(({ days }) => days.includes(day));
  if (!pattern) return h("p", { class: "text-sm text-muted-foreground" }, "No bell schedule for this day yet.");

  return h(
    "ol",
    { class: "space-y-2" },
    pattern.slots.map((slot) =>
      h(
        "li",
        { class: "space-y-1" },
        slot.is_break ? null : h("p", { class: "text-small text-muted-foreground" }, `${slotTimeLabel(slot)} · ${slot.minutes} mins`),
        periodCell(props, slot, day),
      ),
    ),
  );
}

/**
 * Day cards: one card per day, side by side on wide screens.
 * @param {ViewProps} props
 */
export function dayCardsView(props) {
  const days = [...new Set(props.plotter.patterns.flatMap(({ days: patternDays }) => patternDays))].sort();
  return h(
    "div",
    { class: "grid gap-4 md:grid-cols-2 2xl:grid-cols-3" },
    days.map((day) => {
      const count = props.plotter.entries.filter((entry) => entry.day === day && hasSubject(entry)).length;
      return h(
        "section",
        { class: "card space-y-3 p-4", "aria-label": DAY_NAMES[day] },
        h("h3", { class: "flex items-baseline justify-between font-semibold text-brand" }, DAY_NAMES[day], h("span", { class: "text-small font-normal text-muted-foreground" }, `${count} ${count === 1 ? "class" : "classes"}`)),
        dayPeriods(props, day),
      );
    }),
  );
}

/**
 * The weekly grid of one bell schedule: periods down, days across, the time column stays put.
 * @param {ViewProps} props
 * @param {DayPattern} pattern
 */
export function gridView(props, pattern) {
  return h(
    "div",
    { class: "overflow-x-auto rounded-xl border" },
    h(
      "table",
      { class: "w-full min-w-[44rem] border-collapse text-sm" },
      h(
        "thead",
        null,
        h("tr", { class: "bg-surface-muted" }, h("th", { scope: "col", class: "sticky left-0 z-10 w-32 bg-surface-muted p-2 text-left font-medium" }, "Time"), pattern.days.map((day) => h("th", { scope: "col", class: "p-2 text-left font-medium" }, DAY_NAMES[day]))),
      ),
      h(
        "tbody",
        null,
        pattern.slots.map((slot) =>
          h(
            "tr",
            { class: "border-t" },
            h("th", { scope: "row", class: "sticky left-0 z-10 bg-surface p-2 text-left align-top font-normal" }, h("span", { class: "block font-medium" }, formatTime(slot.start_time)), h("span", { class: "block text-small text-muted-foreground" }, `to ${formatTime(slot.end_time)} · ${slot.minutes} mins`)),
            slot.is_break
              ? h("td", { colspan: String(pattern.days.length), class: "p-1" }, periodCell(props, slot, pattern.days[0]))
              : pattern.days.map((day) => h("td", { class: "p-1 align-top" }, periodCell(props, slot, day, { compact: true }))),
          ),
        ),
      ),
    ),
  );
}

/**
 * Phones held upright: day tabs, then the periods of that day.
 * @param {ViewProps} props
 * @param {number} day
 * @param {(day: number) => void} onDay
 */
export function phoneDayView(props, day, onDay) {
  const days = [...new Set(props.plotter.patterns.flatMap(({ days: patternDays }) => patternDays))].sort();
  return h(
    "div",
    { class: "space-y-3" },
    h(
      "div",
      { role: "tablist", "aria-label": "Day", class: "grid grid-cols-5 gap-1" },
      days.map((item) =>
        h("button", { type: "button", role: "tab", "aria-selected": String(item === day), class: `btn border px-1 ${item === day ? "border-brand bg-brand text-white" : "bg-surface"}`, onclick: () => onDay(item) }, DAY_NAMES[item].slice(0, 3)),
      ),
    ),
    dayPeriods(props, day),
  );
}
