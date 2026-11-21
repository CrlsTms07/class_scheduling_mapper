// @ts-check
/**
 * Teacher loading: who teaches each subject of a section, per term. Every change refreshes the
 * term, so the schedules and teacher counts agree.
 */
import { api } from "./client.js";
import { invalidate, load, setData } from "@/state/cache.js";

/**
 * @typedef {"WHOLE_DAY" | "AM" | "PM"} Shift
 * @typedef {{ subject_id: number, subject: string, code: string | null, scheduled_minutes: number, is_priority: boolean, is_active: boolean, teacher_id: number | null, teacher: string | null, placed_entries: number, locked_reason: string | null }} LoadingRow
 * @typedef {{ id: number, name: string, shift: Shift, assigned: number, limit: number }} LoadingTeacher
 * @typedef {{ section: { id: number, label: string, level: "JHS" | "SHS", shift: Shift, track: string | null, adviser: string | null }, rows: LoadingRow[], addable: { id: number, name: string, code: string | null }[], teachers: LoadingTeacher[] }} SectionLoading
 */

/**
 * @param {number} termId
 * @param {number} sectionId
 */
const loadingKey = (termId, sectionId) => ["terms", termId, "sections", sectionId, "loading"];

/**
 * A section's subjects with their teachers, and the teachers that can be chosen.
 * @param {number} termId
 * @param {number} sectionId
 * @returns {Promise<SectionLoading>}
 */
export function getSectionLoading(termId, sectionId) {
  return load(loadingKey(termId, sectionId), async () => /** @type {{ data: SectionLoading }} */ (await api(`/terms/${termId}/sections/${sectionId}/loading`)).data);
}

/**
 * Gives a subject of the section a teacher (or a new one). Placed classes follow the new teacher.
 * @param {number} termId
 * @param {number} sectionId
 * @param {number} subjectId
 * @param {number} teacherId
 */
export async function assignTeacher(termId, sectionId, subjectId, teacherId) {
  const { data } = /** @type {{ data: SectionLoading }} */ (await api(`/terms/${termId}/sections/${sectionId}/loading/${subjectId}`, { method: "PUT", body: { teacher_id: teacherId } }));
  const key = loadingKey(termId, sectionId);
  invalidate(["terms", termId], { except: key });
  setData(key, data);
  return data;
}

/**
 * Takes the teacher off a subject of the section.
 * @param {number} termId
 * @param {number} sectionId
 * @param {number} subjectId
 */
export async function removeTeacher(termId, sectionId, subjectId) {
  const { data } = /** @type {{ data: SectionLoading }} */ (await api(`/terms/${termId}/sections/${sectionId}/loading/${subjectId}`, { method: "DELETE" }));
  const key = loadingKey(termId, sectionId);
  invalidate(["terms", termId], { except: key });
  setData(key, data);
  return data;
}

/**
 * Copies the teachers of another term of the same school year, for one section or all.
 * @param {number} termId
 * @param {{ from_term_id: number, section_id: number | null }} body
 * @returns {Promise<{ copied: number, already_set: number, not_offered: number, teacher_unavailable: number }>}
 */
export async function copyLoading(termId, body) {
  const { data } = /** @type {{ data: any }} */ (await api(`/terms/${termId}/loading/copy`, { method: "POST", body }));
  invalidate(["terms", termId]);
  return data;
}

/**
 * Import previous data: the teacher loading of an earlier term (also of an earlier school year),
 * matched by section and subject names. With preview, only says what would be copied.
 * @param {number} termId
 * @param {{ from_term_id: number, preview: boolean }} body
 * @returns {Promise<{ copied: number, already_set: number, no_section: number, no_subject: number, not_offered: number, teacher_unavailable: number, sections: number, missing: string[] }>}
 */
export async function importPrevious(termId, body) {
  const { data } = /** @type {{ data: any }} */ (await api(`/terms/${termId}/import-previous`, { method: "POST", body }));
  if (!body.preview) invalidate(["terms", termId]);
  return data;
}

/**
 * Load Distribution: every teacher with the hours a week their loading asks for.
 * @param {number} termId
 */
export function getTeacherLoad(termId) {
  return load(["terms", termId, "teacher-load"], async () => /** @type {{ data: any }} */ (await api(`/terms/${termId}/reports/teacher-load`)).data);
}

/** @type {Record<Shift, string>} */
export const SHIFT_LABELS = { WHOLE_DAY: "Whole day", AM: "Morning (AM)", PM: "Afternoon (PM)" };

/**
 * A morning teacher cannot fully serve an afternoon section, and the other way around.
 * @param {Shift} teacherShift
 * @param {Shift} sectionShift
 */
export function shiftWarning(teacherShift, sectionShift) {
  if (teacherShift === "WHOLE_DAY" || teacherShift === sectionShift) return null;
  return `This teacher's shift is ${SHIFT_LABELS[teacherShift]}, but this section's is ${SHIFT_LABELS[sectionShift]}.`;
}
