import * as z from "zod";
import type { ManagedTeacher, PersonnelType, TeacherInput } from "@/types/api";
import { emptyToNull } from "./reportSettings";

export const PERSONNEL_TYPE_LABELS: Record<PersonnelType, string> = {
  teaching: "Teaching",
  non_teaching: "Non-teaching",
};

export const DEGREE_LEVELS = ["Bachelor", "Master", "Doctorate", "Units"];

export const DEFAULT_MAX_LOAD = 5;
/** Load Distribution flags a teacher above this many hours a week, unless their own limit differs. */
export const DEFAULT_MAX_HOURS = 30;

const QualificationSchema = z.object({
  degree_level: z.string().min(1, "Choose a level"),
  degree: z.string().trim().min(1, "Enter the degree").max(120, "Use 120 characters or fewer"),
  major: z.string().trim().max(120, "Use 120 characters or fewer"),
  school: z.string().trim().max(150, "Use 150 characters or fewer"),
  year_completed: z.string().regex(/^(\d{4})?$/, "Enter a 4-digit year"),
});

/** The form works with text, because that is what its inputs give. */
export const TeacherFormSchema = z.object({
  personnel_type: z.enum(["teaching", "non_teaching"]),
  first_name: z.string().trim().min(1, "Enter the first name").max(60, "Use 60 characters or fewer"),
  middle_name: z.string().trim().max(60, "Use 60 characters or fewer"),
  last_name: z.string().trim().min(1, "Enter the last name").max(60, "Use 60 characters or fewer"),
  suffix: z.string().trim().max(10, "Use 10 characters or fewer"),
  display_name: z.string().trim().max(80, "Use 80 characters or fewer"),
  department_id: z.string(),
  designation_id: z.string(),
  shift: z.enum(["AM", "PM", "WHOLE_DAY"]),
  max_subjects: z.string().regex(/^[0-8]$/, "Enter a number from 0 to 8"),
  max_hours_per_week: z
    .string()
    .regex(/^\d{1,2}$/, "Enter a number from 1 to 60")
    .refine((value) => Number(value) >= 1 && Number(value) <= 60, "Enter a number from 1 to 60"),
  is_active: z.boolean(),
  qualifications: z.array(QualificationSchema),
  task_ids: z.array(z.number()),
});

export type TeacherFormValues = z.infer<typeof TeacherFormSchema>;

export const EMPTY_QUALIFICATION: TeacherFormValues["qualifications"][number] = {
  degree_level: "Bachelor",
  degree: "",
  major: "",
  school: "",
  year_completed: "",
};

export function toTeacherForm(teacher: ManagedTeacher | null): TeacherFormValues {
  return {
    personnel_type: teacher?.personnel_type ?? "teaching",
    first_name: teacher?.first_name ?? "",
    middle_name: teacher?.middle_name ?? "",
    last_name: teacher?.last_name ?? "",
    suffix: teacher?.suffix ?? "",
    display_name: teacher?.display_name ?? "",
    department_id: teacher?.department_id == null ? "" : String(teacher.department_id),
    designation_id: teacher?.designation_id == null ? "" : String(teacher.designation_id),
    shift: teacher?.shift ?? "WHOLE_DAY",
    max_subjects: String(teacher?.max_subjects ?? DEFAULT_MAX_LOAD),
    max_hours_per_week: String(teacher?.max_hours_per_week ?? DEFAULT_MAX_HOURS),
    is_active: teacher?.is_active ?? true,
    qualifications: (teacher?.qualifications ?? []).map((item) => ({
      degree_level: item.degree_level,
      degree: item.degree,
      major: item.major ?? "",
      school: item.school ?? "",
      year_completed: item.year_completed == null ? "" : String(item.year_completed),
    })),
    task_ids: teacher?.task_ids ?? [],
  };
}

const idOrNull = (value: string) => (value === "" ? null : Number(value));

export function toTeacherInput(values: TeacherFormValues): TeacherInput {
  return {
    personnel_type: values.personnel_type,
    first_name: values.first_name,
    middle_name: emptyToNull(values.middle_name),
    last_name: values.last_name,
    suffix: emptyToNull(values.suffix),
    display_name: emptyToNull(values.display_name),
    department_id: idOrNull(values.department_id),
    designation_id: idOrNull(values.designation_id),
    shift: values.shift,
    max_subjects: Number(values.max_subjects),
    max_hours_per_week: Number(values.max_hours_per_week),
    is_active: values.is_active,
    qualifications: values.qualifications.map((item) => ({
      degree_level: item.degree_level,
      degree: item.degree,
      major: emptyToNull(item.major),
      school: emptyToNull(item.school),
      year_completed: idOrNull(item.year_completed),
    })),
    task_ids: values.task_ids,
  };
}

export function filterTeachers(
  teachers: ManagedTeacher[],
  search: string,
  type: string,
  status: string,
): ManagedTeacher[] {
  const words = search.trim().toLowerCase();

  return teachers.filter(
    (teacher) =>
      (type === "" || teacher.personnel_type === type) &&
      (status === "" || (status === "active") === teacher.is_active) &&
      `${teacher.first_name} ${teacher.last_name} ${teacher.printed_name} ${teacher.department ?? ""} ${teacher.designation ?? ""}`
        .toLowerCase()
        .includes(words),
  );
}

export function isOverLimit(teacher: Pick<ManagedTeacher, "assigned" | "max_subjects">): boolean {
  return teacher.assigned > teacher.max_subjects;
}
