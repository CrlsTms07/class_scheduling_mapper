// @ts-check
/**
 * Master-data import (teachers, subjects, rooms, sections) from the Excel template. Admin only.
 * Schedules are never imported: they are made in the system (beneficiary review, Nov 20, 2026).
 */
import { api, downloadFile } from "./client.js";
import { invalidate } from "@/state/cache.js";

/** @typedef {"teachers" | "subjects" | "rooms" | "sections"} ImportType */

/**
 * @typedef {Object} ImportRow
 * @property {number} row_number
 * @property {string} label
 * @property {"new" | "update" | "skip" | "error"} status
 * @property {string[]} messages
 */

/**
 * @typedef {Object} ImportResult
 * @property {"preview" | "commit"} mode
 * @property {ImportRow[]} rows
 * @property {{ total: number, new: number, update: number, skip: number, error: number }} summary
 * @property {number} added
 * @property {number} updated
 * @property {number} skipped
 * @property {number} errors
 */

/**
 * Saves the template: the exact headers and one example row.
 * @param {ImportType} type
 */
export function downloadImportTemplate(type) {
  return downloadFile(`/imports/${type}/template.xlsx`);
}

/**
 * Checks (preview) or imports (commit) a filled-in template into a school year.
 * @param {number} schoolYearId
 * @param {ImportType} type
 * @param {{ file: File, mode: "preview" | "commit", onDuplicate: "skip" | "update" }} input
 * @returns {Promise<ImportResult>}
 */
export async function sendImport(schoolYearId, type, { file, mode, onDuplicate }) {
  const body = new FormData();
  body.append("file", file);
  body.append("on_duplicate", onDuplicate);
  const { data } = /** @type {{ data: ImportResult }} */ (await api(`/school-years/${schoolYearId}/imports/${type}?mode=${mode}`, { method: "POST", body }));
  if (mode === "commit") invalidate([]);
  return data;
}
