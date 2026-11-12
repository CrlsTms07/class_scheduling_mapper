import type { MySchedule } from "@/types/api";

export type ClassOfDay = { start: string; end: string; lines: (string | null)[] };

/** The classes of one day, in order, from the teacher's approved schedule. */
export function classesOn(schedule: MySchedule, day: number): ClassOfDay[] {
  return schedule.rows.flatMap((row) =>
    (row.cells[day] ?? []).map((lines) => ({ start: row.start_time, end: row.end_time, lines })),
  );
}

/** The first class that has not ended yet, from a time like "07:15". */
export function nextClass(classes: ClassOfDay[], now: string): ClassOfDay | undefined {
  return classes.find(({ end }) => end > now);
}
