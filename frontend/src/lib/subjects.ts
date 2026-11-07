import * as z from "zod";
import type { ManagedSubject, SubjectInput, SubjectOptions, SubjectType } from "@/types/api";
import { emptyToNull } from "./reportSettings";

export const SUBJECT_TYPE_LABELS: Record<SubjectType, string> = {
  core: "Core",
  elective: "Elective",
  other: "Other",
};

/** The form works with text, because that is what its inputs give. */
export const SubjectFormSchema = z.object({
  grade_level_id: z.string().min(1, "Choose a grade level"),
  track_id: z.string(),
  term_no: z.string(),
  code: z.string().trim().max(20, "Use 20 characters or fewer"),
  name: z.string().trim().min(1, "Enter the subject name").max(100, "Use 100 characters or fewer"),
  subject_type: z.enum(["core", "elective", "other"]),
  minutes_per_week: z.string().regex(/^[1-9]\d{0,3}$/, "Enter the minutes per week"),
  is_priority: z.boolean(),
  is_active: z.boolean(),
});

export type SubjectFormValues = z.infer<typeof SubjectFormSchema>;

const text = (value: number | null | undefined) => (value == null ? "" : String(value));
const idOrNull = (value: string) => (value === "" ? null : Number(value));

export function toSubjectForm(subject: ManagedSubject | null): SubjectFormValues {
  return {
    grade_level_id: text(subject?.grade_level_id),
    track_id: text(subject?.track_id),
    term_no: text(subject?.term_no),
    code: subject?.code ?? "",
    name: subject?.name ?? "",
    subject_type: subject?.subject_type ?? "core",
    minutes_per_week: text(subject?.minutes_per_week),
    is_priority: subject?.is_priority ?? false,
    is_active: subject?.is_active ?? true,
  };
}

/** Converts the form for the API. Only Senior High subjects have a track. */
export function toSubjectInput(values: SubjectFormValues, isSeniorHigh: boolean): SubjectInput {
  return {
    grade_level_id: Number(values.grade_level_id),
    track_id: isSeniorHigh ? idOrNull(values.track_id) : null,
    term_no: idOrNull(values.term_no),
    code: emptyToNull(values.code),
    name: values.name,
    subject_type: values.subject_type,
    minutes_per_week: Number(values.minutes_per_week),
    is_priority: values.is_priority,
    is_active: values.is_active,
  };
}

/** The name of the term a subject belongs to, or "Whole year". */
export function termLabel(
  termNo: number | null,
  terms: SubjectOptions["terms"] | undefined,
): string {
  if (termNo === null) return "Whole year";
  return terms?.find((term) => term.term_no === termNo)?.name ?? `Part ${termNo}`;
}

export function filterSubjects(
  subjects: ManagedSubject[],
  search: string,
  grade: string,
  termNo: string,
): ManagedSubject[] {
  const words = search.trim().toLowerCase();

  return subjects.filter(
    (subject) =>
      (grade === "" || String(subject.grade) === grade) &&
      (termNo === "" || String(subject.term_no ?? "whole") === termNo) &&
      `${subject.name} ${subject.code ?? ""} ${subject.track ?? ""}`.toLowerCase().includes(words),
  );
}
