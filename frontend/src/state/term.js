// @ts-check
/**
 * The term the user is working on: the active term, unless they picked another at the top.
 * Always shown in the header, so everyone knows which school year and term they are changing.
 */
import { api } from "@/api/client.js";
import { readSetting, saveSetting } from "@/lib/storage.js";
import { load } from "./cache.js";

/**
 * @typedef {object} Term
 * @property {number} id
 * @property {number} term_no
 * @property {string} name
 * @property {string} start_date
 * @property {string} end_date
 * @property {boolean} is_active
 * @property {{ id: number, name: string, term_count: number, term_label: string }} school_year
 */

const STORAGE_KEY = "selected-term-id";

/** @type {{ terms: Term[], term: Term | null }} */
export const termState = { terms: [], term: null };

/** @type {Set<() => void>} */
const listeners = new Set();

/**
 * @param {() => void} run
 */
export function onTermChange(run) {
  listeners.add(run);
  return () => listeners.delete(run);
}

/** Loads the terms and picks the remembered one, the active one, or the first. */
export async function loadTerms() {
  const terms = await load(["terms"], async () => /** @type {{ data: Term[] }} */ (await api("/terms")).data, { maxAgeMs: 300_000 });
  const savedId = Number(readSetting(STORAGE_KEY));

  termState.terms = terms;
  termState.term = terms.find(({ id }) => id === savedId) ?? terms.find(({ is_active: isActive }) => isActive) ?? terms[0] ?? null;
  return termState.term;
}

/**
 * Switches to another term, remembers it, and tells the open page.
 * @param {number} termId
 */
export function selectTerm(termId) {
  const term = termState.terms.find(({ id }) => id === termId);
  if (!term) return;
  saveSetting(STORAGE_KEY, String(termId));
  termState.term = term;
  for (const run of [...listeners]) run();
}

/**
 * What this school year calls a part of it, such as "term" or "semester". Never written in code.
 * @param {Term | null | undefined} term
 */
export function termWord(term) {
  return term?.school_year?.term_label?.toLowerCase() ?? "period";
}

/**
 * "SY 2026-2027 · Second Term (active)".
 * @param {Term} term
 */
export function termLabel(term) {
  return `SY ${term.school_year.name} · ${term.name}${term.is_active ? " (active)" : ""}`;
}
