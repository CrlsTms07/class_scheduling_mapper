import * as z from "zod";
import type { LoadingRow, LoadingTeacher, Shift } from "@/types/api";
import { SHIFT_LABELS } from "./timeSlots";

export const QuickAddSchema = z.object({
  first_name: z.string().trim().min(1, "Enter the first name").max(60, "Use 60 characters or fewer"),
  last_name: z.string().trim().min(1, "Enter the last name").max(60, "Use 60 characters or fewer"),
});

/** How many subjects already have a teacher. */
export function loadedCount(rows: LoadingRow[]): number {
  return rows.filter(({ teacher_id: teacherId }) => teacherId !== null).length;
}

export function isOverLoad({ assigned, limit }: Pick<LoadingTeacher, "assigned" | "limit">): boolean {
  return assigned > limit;
}

/** "Ana Reyes (3 of 5)", so the load shows while choosing. */
export function teacherOptionLabel(teacher: LoadingTeacher): string {
  return `${teacher.name} (${teacher.assigned} of ${teacher.limit})`;
}

/** A morning teacher cannot fully serve an afternoon section, and the other way around. */
export function shiftWarning(teacherShift: Shift, sectionShift: Shift): string | null {
  if (teacherShift === "WHOLE_DAY" || teacherShift === sectionShift) return null;

  return `This teacher's shift is ${SHIFT_LABELS[teacherShift]}, but this section's is ${SHIFT_LABELS[sectionShift]}.`;
}

/** Teachers to offer on a row, keeping its current teacher even if they are no longer listed. */
export function teachersForRow(
  teachers: LoadingTeacher[],
  row: Pick<LoadingRow, "teacher_id" | "teacher">,
): LoadingTeacher[] {
  if (row.teacher_id === null || teachers.some(({ id }) => id === row.teacher_id)) {
    return teachers;
  }

  return [
    { id: row.teacher_id, name: row.teacher ?? "", shift: "WHOLE_DAY", assigned: 0, limit: 0 },
    ...teachers,
  ];
}
