// @ts-check
/**
 * The schedule calls of the API (the same endpoints as before). Every change sends back the
 * section's updated schedule, which replaces what the screen shows, and the rest of the term
 * is loaded again so every page agrees.
 */
import { api } from "./client.js";
import { invalidate, load, setData } from "@/state/cache.js";

/** @typedef {import("@/lib/schedule.js").Plotter} Plotter */

/**
 * @param {number} termId
 * @param {number} sectionId
 */
export const plotterKey = (termId, sectionId) => ["terms", termId, "sections", sectionId, "plotter"];

/**
 * A section's schedule screen: bell schedule, subjects, classes, rooms and flags.
 * @param {number} termId
 * @param {number} sectionId
 * @returns {Promise<Plotter>}
 */
export function getPlotter(termId, sectionId) {
  return load(plotterKey(termId, sectionId), async () => /** @type {{ data: Plotter }} */ (await api(`/terms/${termId}/sections/${sectionId}/plotter`)).data);
}

/**
 * Keeps the schedule the API sent back, and refreshes everything else of the term.
 * @param {number} termId
 * @param {number} sectionId
 * @param {Plotter} plotter
 */
function keep(termId, sectionId, plotter) {
  const key = plotterKey(termId, sectionId);
  invalidate(["terms", termId], { except: key });
  setData(key, plotter);
  return plotter;
}

/**
 * The free days of each period for a teacher and room (UI requirement 6). Never cached:
 * other people may be plotting at the same time.
 * @param {number} termId
 * @param {number} sectionId
 * @param {{ teacherId?: number | null, roomId?: number | null }} who
 * @returns {Promise<import("@/lib/schedule.js").FreePeriod[]>}
 */
export async function getFreePeriods(termId, sectionId, { teacherId, roomId }) {
  const query = new URLSearchParams();
  if (teacherId) query.set("teacher_id", String(teacherId));
  if (roomId) query.set("room_id", String(roomId));
  return /** @type {{ data: any }} */ (await api(`/terms/${termId}/sections/${sectionId}/free-periods?${query}`)).data;
}

/**
 * Places a subject in a period on some days.
 * @param {number} termId
 * @param {number} sectionId
 * @param {{ slotId: number, section_subject_id: number, room_id: number, days: number[] }} input
 */
export async function assignSlot(termId, sectionId, { slotId, ...body }) {
  const { data } = /** @type {{ data: Plotter }} */ (await api(`/terms/${termId}/sections/${sectionId}/slots/${slotId}`, { method: "PUT", body }));
  return keep(termId, sectionId, data);
}

/**
 * Moves classes from one period (and days) to another.
 * @param {number} termId
 * @param {number} sectionId
 * @param {{ slotId: number, from_slot_id: number, from_days: number[], days: number[] }} input
 */
export async function moveEntry(termId, sectionId, { slotId, ...body }) {
  const { data } = /** @type {{ data: Plotter }} */ (await api(`/terms/${termId}/sections/${sectionId}/slots/${slotId}/move`, { method: "POST", body }));
  return keep(termId, sectionId, data);
}

/**
 * Takes what is in a period off some days.
 * @param {number} termId
 * @param {number} sectionId
 * @param {{ slotId: number, days: number[] }} input
 */
export async function clearSlot(termId, sectionId, { slotId, days }) {
  const { data } = /** @type {{ data: Plotter }} */ (await api(`/terms/${termId}/sections/${sectionId}/slots/${slotId}`, { method: "DELETE", body: { days } }));
  return keep(termId, sectionId, data);
}


/**
 * Puts an activity on this section, its grade level or all sections. With preview, only says
 * what would happen.
 * @param {number} termId
 * @param {number} sectionId
 * @param {{ slotId: number, activity_id: number, scope: "section" | "grade" | "all", days: number[], preview: boolean }} input
 */
export async function placeActivity(termId, sectionId, { slotId, ...body }) {
  const result = /** @type {{ summary: any, data: Plotter | null }} */ (await api(`/terms/${termId}/sections/${sectionId}/slots/${slotId}/activity`, { method: "POST", body }));
  if (result.data) keep(termId, sectionId, result.data);
  return result.summary;
}

/**
 * Sends the schedule to the Admin, with the flags the user checked.
 * @param {number} termId
 * @param {number} sectionId
 * @param {{ acknowledged_flags: string[], note?: string }} body
 */
export async function submitSchedule(termId, sectionId, body) {
  const { data } = /** @type {{ data: Plotter }} */ (await api(`/terms/${termId}/sections/${sectionId}/submit`, { method: "POST", body }));
  return keep(termId, sectionId, data);
}

/**
 * Opens a rejected schedule again for changes. Lists the classes that could not come back.
 * @param {number} termId
 * @param {number} sectionId
 * @returns {Promise<string[]>}
 */
export async function reviseSchedule(termId, sectionId) {
  const result = /** @type {{ data: Plotter, removed: string[] }} */ (await api(`/terms/${termId}/sections/${sectionId}/revise`, { method: "POST" }));
  keep(termId, sectionId, result.data);
  return result.removed;
}

/**
 * Starts a section's schedule over. Its teacher loading stays.
 * @param {number} termId
 * @param {number} sectionId
 */
export async function clearSchedule(termId, sectionId) {
  await api(`/terms/${termId}/sections/${sectionId}/schedule`, { method: "DELETE" });
  invalidate(["terms", termId]);
}

/**
 * The teachers that can be chosen for the section's subjects.
 * @param {number} termId
 * @param {number} sectionId
 * @returns {Promise<{ id: number, name: string, assigned: number, limit: number }[]>}
 */
export function getTeacherChoices(termId, sectionId) {
  return load(["terms", termId, "sections", sectionId, "loading"], async () => /** @type {{ data: any }} */ (await api(`/terms/${termId}/sections/${sectionId}/loading`)).data).then((data) => data.teachers);
}

/**
 * Changes who teaches a subject of the section; its placed classes follow the new teacher.
 * @param {number} termId
 * @param {number} sectionId
 * @param {{ subjectId: number, teacherId: number }} input
 */
export async function changeTeacher(termId, sectionId, { subjectId, teacherId }) {
  await api(`/terms/${termId}/sections/${sectionId}/loading/${subjectId}`, { method: "PUT", body: { teacher_id: teacherId } });
  invalidate(["terms", termId]);
}

/**
 * Adds a teacher with just a name, to be completed later on the Teachers page.
 * @param {{ first_name: string, last_name: string }} body
 * @returns {Promise<{ id: number, name: string }>}
 */
export async function quickAddTeacher(body) {
  const { data } = /** @type {{ data: { id: number, name: string } }} */ (await api("/teachers/quick-add", { method: "POST", body }));
  invalidate(["school-years"]);
  return data;
}

/**
 * The conflicts and suggestions in an API error, when it is a schedule conflict.
 * @param {unknown} error
 * @returns {{ conflicts: { type: string, days: number[], message: string }[], suggestions: { rooms: { id: number, label: string }[], slots: { id: number, label: string }[], teachers: { id: number, name: string, teaches_subject: boolean, hours_per_week: number }[] } } | null}
 */
export function conflictDetailsOf(error) {
  const problem = /** @type {any} */ (error);
  return problem?.code === "schedule_conflict" ? problem.body : null;
}

/* ---------- The Schedule page ---------- */

/**
 * The sections of the term that the user may see, with each one's status.
 * @param {number} termId
 * @returns {Promise<import("@/lib/schedule-map.js").SectionSummary[]>}
 */
export function getSections(termId) {
  return load(["terms", termId, "sections"], async () => /** @type {{ data: any }} */ (await api(`/terms/${termId}/sections`)).data);
}

/**
 * Buildings, their rooms and the sections in them.
 * @param {number} termId
 * @returns {Promise<import("@/lib/schedule-map.js").ScheduleMap>}
 */
export function getScheduleMap(termId) {
  return load(["terms", termId, "schedule-map"], async () => /** @type {{ data: any }} */ (await api(`/terms/${termId}/schedule-map`)).data);
}

/**
 * The sections of a school year with their home rooms, for "Add section" on a room.
 * @param {number} yearId
 * @returns {Promise<{ id: number, label: string, grade: number, home_room: string | null }[]>}
 */
export function getYearSections(yearId) {
  return load(["school-years", yearId, "sections"], async () => /** @type {{ data: any }} */ (await api(`/school-years/${yearId}/sections`)).data);
}

/**
 * Makes a room the section's home (JHS) or usual (SHS) room.
 * @param {number} termId
 * @param {number} sectionId
 * @param {number | null} roomId
 */
export async function setSectionRoom(termId, sectionId, roomId) {
  await api(`/sections/${sectionId}/room`, { method: "PUT", body: { room_id: roomId } });
  invalidate(["terms", termId]);
  invalidate(["school-years"]);
}

/**
 * Starts this term's schedules from another term of the year. With preview, only says what would happen.
 * @param {number} termId
 * @param {{ from_term_id: number, section_id: number | null, grade: number | null, fill_subjects: boolean, preview: boolean }} body
 * @returns {Promise<import("@/lib/schedule-map.js").CopyResult>}
 */
export async function copySchedule(termId, body) {
  const { data } = /** @type {{ data: any }} */ (await api(`/terms/${termId}/schedule-copy`, { method: "POST", body }));
  if (!body.preview) invalidate(["terms", termId]);
  return data;
}
