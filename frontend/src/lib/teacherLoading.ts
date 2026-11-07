import * as z from "zod";
import type { CopyLoadingResult, LoadingRow, LoadingTeacher, Shift } from "@/types/api";
import { SHIFT_LABELS } from "./timeSlots";

export const QuickAddSchema = z.object({
  first_name: z.string().trim().min(1, "Enter the first name").max(60, "Use 60 characters or fewer"),
  last_name: z.string().trim().min(1, "Enter the last name").max(60, "Use 60 characters or fewer"),
});

/** What a copy did, in plain words. */
export function copyResultLines(result: CopyLoadingResult): string[] {
  const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

  return [
    `${result.copied} ${plural(result.copied, "subject was", "subjects were")} copied.`,
    ...(result.already_set > 0
      ? [`${result.already_set} already had a teacher, so they were left as they are.`]
      : []),
    ...(result.not_offered > 0
      ? [`${result.not_offered} ${plural(result.not_offered, "is", "are")} not taken in this term.`]
      : []),
    ...(result.teacher_unavailable > 0
      ? [`${result.teacher_unavailable} had a teacher who is no longer active. Choose a new one.`]
      : []),
  ];
}

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
