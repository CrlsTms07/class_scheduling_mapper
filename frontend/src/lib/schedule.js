// @ts-check
/**
 * Rules and words of the schedule screens: day names, statuses, colors, which period holds what,
 * and which periods a class may go to (UI requirement 6, confirmed Nov 17, 2026).
 */
import { timeRange } from "./time.js";

/**
 * @typedef {{ id: number, period_no: number | null, label: string | null, start_time: string, end_time: string, minutes: number, is_break: boolean }} TimeSlot
 * @typedef {{ id: number, name: string, days: number[], slots: TimeSlot[] }} DayPattern
 * @typedef {{ id: number, subject_id: number, teacher_id: number, subject: string, is_priority: boolean, required_minutes: number | null, scheduled_minutes: number, teacher: string }} Loading
 * @typedef {{ id: number, day: number, start_time: string, end_time: string, status: "draft" | "pending" | "approved" | "rejected", section_subject_id: number | null, activity_id: number | null, subject: string | null, teacher: string | null, room_id: number | null, room: string | null }} ScheduleEntry
 * @typedef {{ key: string, type: string, severity: "red" | "amber", message: string, blocking: boolean, acknowledged: boolean, section_subject_id?: number }} ScheduleFlag
 * @typedef {"not_started" | "draft" | "pending" | "approved" | "rejected"} ScheduleStatus
 * @typedef {object} Plotter
 * @property {{ id: number, name: string, label: string, level: "JHS" | "SHS", grade: number, shift: string, adviser: string | null, home_room_id: number | null }} section
 * @property {ScheduleStatus} status
 * @property {boolean} can_plot
 * @property {boolean} can_edit
 * @property {{ action: "approve" | "reject" | "reopen", remarks: string | null, reviewed_by: string, created_at: string } | null} last_review
 * @property {DayPattern[]} patterns
 * @property {Loading[]} loading
 * @property {ScheduleEntry[]} entries
 * @property {{ id: number, name: string }[]} activities
 * @property {{ grade: number, all: number }} apply_counts
 * @property {{ id: number, label: string }[]} rooms
 * @property {ScheduleFlag[]} flags
 * @typedef {{ slot_id: number, minutes: number, free_days: number[], busy: { day: number, reason: string }[] }} FreePeriod
 */

/** @type {Record<number, string>} */
export const DAY_NAMES = { 1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday" };
export const WEEK_DAYS = [1, 2, 3, 4, 5];

/** @type {Record<ScheduleStatus, string>} */
export const STATUS_LABELS = {
  not_started: "Not started",
  draft: "Draft",
  pending: "Pending approval",
  approved: "Approved",
  rejected: "Rejected",
};

/** @type {Record<ScheduleStatus, string>} */
export const STATUS_COLORS = {
  not_started: "bg-neutral-200 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-100",
  draft: "bg-sky-100 text-sky-900 dark:bg-sky-900 dark:text-sky-100",
  pending: "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100",
  approved: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100",
  rejected: "bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100",
};

/**
 * "7:00 AM – 7:45 AM".
 * @param {TimeSlot} slot
 */
export function slotTimeLabel(slot) {
  return timeRange(slot.start_time, slot.end_time);
}

/**
 * The entry a day and period holds, if any.
 * @param {ScheduleEntry[]} entries
 * @param {number} day
 * @param {TimeSlot} slot
 */
export function entryAt(entries, day, slot) {
  return entries.find((entry) => entry.day === day && entry.start_time === slot.start_time);
}

/**
 * Flag Ceremony, Catch-up Friday and the like.
 * @param {ScheduleEntry | undefined} entry
 */
export function isActivity(entry) {
  return entry !== undefined && (entry.activity_id ?? null) !== null;
}

/**
 * Whether the period is taken, by a subject or an activity. An open slot (copied from another
 * term) has a time but nothing in it yet.
 * @param {ScheduleEntry | undefined} entry
 */
export function hasSubject(entry) {
  return entry !== undefined && (entry.section_subject_id !== null || isActivity(entry));
}

/**
 * Submitted or approved entries cannot be changed.
 * @param {ScheduleEntry} entry
 */
export function isLocked(entry) {
  return entry.status === "pending" || entry.status === "approved";
}

/**
 * The bell schedule a period belongs to.
 * @param {DayPattern[]} patterns
 * @param {number} slotId
 */
export function patternOfSlot(patterns, slotId) {
  return patterns.find(({ slots }) => slots.some(({ id }) => id === slotId));
}

/**
 * Minutes of a subject not placed yet (0 when complete or over). Subjects have no typed minutes
 * (beneficiary review, Nov 21, 2026), so with no limit there is always room: Infinity. Only
 * Homeroom has a limit (60 a week).
 * @param {Loading} loading
 */
export function minutesLeft(loading) {
  if (loading.required_minutes === null) return Infinity;
  return Math.max(0, loading.required_minutes - loading.scheduled_minutes);
}

/**
 * "160 mins a week on the schedule", or with a limit (Homeroom): "40 of 60 mins · 20 left",
 * "Complete" or "Over by 20 mins".
 * @param {Loading} loading
 */
export function minutesText(loading) {
  if (loading.required_minutes === null) return `${loading.scheduled_minutes} mins a week on the schedule`;
  const left = loading.required_minutes - loading.scheduled_minutes;
  const placed = `${loading.scheduled_minutes} of ${loading.required_minutes} mins`;
  if (left === 0) return `${placed} · Complete`;
  if (left < 0) return `${placed} · Over by ${-left} mins`;
  return `${placed} · ${left} left`;
}

/**
 * Which periods a class of this subject may go to (UI requirement 6): periods that are free for
 * the section, the teacher and the room, and not longer than the subject's minutes still to place.
 * When a class is being changed, its own minutes count as not placed, and its own place is free.
 *
 * @param {{ patterns: DayPattern[], loading: Loading, free: FreePeriod[], editing?: { slotId: number, days: number[], sameSubject: boolean } }} input
 * @returns {{ slot: TimeSlot, pattern: DayPattern, freeDays: number[], busy: { day: number, reason: string }[] }[]}
 */
export function fittingPeriods({ patterns, loading, free, editing }) {
  const ownMinutes = editing?.sameSubject ? (patterns.flatMap(({ slots }) => slots).find(({ id }) => id === editing.slotId)?.minutes ?? 0) : 0;
  const left = minutesLeft(loading) + ownMinutes;
  const byId = new Map(free.map((period) => [period.slot_id, period]));
  const result = [];

  for (const pattern of patterns) {
    for (const slot of pattern.slots) {
      if (slot.is_break) continue;

      const period = byId.get(slot.id);
      const isOwn = editing?.slotId === slot.id;
      const freeDays = [...new Set([...(period?.free_days ?? []), ...(isOwn ? editing.days : [])])].sort();
      const busy = (period?.busy ?? []).filter(({ day }) => !freeDays.includes(day));

      if (freeDays.length === 0) continue;
      if (slot.minutes > left && !isOwn) continue;

      result.push({ slot, pattern, freeDays, busy });
    }
  }

  return result;
}

/**
 * The days a new class takes by default: JHS keeps a subject across its bell schedule, SHS one day.
 * Days that already have a class stay as they are.
 *
 * @param {Plotter} plotter
 * @param {DayPattern} pattern
 * @param {TimeSlot} slot
 * @param {number} day
 * @param {number[]} freeDays
 */
export function defaultDays(plotter, pattern, slot, day, freeDays) {
  const candidates = plotter.section.level === "JHS" ? pattern.days : [day];
  return candidates.filter((item) => freeDays.includes(item) && (item === day || !hasSubject(entryAt(plotter.entries, item, slot))));
}

/**
 * Which classes a drag moves, and to which days. JHS keeps a subject together across its bell
 * schedule, so moving one class within it moves all of them. Anything else moves one class.
 *
 * @param {{ loadingId: number, slot: TimeSlot, day: number, from: { slot: TimeSlot, day: number } }} drop
 * @param {DayPattern[]} patterns
 * @param {ScheduleEntry[]} entries
 * @param {"JHS" | "SHS"} level
 * @returns {{ from_days: number[], days: number[] } | null}
 */
export function planMove(drop, patterns, entries, level) {
  const { from, slot, day, loadingId } = drop;
  const fromPattern = patternOfSlot(patterns, from.slot.id);
  const isSamePattern = fromPattern?.slots.some(({ id }) => id === slot.id) ?? false;

  if (level === "JHS" && isSamePattern) {
    if (from.slot.id === slot.id) return null;
    const days = (fromPattern?.days ?? []).filter((item) => entryAt(entries, item, from.slot)?.section_subject_id === loadingId);
    return { from_days: days, days };
  }

  return from.slot.id === slot.id && from.day === day ? null : { from_days: [from.day], days: [day] };
}

const SUBJECT_COLORS = [
  "bg-sky-100 text-sky-950 border-sky-300 dark:bg-sky-950 dark:text-sky-100 dark:border-sky-800",
  "bg-amber-100 text-amber-950 border-amber-300 dark:bg-amber-950 dark:text-amber-100 dark:border-amber-800",
  "bg-emerald-100 text-emerald-950 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-100 dark:border-emerald-800",
  "bg-rose-100 text-rose-950 border-rose-300 dark:bg-rose-950 dark:text-rose-100 dark:border-rose-800",
  "bg-violet-100 text-violet-950 border-violet-300 dark:bg-violet-950 dark:text-violet-100 dark:border-violet-800",
  "bg-teal-100 text-teal-950 border-teal-300 dark:bg-teal-950 dark:text-teal-100 dark:border-teal-800",
  "bg-orange-100 text-orange-950 border-orange-300 dark:bg-orange-950 dark:text-orange-100 dark:border-orange-800",
  "bg-indigo-100 text-indigo-950 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-100 dark:border-indigo-800",
  "bg-lime-100 text-lime-950 border-lime-300 dark:bg-lime-950 dark:text-lime-100 dark:border-lime-800",
  "bg-pink-100 text-pink-950 border-pink-300 dark:bg-pink-950 dark:text-pink-100 dark:border-pink-800",
  "bg-cyan-100 text-cyan-950 border-cyan-300 dark:bg-cyan-950 dark:text-cyan-100 dark:border-cyan-800",
];

export const ACTIVITY_COLOR = "bg-slate-200 text-slate-900 border-slate-400 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600";

/**
 * Each subject of a section keeps one color across the screen. Plain when color coding is off.
 * @param {number | null} sectionSubjectId
 * @param {boolean} [isColored]
 */
export function subjectColor(sectionSubjectId, isColored = true) {
  if (sectionSubjectId === null) return "bg-surface-muted text-muted-foreground border-border";
  if (!isColored) return "bg-surface text-foreground border-neutral-400";
  return SUBJECT_COLORS[sectionSubjectId % SUBJECT_COLORS.length];
}

/** How to fix each kind of flag, and where, when it is not on this page. */
/** @type {Record<string, { text: string, to?: string, label?: string }>} */
export const FLAG_FIXES = {
  minutes_under: { text: "Place this subject in one more free period." },
  minutes_over: { text: "Remove a period of this subject, or check its minutes per week.", to: "/subjects", label: "Subjects" },
  no_adviser: { text: "Choose an adviser for this section.", to: "/sections", label: "Sections" },
  open_slots: { text: "Choose a subject for each open slot, or clear the slot." },
  no_room: { text: "Give the section its home room; its classes take it.", to: "/sections", label: "Sections" },
  overlaps_break: { text: "Move the class out of the break, to a period of the bell schedule." },
  outside_shift: { text: "Move the class to a period inside the section's shift." },
  teacher_shift: { text: "Move the class inside the teacher's shift, or choose another teacher." },
  teacher_overloaded: { text: "Give one of the teacher's subjects to someone else, or raise the limit.", to: "/teacher-loading?view=teachers", label: "Load Distribution" },
};
