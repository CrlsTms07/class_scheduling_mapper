import * as z from "zod";
import type { SchoolYear, SchoolYearInput } from "@/types/api";

const DAY_MS = 24 * 60 * 60 * 1000;
const ORDINALS = ["First", "Second", "Third", "Fourth"];

export const MAX_TERMS = 4;

export type TermPreset = {
  key: string;
  title: string;
  hint: string;
  count: number;
  label: string;
};

export const TERM_PRESETS: TermPreset[] = [
  { key: "terms", title: "3 Terms", hint: "Current DepEd", count: 3, label: "Term" },
  { key: "semesters", title: "2 Semesters", hint: "Two parts", count: 2, label: "Semester" },
  { key: "quarters", title: "4 Quarters", hint: "Four parts", count: 4, label: "Quarter" },
];

export const CUSTOM_PRESET = "custom";

/** "First Term", "Second Semester", ... */
export function termName(position: number, label: string): string {
  return `${ORDINALS[position] ?? `No. ${position + 1}`} ${label}`;
}

/**
 * Splits the school year evenly into terms, as a starting point the Admin can edit.
 * Works in UTC so a time zone can never shift a date by one day.
 */
export function buildTerms(
  count: number,
  label: string,
  start: string,
  end: string,
): SchoolYearInput["terms"] {
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  const hasDates = !Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs > startMs;
  const totalDays = hasDates ? Math.round((endMs - startMs) / DAY_MS) + 1 : 0;
  const dateAt = (day: number) => new Date(startMs + day * DAY_MS).toISOString().slice(0, 10);

  return Array.from({ length: count }, (_, index) => ({
    name: termName(index, label),
    start_date: hasDates ? dateAt(Math.floor((index * totalDays) / count)) : "",
    end_date: hasDates ? dateAt(Math.floor(((index + 1) * totalDays) / count) - 1) : "",
  }));
}

const nextYearOf = (date: string) => {
  const [year, month, day] = date.split("-");
  const safeDay = month === "02" && day === "29" ? "28" : day;
  return `${Number(year) + 1}-${month}-${safeDay}`;
};

/** The wizard starts from the year after the latest one. */
export function suggestNextYear(latest: SchoolYear | undefined, today = new Date()) {
  const firstYear = latest ? Number(latest.name.slice(0, 4)) + 1 : today.getFullYear();
  const isReadable = !Number.isNaN(firstYear);

  return {
    name: isReadable ? `${firstYear}-${firstYear + 1}` : "",
    start_date: latest ? nextYearOf(latest.start_date) : "",
    end_date: latest ? nextYearOf(latest.end_date) : "",
  };
}

/** A date from the API, as "Jun 1, 2026". */
export function formatDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

const requiredDate = z.string().min(1, "Enter a date");

export const SchoolYearSchema = z
  .object({
    name: z.string().regex(/^\d{4}-\d{4}$/, "Write the school year like 2027-2028"),
    start_date: requiredDate,
    end_date: requiredDate,
    term_label: z.string().trim().min(1, "Enter a label").max(20, "Use 20 characters or fewer"),
    terms: z
      .array(
        z.object({
          name: z.string().trim().min(1, "Enter a name").max(30, "Use 30 characters or fewer"),
          start_date: requiredDate,
          end_date: requiredDate,
        }),
      )
      .min(1, "Add at least one")
      .max(MAX_TERMS),
  })
  .superRefine((year, context) => {
    const [first, second] = year.name.split("-").map(Number);
    if (second !== first + 1) {
      context.addIssue({
        code: "custom",
        path: ["name"],
        message: "Write the school year like 2027-2028, one year apart",
      });
    }

    if (year.end_date <= year.start_date) {
      context.addIssue({
        code: "custom",
        path: ["end_date"],
        message: "The school year must end after it starts",
      });
    }

    const seenNames = new Set<string>();

    // Dates are written as YYYY-MM-DD, so comparing them as text also compares them by date.
    year.terms.forEach((term, index) => {
      const fail = (field: "name" | "start_date" | "end_date", message: string) =>
        context.addIssue({ code: "custom", path: ["terms", index, field], message });

      const nameKey = term.name.toLowerCase();
      if (seenNames.has(nameKey)) fail("name", "Each one needs its own name");
      seenNames.add(nameKey);

      const previous = year.terms[index - 1];
      if (term.start_date < year.start_date) fail("start_date", "Before the school year starts");
      else if (previous && term.start_date <= previous.end_date) {
        fail("start_date", "Must start after the previous one ends");
      }

      if (term.end_date <= term.start_date) fail("end_date", "Must end after it starts");
      else if (term.end_date > year.end_date) fail("end_date", "After the school year ends");
    });
  });
