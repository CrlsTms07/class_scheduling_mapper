// @ts-check
/**
 * The signed-in user. Loaded once from /api/me when the app starts, and changed by sign-in,
 * sign-out and anything that sends back the user (accepting the Terms, a new password...).
 */
import { api, isSessionLost } from "@/api/client.js";
import { clearAll } from "./cache.js";

/**
 * @typedef {"super_admin" | "glc" | "master_teacher" | "teacher"} RoleName
 * @typedef {object} User
 * @property {number} id
 * @property {string} email
 * @property {string} first_name
 * @property {string | null} middle_name
 * @property {string} last_name
 * @property {RoleName | null} role
 * @property {{ id: number, name: string } | null} personnel
 * @property {string | null} [terms_accepted_at]
 * @property {string | null} [privacy_accepted_at]
 * @property {boolean} [must_change_password]
 * @property {{ color_coding: boolean }} [preferences]
 * @property {{ id: number, grade: number, level: "JHS" | "SHS" }[]} grade_levels
 */

/** @type {{ user: User | null, hasSignedOut: boolean }} */
export const session = { user: null, hasSignedOut: false };

/** @type {Set<() => void>} */
const listeners = new Set();

/**
 * Runs a function whenever the user changes. Returns the function that stops it.
 * @param {() => void} run
 */
export function onUserChange(run) {
  listeners.add(run);
  return () => listeners.delete(run);
}

/**
 * Sets the signed-in user (null after signing out) and tells the app.
 * @param {User | null} user
 */
export function setUser(user) {
  session.user = user;
  if (!user) clearAll();
  for (const run of [...listeners]) run();
}

/** Asks the API who is signed in. A visitor is null. */
export async function loadUser() {
  try {
    const { data } = /** @type {{ data: User | null }} */ (await api("/me"));
    session.user = data;
  } catch (error) {
    if (!isSessionLost(error)) throw error;
    session.user = null;
  }
  return session.user;
}

/** Signs out on the server and forgets everything from this session. */
export async function signOut() {
  await api("/logout", { method: "POST" });
  session.hasSignedOut = true;
  setUser(null);
}

/** Subjects show in color on the schedule unless the user turned it off. */
export function isColorCoding() {
  return session.user?.preferences?.color_coding ?? true;
}

/** "Juan D. Cruz" style short name for the header. */
export function displayName() {
  const user = session.user;
  return user ? `${user.first_name} ${user.last_name}` : "";
}

/**
 * The letters in the round picture of the header: "Carlos Tomas" is "CT".
 * @param {{ first_name?: string | null, last_name?: string | null } | null | undefined} person
 */
export function initialsOf(person) {
  const letter = (/** @type {string | null | undefined} */ text) => (text ?? "").trim().charAt(0).toUpperCase();
  return `${letter(person?.first_name)}${letter(person?.last_name)}` || "?";
}
