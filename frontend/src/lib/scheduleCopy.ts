import type { CopyScheduleResult, SectionSummary } from "@/types/api";

/** What the user can copy at once. The value is what the select holds. */
export function copyScopes(sections: SectionSummary[]): { value: string; label: string }[] {
  const grades = [...new Set(sections.map(({ grade }) => grade))];

  return [
    { value: "all", label: "All my sections" },
    ...grades.map((grade) => ({ value: `grade:${grade}`, label: `All of Grade ${grade}` })),
    ...sections.map(({ id, grade, name }) => ({ value: `section:${id}`, label: `Grade ${grade} – ${name}` })),
  ];
}

export function scopeToInput(scope: string): { section_id: number | null; grade: number | null } {
  const [kind, id] = scope.split(":");

  return {
    section_id: kind === "section" ? Number(id) : null,
    grade: kind === "grade" ? Number(id) : null,
  };
}

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/** The result in words, for both the review and the finished copy. */
export function copySummaryLines(result: CopyScheduleResult): string[] {
  const lines: string[] = [];

  if (result.sections_copied > 0) {
    lines.push(
      `${plural(result.sections_copied, "section")}, ${plural(result.entries, "period")}: ` +
        `${result.filled} with subject and teacher, ${plural(result.open_slots, "open slot")} to fill.`,
    );
  }
  if (result.loading_copied > 0) {
    lines.push(`${plural(result.loading_copied, "teacher assignment")} copied.`);
  }
  if (result.left_open > 0) {
    lines.push(`${plural(result.left_open, "period")} left open, because the teacher or room is already taken.`);
  }
  if (result.not_fitting > 0) {
    lines.push(`${plural(result.not_fitting, "period")} left out, because the bell schedule has changed.`);
  }
  if (result.sections_with_schedule.length > 0) {
    lines.push(`Skipped, because they already have a schedule: ${result.sections_with_schedule.join(", ")}.`);
  }
  if (result.sections_with_nothing > 0) {
    lines.push(`${plural(result.sections_with_nothing, "section")} had nothing to copy.`);
  }

  return lines;
}
