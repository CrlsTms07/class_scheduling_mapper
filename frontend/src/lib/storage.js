// @ts-check
/**
 * Browser storage for small conveniences (the last view, the picked term). It can be blocked
 * or empty (private windows), so every read and write is guarded and the app works without it.
 */

/**
 * @param {string} key
 * @returns {string | null}
 */
export function readSetting(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * @param {string} key
 * @param {string} value
 */
export function saveSetting(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Only a convenience: it is simply forgotten.
  }
}
