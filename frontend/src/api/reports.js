// @ts-check
/**
 * The data behind the Reports page. Every report also downloads as PDF and CSV (see the
 * download buttons); these calls only feed the preview on screen.
 */
import { api } from "./client.js";
import { load } from "@/state/cache.js";

/**
 * @param {number} termId
 * @param {string} path  like "teacher-load" or "teachers/3"
 */
function report(termId, path) {
  return load(["terms", termId, "reports", path], async () => /** @type {{ data: any }} */ (await api(`/terms/${termId}/reports/${path}`)).data);
}

/**
 * The teachers and grades the user may pick on the Reports page.
 * @param {number} termId
 * @returns {Promise<{ sections: { id: number, label: string, level: string }[], teachers: { id: number, label: string }[], rooms: { id: number, label: string }[], grades: number[] }>}
 */
export const getReportOptions = (termId) => report(termId, "options");
/** @param {number} termId @param {number} teacherId */
export const getTeacherProgram = (termId, teacherId) => report(termId, `teachers/${teacherId}`);
/** @param {number} termId */
export const getRoomUsage = (termId) => report(termId, "room-usage");
/** @param {number} termId */
export const getAdviserSummary = (termId) => report(termId, "adviser-summary");
/** @param {number} termId @param {number} grade */
export const getGradeTimetable = (termId, grade) => report(termId, `grades/${grade}/timetable`);
/** @param {number} termId */
export const getValidationReport = (termId) => report(termId, "validation");
