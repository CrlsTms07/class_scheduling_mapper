import type { DayPattern, Loading, ScheduleEntry, ScheduleStatus, Term, TimeSlot } from "@/types/api";

export const DAY_NAMES: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
};

export const WEEK_DAYS = [1, 2, 3, 4, 5];

export const STATUS_LABELS: Record<ScheduleStatus, string> = {
  not_started: "Not started",
  draft: "Draft",
  pending: "Pending approval",
  approved: "Approved",
  rejected: "Rejected",
};

export const STATUS_COLORS: Record<ScheduleStatus, string> = {
  not_started: "bg-neutral-200 text-neutral-800",
  draft: "bg-sky-100 text-sky-900",
  pending: "bg-amber-100 text-amber-900",
  approved: "bg-emerald-100 text-emerald-900",
  rejected: "bg-red-100 text-red-900",
};

export type PlotterView = "days" | "grid";

export const PLOTTER_VIEWS: { value: PlotterView; label: string }[] = [
  { value: "days", label: "Day cards" },
  { value: "grid", label: "Weekly grid" },
];

const PLOTTER_VIEW_KEY = "plotter-view";

/** The plotter opens the way the user last left it, on day cards at first. */
export function readPlotterView(): PlotterView {
  return localStorage.getItem(PLOTTER_VIEW_KEY) === "grid" ? "grid" : "days";
}

export function savePlotterView(view: PlotterView): void {
  localStorage.setItem(PLOTTER_VIEW_KEY, view);
}

/** "13:05" becomes "1:05 PM". */
export function formatTime(time: string): string {
  const [hour, minute] = time.split(":").map(Number);
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const period = hour < 12 ? "AM" : "PM";

  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

export function slotTimeLabel(slot: TimeSlot): string {
  return `${formatTime(slot.start_time)} – ${formatTime(slot.end_time)}`;
}

/** What this school year calls a part of it, such as "term" or "semester". Never written in code. */
export function termWord(term: { school_year?: Pick<Term["school_year"], "term_label"> } | null | undefined): string {
  return term?.school_year?.term_label?.toLowerCase() ?? "period";
}

export type PlotContext = {
  patterns: DayPattern[];
  entries: ScheduleEntry[];
  level: "JHS" | "SHS";
};

export function subjectsDone(loading: Loading[]): number {
  return loading.filter((item) => item.scheduled_minutes === item.required_minutes).length;
}

/** The first subject still short of its minutes, in the order the list shows them. */
export function nextSubject(loading: Loading[]): Loading | undefined {
  return loading.find((item) => item.scheduled_minutes < item.required_minutes);
}

/** A free period that would finish a subject exactly. JHS counts its whole bell schedule. */
function periodThatFits(minutesLeft: number, { patterns, entries, level }: PlotContext): string | null {
  for (const pattern of patterns) {
    for (const slot of pattern.slots.filter(({ is_break: isBreak }) => !isBreak)) {
      const free = pattern.days.filter((day) => !hasSubject(entryAt(entries, day, slot)));
      const minutes = level === "JHS" ? slot.minutes * free.length : slot.minutes;

      if (free.length > 0 && minutes === minutesLeft) {
        return level === "JHS"
          ? `${pattern.name}, ${slotTimeLabel(slot)}`
          : `${DAY_NAMES[free[0]]}, ${slotTimeLabel(slot)}`;
      }
    }
  }

  return null;
}

/** What is left of a subject, in words, with a suggestion when one period would finish it. */
export function remainingHint(item: Loading, context: PlotContext): string {
  const left = item.required_minutes - item.scheduled_minutes;

  if (left === 0) return "Complete";
  if (left < 0) return `Over by ${-left} mins`;

  const fit = periodThatFits(left, context);

  return fit ? `${left} mins left. This fits: ${fit}` : `${left} mins left`;
}

/** An open slot, copied from another term, has a time but no subject yet. */
export function hasSubject(entry: ScheduleEntry | undefined): boolean {
  return entry !== undefined && entry.section_subject_id !== null;
}

type DragEnd = {
  active: { data: { current?: unknown } };
  over: { data: { current?: unknown } } | null;
};

export type Drop = {
  loadingId: number;
  slot: TimeSlot;
  day: number;
  /** Where the class came from, when it was already on the schedule. */
  from?: { slot: TimeSlot; day: number };
};

/** Which subject was dropped on which slot. Dropping outside any slot places nothing. */
export function readDrop({ active, over }: DragEnd): Drop | null {
  const dragged = active.data.current as Pick<Drop, "loadingId" | "from"> | undefined;
  const place = over?.data.current as { slot: TimeSlot; day: number } | undefined;

  return dragged && place ? { loadingId: dragged.loadingId, slot: place.slot, day: place.day, from: dragged.from } : null;
}

/**
 * Which classes a drag moves, and to which days. JHS keeps a subject together across its bell
 * schedule, so dragging one class to another time moves all of them. Anything else is one class.
 */
export function planMove(
  drop: Drop & { from: NonNullable<Drop["from"]> },
  patterns: DayPattern[],
  entries: ScheduleEntry[],
  level: "JHS" | "SHS",
): { from_days: number[]; days: number[] } | null {
  const { from, slot, day, loadingId } = drop;
  const fromPattern = patterns.find(({ slots }) => slots.some(({ id }) => id === from.slot.id));
  const isSamePattern = fromPattern?.slots.some(({ id }) => id === slot.id) ?? false;

  if (level === "JHS" && isSamePattern) {
    if (from.slot.id === slot.id) return null;

    const days = (fromPattern?.days ?? []).filter(
      (item) => entryAt(entries, item, from.slot)?.section_subject_id === loadingId,
    );

    return { from_days: days, days };
  }

  return from.slot.id === slot.id && from.day === day ? null : { from_days: [from.day], days: [day] };
}

/** The entry that a day and time slot holds, if any. */
export function entryAt(
  entries: ScheduleEntry[],
  day: number,
  slot: TimeSlot,
): ScheduleEntry | undefined {
  return entries.find(
    (entry) => entry.day === day && entry.start_time === slot.start_time,
  );
}

export function isLocked(entry: ScheduleEntry): boolean {
  return entry.status === "pending" || entry.status === "approved";
}

const SUBJECT_COLORS = [
  "bg-sky-100 text-sky-950 border-sky-300",
  "bg-amber-100 text-amber-950 border-amber-300",
  "bg-emerald-100 text-emerald-950 border-emerald-300",
  "bg-rose-100 text-rose-950 border-rose-300",
  "bg-violet-100 text-violet-950 border-violet-300",
  "bg-teal-100 text-teal-950 border-teal-300",
  "bg-orange-100 text-orange-950 border-orange-300",
  "bg-indigo-100 text-indigo-950 border-indigo-300",
  "bg-lime-100 text-lime-950 border-lime-300",
  "bg-pink-100 text-pink-950 border-pink-300",
  "bg-cyan-100 text-cyan-950 border-cyan-300",
];

/** Each subject of a section keeps one color across the screen. */
export function subjectColor(sectionSubjectId: number | null): string {
  return sectionSubjectId === null
    ? "bg-neutral-100 text-neutral-700 border-neutral-300"
    : SUBJECT_COLORS[sectionSubjectId % SUBJECT_COLORS.length];
}
