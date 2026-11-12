import * as z from "zod";
import type { ManagedPattern, SchoolLevel, Shift, SlotInput, TimeSlot } from "@/types/api";
import { DAY_NAMES, WEEK_DAYS } from "./schedule";

export const LEVELS: SchoolLevel[] = ["JHS", "SHS"];

export const SHIFT_LABELS: Record<Shift, string> = {
  WHOLE_DAY: "Whole day",
  AM: "Morning (AM)",
  PM: "Afternoon (PM)",
};

export const SHIFTS = Object.keys(SHIFT_LABELS) as Shift[];

/** Minutes between two "HH:mm" times, or null if the range is not valid yet. */
export function minutesBetween(start: string, end: string): number | null {
  const toMinutes = (time: string) => {
    const [hour, minute] = time.split(":").map(Number);
    return hour * 60 + minute;
  };
  const minutes = toMinutes(end) - toMinutes(start);

  return minutes > 0 ? minutes : null;
}

/** "Period 2", or "Period 2 (HGP)", or the name of a break. */
export function slotName(slot: Pick<TimeSlot, "is_break" | "period_no" | "label">): string {
  if (slot.is_break) return slot.label ?? "Break";
  return slot.label ? `Period ${slot.period_no} (${slot.label})` : `Period ${slot.period_no}`;
}

/** The school days that have no bell schedule yet, as names. */
export function daysWithoutSchedule(patterns: ManagedPattern[]): string[] {
  const covered = new Set(patterns.flatMap(({ days }) => days));
  return WEEK_DAYS.filter((day) => !covered.has(day)).map((day) => DAY_NAMES[day]);
}

export function minutesTotals(pattern: ManagedPattern) {
  const sum = (isBreak: boolean) =>
    pattern.slots
      .filter(({ is_break }) => is_break === isBreak)
      .reduce((total, { minutes }) => total + minutes, 0);

  return { classMinutes: sum(false), breakMinutes: sum(true) };
}

export const PatternSchema = z.object({
  level: z.enum(["JHS", "SHS"]),
  shift: z.enum(["AM", "PM", "WHOLE_DAY"]),
  name: z.string().trim().min(1, "Enter a name").max(40, "Use 40 characters or fewer"),
  days: z.array(z.number()).min(1, "Pick at least one day"),
});

export const SlotSchema = z
  .object({
    is_break: z.boolean(),
    label: z.string().trim().max(40, "Use 40 characters or fewer"),
    start_time: z.string().min(1, "Enter a time"),
    end_time: z.string().min(1, "Enter a time"),
  })
  .superRefine((slot, context) => {
    if (slot.is_break && slot.label === "") {
      context.addIssue({
        code: "custom",
        path: ["label"],
        message: "Name this break, like Recess or Lunch",
      });
    }

    if (slot.end_time <= slot.start_time) {
      context.addIssue({
        code: "custom",
        path: ["end_time"],
        message: "Must be after the start time",
      });
    }
  });

/** How many rows a preset bell schedule has, periods and breaks together. */
export const PRESET_ROWS = [8, 10, 14, 16] as const;

export type PresetOptions = {
  rows: (typeof PRESET_ROWS)[number];
  start: string;
  periodMinutes: number;
  /** A break comes right after this period. Leave out a break by setting minutes to 0. */
  recess: { after: number; minutes: number };
  lunch: { after: number; minutes: number };
};

const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const toTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/**
 * The rows of a preset bell schedule, one after another from the start time: periods of the
 * same length, with a recess and a lunch after the chosen periods. Null when it does not fit
 * in one day, or a break comes after a period that does not exist.
 */
export function presetRows(options: PresetOptions): SlotInput[] | null {
  const breaks = [
    { ...options.recess, label: "Recess" },
    { ...options.lunch, label: "Lunch" },
  ].filter(({ minutes }) => minutes > 0);
  const periods = options.rows - breaks.length;

  if (breaks.some(({ after }) => after < 1 || after >= periods) || options.periodMinutes < 1) return null;

  const rows: SlotInput[] = [];
  let time = toMinutes(options.start);

  for (let period = 1; period <= periods; period += 1) {
    rows.push({ is_break: false, label: "", start_time: toTime(time), end_time: toTime(time + options.periodMinutes) });
    time += options.periodMinutes;

    for (const { after, minutes, label } of breaks) {
      if (after === period) {
        rows.push({ is_break: true, label, start_time: toTime(time), end_time: toTime(time + minutes) });
        time += minutes;
      }
    }
  }

  return time < 24 * 60 ? rows : null;
}
