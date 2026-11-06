import * as z from "zod";
import type { ManagedSection, SectionInput, Shift } from "@/types/api";

/** The form works with text, because that is what its inputs give. */
export const SectionFormSchema = z.object({
  grade_level_id: z.string().min(1, "Choose a grade level"),
  name: z.string().trim().min(1, "Enter a name").max(60, "Use 60 characters or fewer"),
  shift: z.enum(["AM", "PM", "WHOLE_DAY"]),
  track_id: z.string(),
  adviser_id: z.string(),
  home_room_id: z.string(),
  class_size: z.string().regex(/^\d{0,3}$/, "Enter a number"),
});

export type SectionFormValues = z.infer<typeof SectionFormSchema>;

const idOrNull = (value: string) => (value === "" ? null : Number(value));

/** Converts the form for the API. A field of the other department is left empty. */
export function toSectionInput(values: SectionFormValues, isSeniorHigh: boolean): SectionInput {
  return {
    grade_level_id: Number(values.grade_level_id),
    name: values.name,
    shift: values.shift as Shift,
    track_id: isSeniorHigh ? idOrNull(values.track_id) : null,
    home_room_id: isSeniorHigh ? null : idOrNull(values.home_room_id),
    adviser_id: idOrNull(values.adviser_id),
    class_size: idOrNull(values.class_size),
  };
}

export function toSectionForm(section: ManagedSection | null): SectionFormValues {
  const text = (value: number | null | undefined) => (value == null ? "" : String(value));

  return {
    grade_level_id: text(section?.grade_level_id),
    name: section?.name ?? "",
    shift: section?.shift ?? "WHOLE_DAY",
    track_id: text(section?.track_id),
    adviser_id: text(section?.adviser_id),
    home_room_id: text(section?.home_room_id),
    class_size: text(section?.class_size),
  };
}

/** The sections matching the search words and grade filter. */
export function filterSections(
  sections: ManagedSection[],
  search: string,
  grade: string,
): ManagedSection[] {
  const words = search.trim().toLowerCase();

  return sections.filter(
    (section) =>
      (grade === "" || String(section.grade) === grade) &&
      `${section.label} ${section.adviser ?? ""} ${section.home_room ?? ""} ${section.track ?? ""}`
        .toLowerCase()
        .includes(words),
  );
}

/**
 * Other sections with the same home room at the same time of day. Whole day overlaps both
 * AM and PM. AM and PM can share a room. This is only a warning: the school may allow it.
 */
export function homeRoomSharedWith(
  sections: ManagedSection[],
  roomId: number | null,
  shift: Shift,
  ownId: number | undefined,
): string[] {
  if (roomId === null) return [];

  const overlaps = (other: Shift) =>
    other === shift || other === "WHOLE_DAY" || shift === "WHOLE_DAY";

  return sections
    .filter(
      (section) =>
        section.id !== ownId && section.home_room_id === roomId && overlaps(section.shift),
    )
    .map(({ label }) => label);
}

/** What is still missing on a section. These become flags in the plotter if left empty. */
export function missingAdviserCount(sections: ManagedSection[]): number {
  return sections.filter(({ adviser_id }) => adviser_id === null).length;
}
