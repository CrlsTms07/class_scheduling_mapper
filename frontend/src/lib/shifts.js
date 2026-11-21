// @ts-check
/**
 * The shifts a user works with. Junior High runs in a morning and an afternoon shift, so the
 * Chairperson (GLC) never sees "Whole day" (team decision, Nov 21, 2026). Senior High also has a
 * part-time shift, seen by the Admin and the Master Teacher only (Nov 21, 2026).
 */

/** @type {Record<string, string>} */
export const SHIFT_LABELS = { WHOLE_DAY: "Whole day", AM: "Morning (AM)", PM: "Afternoon (PM)", PART_TIME: "Part-time (Senior High)" };

/**
 * The shifts offered to this role, as { value: label }. Part-time is left out for Junior High.
 * @param {string | undefined} role
 * @param {string | null} [level]  "JHS" or "SHS" when known
 * @returns {Record<string, string>}
 */
export function shiftChoices(role, level = null) {
  if (role === "glc") return { AM: SHIFT_LABELS.AM, PM: SHIFT_LABELS.PM };
  const all = { ...SHIFT_LABELS };
  if (level === "JHS") delete all.PART_TIME;
  return all;
}

/**
 * The shift a new record starts with.
 * @param {string | undefined} role
 */
export function defaultShift(role) {
  return role === "glc" ? "AM" : "WHOLE_DAY";
}

/**
 * A saved shift as options for a select: the role's choices, plus the saved one if it is not among
 * them (an older record stays readable).
 * @param {string | undefined} role
 * @param {string | null | undefined} saved
 */
export function shiftOptions(role, saved) {
  const choices = shiftChoices(role);
  const options = Object.entries(choices).map(([value, label]) => ({ value, label }));
  return saved && !choices[saved] ? [...options, { value: saved, label: SHIFT_LABELS[saved] ?? saved }] : options;
}
