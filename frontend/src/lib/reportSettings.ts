import * as z from "zod";
import type {
  AutoSource,
  DocumentSetting,
  ReportType,
  SchoolLevel,
  Signatory,
  SignatoryInput,
} from "@/types/api";

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  class_program: "Class Program",
  teacher_program: "Teacher Program",
  room_schedule: "Room Schedule",
};

/** The forms the school prints, each with its starting title. */
export const DOCUMENTS: {
  report_type: ReportType;
  level: SchoolLevel | null;
  title: string;
  defaultTitle: string;
}[] = [
  {
    report_type: "class_program",
    level: "JHS",
    title: "Class Program (JHS)",
    defaultTitle: "{level} GRADE {grade} – CLASS PROGRAM",
  },
  {
    report_type: "class_program",
    level: "SHS",
    title: "Class Program (SHS)",
    defaultTitle: "{level} GRADE {grade} – CLASS PROGRAM",
  },
  {
    report_type: "teacher_program",
    level: null,
    title: "Teacher Program",
    defaultTitle: "TEACHER PROGRAM",
  },
  {
    report_type: "room_schedule",
    level: null,
    title: "Room Schedule",
    defaultTitle: "ROOM SCHEDULE",
  },
];

/** Which automatic name fits a document, if any. */
export const AUTO_SOURCE_FOR: Partial<Record<ReportType, { source: AutoSource; label: string }>> = {
  class_program: { source: "section_adviser", label: "The section's class adviser" },
  teacher_program: { source: "teacher", label: "The teacher on the form" },
};

/** Empty form fields are saved as nothing, not as empty text. */
export const emptyToNull = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

/** The signatories that print together on one form, in signing order. */
export function signatoriesOf(
  signatories: Signatory[],
  reportType: ReportType | null,
  level: SchoolLevel | null,
): Signatory[] {
  return signatories
    .filter((item) => item.report_type === reportType && item.level === level)
    .sort((first, second) => first.sort_order - second.sort_order);
}

export const ProfileSchema = z.object({
  school_name: z.string().trim().min(1, "Enter the school name").max(150),
  school_id: z.string().trim().max(20, "Use 20 characters or fewer"),
  address: z.string().trim().max(255),
  phone: z.string().trim().max(50),
  email: z.union([z.literal(""), z.email("Enter a valid email")]),
  website: z.string().trim().max(150),
  region: z.string().trim().max(120),
  division: z.string().trim().max(150),
  facebook_url: z.union([z.literal(""), z.url("Enter a full link, starting with https://")]),
  tagline: z.string().trim().max(200, "Use 200 characters or fewer"),
  vision: z.string().trim().max(2000, "Use 2,000 characters or fewer"),
  mission: z.string().trim().max(2000, "Use 2,000 characters or fewer"),
  core_values: z.string().trim().max(255, "Use 255 characters or fewer"),
});

export type ProfileValues = z.infer<typeof ProfileSchema>;

export const DocumentSchema = z.object({
  title_format: z.string().trim().min(1, "Enter a title").max(150),
  doc_ref_code: z.string().trim().max(40, "Use 40 characters or fewer"),
  revision_no: z.string().trim().max(10, "Use 10 characters or fewer"),
  effectivity_date: z.string(),
  reference_note: z.string().trim().max(150),
});

export type DocumentValues = z.infer<typeof DocumentSchema>;

export function toDocumentForm(
  saved: DocumentSetting | undefined,
  defaultTitle: string,
): DocumentValues {
  return {
    title_format: saved?.title_format ?? defaultTitle,
    doc_ref_code: saved?.doc_ref_code ?? "",
    revision_no: saved?.revision_no ?? "",
    effectivity_date: saved?.effectivity_date ?? "",
    reference_note: saved?.reference_note ?? "",
  };
}

export const SignatorySchema = z
  .object({
    label: z.string().trim().min(1, "Enter what this person does, like Prepared by").max(40),
    useAutomaticName: z.boolean(),
    name: z.string().trim().max(120),
    position: z.string().trim().max(120),
  })
  .superRefine((values, context) => {
    if (!values.useAutomaticName && values.name === "") {
      context.addIssue({ code: "custom", path: ["name"], message: "Enter the name to print" });
    }
  });

export type SignatoryValues = z.infer<typeof SignatorySchema>;

export function toSignatoryInput(
  values: SignatoryValues,
  reportType: ReportType | null,
  level: SchoolLevel | null,
): SignatoryInput {
  const automatic = reportType ? AUTO_SOURCE_FOR[reportType] : undefined;
  const isAutomatic = values.useAutomaticName && !!automatic;

  return {
    report_type: reportType,
    level,
    label: values.label,
    name: isAutomatic ? null : values.name,
    position: emptyToNull(values.position),
    auto_source: isAutomatic ? automatic.source : null,
  };
}
