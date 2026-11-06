import type { ScheduleEntry, ScheduleStatus, TimeSlot } from "@/types/api";

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
