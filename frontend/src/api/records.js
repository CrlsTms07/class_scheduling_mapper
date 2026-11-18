// @ts-check
/**
 * Reading and changing the school's records (buildings, bell schedules, subjects, sections,
 * teachers, users, school years, report settings). After any change, everything that could show
 * it is loaded again, so every page agrees.
 */
import { api } from "./client.js";
import { invalidate, load } from "@/state/cache.js";

/**
 * Reads a list or a record, kept for a short while.
 * @param {string} path  like "/buildings"
 */
export function getRecords(path) {
  return load(["records", path], async () => /** @type {{ data: any }} */ (await api(path)).data);
}

/**
 * Sends a change and refreshes what may show it. Returns the reply.
 * @param {string} path
 * @param {"POST" | "PUT" | "DELETE"} method
 * @param {unknown} [body]
 */
export async function changeRecord(path, method, body) {
  const reply = await api(path, { method, body });
  invalidate(["records"]);
  invalidate(["terms"]);
  invalidate(["school-years"]);
  return /** @type {any} */ (reply);
}
