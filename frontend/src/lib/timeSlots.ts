import * as z from "zod";
import type { ManagedPattern, SchoolLevel, Shift, TimeSlot } from "@/types/api";
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
