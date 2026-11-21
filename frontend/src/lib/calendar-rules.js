// @ts-check
/**
 * The rules of a school year and its terms, checked while the dates are chosen (not only on Save),
 * the same as the API (SaveSchoolYearRequest). Pure functions, so they are easy to test.
 *
 * - The name is made from the first day: a year starting in 2026 is "2026-2027" (never typed).
 * - A school year is at most one year long and must not overlap another school year.
 * - Terms lie inside the school year, one after another, each at least 2 months (60 days) long.
 */

export const MIN_TERM_DAYS = 60;

const DAY_MS = 86_400_000;
const pretty = (/** @type {string} */ date) => new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const toMs = (/** @type {string} */ date) => Date.parse(`${date}T00:00:00Z`);

/**
 * "2026-2027" for a school year whose first day is in 2026, or "" without a date.
 * @param {string} startDate  YYYY-MM-DD
 */
export function yearName(startDate) {
  const year = Number(startDate?.slice(0, 4));
  return startDate && Number.isFinite(year) ? `${year}-${year + 1}` : "";
}

/**
 * The last day a school year starting on this date may have: one year later, less a day.
 * @param {string} startDate
 */
export function latestEnd(startDate) {
  const date = new Date(`${startDate}T00:00:00Z`);
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  return new Date(date.getTime() - DAY_MS).toISOString().slice(0, 10);
}

/**
 * What is wrong with a school year's dates, per field, in plain words. Empty when all is right.
 * @param {{ start_date: string, end_date: string }} draft
 * @param {{ id: number, name: string, start_date: string, end_date: string }[]} years  the others
 * @param {number | null} [editingId]  the year being changed, left out of the checks
 * @returns {{ start_date?: string, end_date?: string }}
 */
export function yearProblems(draft, years, editingId = null) {
  /** @type {{ start_date?: string, end_date?: string }} */
  const problems = {};
  const others = years.filter(({ id }) => id !== editingId);
  if (!draft.start_date) problems.start_date = "Choose the first day of the school year.";
  if (!draft.end_date) problems.end_date = "Choose the last day of the school year.";
  if (problems.start_date) return problems;

  const name = yearName(draft.start_date);
  const sameName = others.find((year) => year.name === name);
  if (sameName) {
    problems.start_date = `SY ${name} already exists. Start the new school year in ${Number(name.slice(0, 4)) + 1}.`;
    return problems;
  }
  if (problems.end_date) return problems;

  if (draft.end_date <= draft.start_date) {
    problems.end_date = "The last day must be after the first day.";
  } else if (draft.end_date > latestEnd(draft.start_date)) {
    problems.end_date = `A school year is one year at most: end it by ${pretty(latestEnd(draft.start_date))}.`;
  }

  const overlap = others.find((year) => year.start_date <= draft.end_date && year.end_date >= draft.start_date);
  if (overlap && !problems.end_date) {
    problems.start_date = `These dates overlap SY ${overlap.name} (${pretty(overlap.start_date)} – ${pretty(overlap.end_date)}). Start after ${pretty(overlap.end_date)}.`;
  }
  return problems;
}

/**
 * What is wrong with each term, by its place in the list. Empty when all is right.
 * @param {{ name: string, start_date: string, end_date: string }[]} terms
 * @param {{ start_date: string, end_date: string }} year
 * @returns {{ index: number, field: "name" | "start_date" | "end_date", message: string }[]}
 */
export function termProblems(terms, year) {
  /** @type {{ index: number, field: "name" | "start_date" | "end_date", message: string }[]} */
  const problems = [];
  const seen = new Set();
  terms.forEach((term, index) => {
    const label = term.name?.trim() || `Part ${index + 1}`;
    const key = term.name?.trim().toLowerCase();
    if (!key) problems.push({ index, field: "name", message: "Give this part a name." });
    else if (seen.has(key)) problems.push({ index, field: "name", message: `Another part is already called ${term.name.trim()}.` });
    seen.add(key);

    if (!term.start_date) problems.push({ index, field: "start_date", message: "Choose the day it starts." });
    if (!term.end_date) problems.push({ index, field: "end_date", message: "Choose the day it ends." });
    if (!term.start_date || !term.end_date) return;

    const previous = terms[index - 1];
    if (term.end_date <= term.start_date) problems.push({ index, field: "end_date", message: `${label} must end after it starts.` });
    else if ((toMs(term.end_date) - toMs(term.start_date)) / DAY_MS + 1 < MIN_TERM_DAYS) problems.push({ index, field: "end_date", message: `${label} is too short: make it at least 2 months (${MIN_TERM_DAYS} days).` });
    if (year.start_date && term.start_date < year.start_date) problems.push({ index, field: "start_date", message: `${label} starts before the school year (${pretty(year.start_date)}).` });
    if (year.end_date && term.end_date > year.end_date) problems.push({ index, field: "end_date", message: `${label} ends after the school year (${pretty(year.end_date)}).` });
    if (previous?.end_date && term.start_date <= previous.end_date) problems.push({ index, field: "start_date", message: `${label} must start after ${previous.name?.trim() || `part ${index}`} ends (${pretty(previous.end_date)}).` });
  });
  return problems;
}
