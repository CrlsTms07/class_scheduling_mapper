// @ts-check
/**
 * Dashboards and the user's own records (My Schedule, My Profile).
 */
import { api } from "./client.js";
import { load } from "@/state/cache.js";

/** @param {number} termId */
export const getAdminDashboard = (termId) => load(["terms", termId, "dashboard"], async () => /** @type {{ data: any }} */ (await api(`/terms/${termId}/dashboard`)).data);
/** @param {number} termId */
export const getSchedulerDashboard = (termId) => load(["terms", termId, "my-dashboard"], async () => /** @type {{ data: any }} */ (await api(`/terms/${termId}/my-dashboard`)).data);

/**
 * The signed-in teacher's approved classes of a term (null without a personnel record).
 * @param {number} termId
 */
export const getMySchedule = (termId) => load(["terms", termId, "my-schedule"], async () => /** @type {{ data: any }} */ (await api(`/terms/${termId}/my-schedule`)).data);

/**
 * The signed-in teacher's personnel record (null without one).
 * @param {number} termId
 */
export const getMyProfile = (termId) => load(["terms", termId, "my-profile"], async () => /** @type {{ data: any }} */ (await api(`/terms/${termId}/my-profile`)).data);

/**
 * The classes of one day of My Schedule, in time order.
 * @param {{ rows: { start_time: string, end_time: string, cells: Record<number, (string | null)[][]> }[] }} schedule
 * @param {number} day
 */
export function classesOn(schedule, day) {
  return schedule.rows.flatMap((row) => (row.cells[day] ?? []).map((lines) => ({ start: row.start_time, end: row.end_time, lines })));
}

/**
 * The first class that has not ended yet, from a time like "07:15".
 * @param {{ start: string, end: string, lines: (string | null)[] }[]} classes
 * @param {string} now
 */
export function nextClass(classes, now) {
  return classes.find(({ end }) => end > now);
}
