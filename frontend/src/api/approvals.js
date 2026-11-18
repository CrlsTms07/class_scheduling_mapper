// @ts-check
/**
 * Approvals: the Admin approves, rejects or reopens submitted schedules, for one section, a grade
 * level, a department or the whole term. One action is one review, saved in one transaction.
 */
import { api } from "./client.js";
import { invalidate, load } from "@/state/cache.js";

/**
 * @typedef {{ id: number, name: string, label: string, grade_level_id: number, grade: number, level: "JHS" | "SHS", adviser: string | null, status: import("@/lib/schedule.js").ScheduleStatus, pending_count: number, approved_count: number, flags: import("@/lib/schedule.js").ScheduleFlag[] }} ApprovalSection
 * @typedef {"approve" | "reject" | "reopen"} ReviewAction
 * @typedef {{ scope: "section" | "grade_level" | "JHS" | "SHS" | "all", scope_ref_id?: number }} ReviewScope
 */

/**
 * Every section of the term with its counts of pending and approved classes, and its flags.
 * @param {number} termId
 * @returns {Promise<ApprovalSection[]>}
 */
export function getApprovals(termId) {
  return load(["terms", termId, "approvals"], async () => /** @type {{ data: ApprovalSection[] }} */ (await api(`/terms/${termId}/approvals`)).data);
}

/**
 * Approves, rejects (remarks needed) or reopens (reason needed) the schedules in a scope.
 * @param {number} termId
 * @param {ReviewScope & { action: ReviewAction, remarks?: string }} body
 * @returns {Promise<{ entries: number, sections: number }>}
 */
export async function reviewSchedules(termId, body) {
  const { data } = /** @type {{ data: { entries: number, sections: number } }} */ (await api(`/terms/${termId}/approvals`, { method: "POST", body }));
  invalidate(["terms", termId]);
  return data;
}

/** Which sections each tab shows. */
export const APPROVAL_TABS = /** @type {const} */ ([
  { key: "pending", label: "Pending", includes: (/** @type {ApprovalSection} */ section) => section.pending_count > 0 },
  { key: "approved", label: "Approved", includes: (/** @type {ApprovalSection} */ section) => section.approved_count > 0 },
  { key: "not_submitted", label: "Not submitted", includes: (/** @type {ApprovalSection} */ section) => ["not_started", "draft", "rejected"].includes(section.status) },
  { key: "all", label: "All", includes: () => true },
]);

/**
 * The sections an action reaches: pending ones for approve and reject, approved ones for reopen.
 * @param {ApprovalSection[]} sections
 * @param {ReviewAction} action
 */
export function sectionsFor(sections, action) {
  return action === "reopen" ? sections.filter((section) => section.approved_count > 0) : sections.filter((section) => section.pending_count > 0);
}

/**
 * How many classes an action reaches.
 * @param {ApprovalSection[]} sections
 * @param {ReviewAction} action
 */
export function entriesFor(sections, action) {
  return sectionsFor(sections, action).reduce((total, section) => total + (action === "reopen" ? section.approved_count : section.pending_count), 0);
}
