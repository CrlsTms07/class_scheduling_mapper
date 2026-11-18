// @ts-check
/**
 * Keeps what the API sent, so pages open fast and stay in step. A page asks with load(key, fetch);
 * after a change, invalidate(key) makes every page that shows that data load it again.
 * Keys are arrays, like ["terms", 3, "sections"], so one call can refresh a whole group.
 */

/** @typedef {(string | number | null | undefined)[]} Key */

/** @type {Map<string, { key: Key, data?: unknown, promise?: Promise<unknown>, time: number }>} */
const entries = new Map();
/** @type {Set<{ prefix: Key, run: () => void }>} */
const listeners = new Set();

/** @param {Key} key */
const id = (key) => JSON.stringify(key);

/**
 * @param {Key} key
 * @param {Key} prefix
 */
const startsWith = (key, prefix) => prefix.every((part, index) => key[index] === part);

/**
 * The data for a key: from memory while fresh, otherwise from the API.
 * @template T
 * @param {Key} key
 * @param {() => Promise<T>} fetcher
 * @param {{ maxAgeMs?: number }} [options]  how long the data stays fresh (default 30 seconds)
 * @returns {Promise<T>}
 */
export function load(key, fetcher, { maxAgeMs = 30_000 } = {}) {
  const entry = entries.get(id(key));

  if (entry?.promise) return /** @type {Promise<T>} */ (entry.promise);
  if (entry && "data" in entry && Date.now() - entry.time < maxAgeMs) {
    return Promise.resolve(/** @type {T} */ (entry.data));
  }

  const promise = fetcher().then(
    (data) => {
      entries.set(id(key), { key, data, time: Date.now() });
      return data;
    },
    (error) => {
      entries.delete(id(key));
      throw error;
    },
  );
  entries.set(id(key), { ...(entry ?? { key, time: 0 }), key, promise });
  return promise;
}

/**
 * What is in memory for a key, without asking the API.
 * @param {Key} key
 */
export function peek(key) {
  return entries.get(id(key))?.data;
}

/**
 * Puts fresh data in memory (for example the schedule a save sent back) and tells the pages.
 * @param {Key} key
 * @param {unknown} data
 */
export function setData(key, data) {
  entries.set(id(key), { key, data, time: Date.now() });
  notify(key);
}

/**
 * Forgets every key that starts with the prefix, and tells the pages showing it to load again.
 * @param {Key} prefix
 * @param {{ except?: Key }} [options]  a key to keep (one that was just set with setData)
 */
export function invalidate(prefix, { except } = {}) {
  for (const [entryId, entry] of entries) {
    if (startsWith(entry.key, prefix) && !(except && id(entry.key) === id(except))) entries.delete(entryId);
  }
  notify(prefix);
}

/** Forgets everything, for example after signing out. */
export function clearAll() {
  entries.clear();
}

/**
 * Runs a function whenever data under the prefix changes. Returns the function that stops it.
 * @param {Key} prefix
 * @param {() => void} run
 */
export function watch(prefix, run) {
  const listener = { prefix, run };
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** @param {Key} changed */
function notify(changed) {
  for (const listener of [...listeners]) {
    if (startsWith(changed, listener.prefix) || startsWith(listener.prefix, changed)) listener.run();
  }
}
