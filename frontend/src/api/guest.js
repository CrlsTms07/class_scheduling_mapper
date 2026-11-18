// @ts-check
/**
 * The public pages: no sign-in. Only approved schedules of the active term are shown, and only
 * the adviser and co-adviser are named (team decision, Nov 7, 2026). No student names, ever.
 */
import { api } from "./client.js";
import { load } from "@/state/cache.js";

/**
 * @typedef {{ name: string, school_year: string }} GuestTerm
 * @typedef {{ id: number, name: string, grade: number, level: "JHS" | "SHS", track: string | null, adviser: string | null, co_adviser: string | null, is_ready: boolean }} GuestSectionItem
 * @typedef {{ days: { day: number, name: string }[], patterns: { name: string, days: number[] }[], rows: { start_time: string, end_time: string, time: string, minutes: number, days: number[], cells: Record<number, { subject: string | null, room: string | null } | null>, breaks: Record<number, string> | [], wide_break: string | null }[], totals: Record<number, string> }} GuestWeek
 * @typedef {{ id: number, label: string, term: GuestTerm, state: "ready" | "updating" | "not_ready", adviser?: string | null, co_adviser?: string | null, week?: GuestWeek }} GuestSection
 * @typedef {{ school_name: string, short_name: string, address: string | null, phone: string | null, email: string | null, website: string | null, facebook_url: string | null, tagline: string | null, vision: string | null, mission: string | null, core_values: string | null, division: string | null, has_photo: boolean }} PublicSchool
 */

/** @returns {Promise<{ term: GuestTerm | null, sections: GuestSectionItem[] }>} */
export function getGuestSections() {
  return load(["guest", "sections"], async () => /** @type {{ data: any }} */ (await api("/guest/sections")).data);
}

/**
 * @param {number} sectionId
 * @returns {Promise<GuestSection>}
 */
export function getGuestSection(sectionId) {
  return load(["guest", "sections", sectionId], async () => /** @type {{ data: any }} */ (await api(`/guest/sections/${sectionId}`)).data);
}

/** @returns {Promise<PublicSchool>} the school's details, kept for an hour */
export function getPublicSchool() {
  return load(["public", "school"], async () => /** @type {{ data: any }} */ (await api("/public/school")).data, { maxAgeMs: 3_600_000 });
}
