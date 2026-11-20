// @ts-check
/**
 * Talks to the Laravel API. Laravel Sanctum keeps the user signed in with a session cookie,
 * and every change (POST, PUT, DELETE) carries the CSRF token from the XSRF-TOKEN cookie.
 */

/** Where the API lives. Empty on the live server, where it shares the address of the page. */
export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const CSRF_EXPIRED = 419;

/** An error reply from the API, with its message, its code and any field errors. */
export class ApiError extends Error {
  /**
   * @param {number} status
   * @param {string} message
   * @param {string} [code]
   * @param {Record<string, string[]>} [errors]
   * @param {any} [body]
   */
  constructor(status, message, code, errors = {}, body = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.errors = errors;
    this.body = body;
  }
}

function readCsrfCookie() {
  const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function fetchCsrfCookie() {
  await fetch(`${API_URL}/sanctum/csrf-cookie`, { credentials: "include" });
}

/**
 * @param {string} path
 * @param {string} method
 * @param {unknown} [body]
 */
function send(path, method, body) {
  const csrfToken = readCsrfCookie();
  // A file upload sets its own content type, so the browser can add the file boundary.
  const isUpload = body instanceof FormData;

  /** @type {Record<string, string>} */
  const headers = { Accept: "application/json" };
  if (body !== undefined && !isUpload) headers["Content-Type"] = "application/json";
  if (csrfToken) headers["X-XSRF-TOKEN"] = csrfToken;

  return fetch(`${API_URL}/api${path}`, {
    method,
    credentials: "include", // sends the session cookie
    headers,
    body: body === undefined ? undefined : isUpload ? /** @type {FormData} */ (body) : JSON.stringify(body),
  });
}

/** @param {Response} response */
async function toApiError(response) {
  const body = await response.json().catch(() => ({}));

  return new ApiError(
    response.status,
    body.message ?? "Something went wrong. Please try again.",
    body.code,
    body.errors,
    body,
  );
}

/**
 * Calls the API and returns its JSON. Changes need a CSRF cookie from Laravel, so it is
 * fetched first if missing, and refreshed once if it has expired.
 *
 * @template T
 * @param {string} path  like "/terms/3/sections"
 * @param {{ method?: string, body?: unknown }} [options]
 * @returns {Promise<T>}
 */
export async function api(path, options = {}) {
  const method = options.method ?? "GET";

  if (method !== "GET" && !readCsrfCookie()) {
    await fetchCsrfCookie();
  }

  let response = await send(path, method, options.body);

  if (response.status === CSRF_EXPIRED) {
    await fetchCsrfCookie();
    response = await send(path, method, options.body);
  }

  if (!response.ok) {
    throw await toApiError(response);
  }

  return response.status === 204 ? /** @type {T} */ (null) : response.json();
}

/**
 * Downloads a generated file (PDF or CSV) through the signed-in session and saves it.
 * @param {string} path
 * @returns {Promise<string>} the file name
 */
export async function downloadFile(path) {
  const response = await send(path, "GET");

  if (!response.ok) {
    throw await toApiError(response);
  }

  const disposition = response.headers.get("Content-Disposition") ?? "";
  const fileName = disposition.match(/filename="?([^";]+)"?/)?.[1] ?? "download";
  const url = URL.createObjectURL(await response.blob());

  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);

  return fileName;
}

/**
 * The message to show for any error: the API's own words when there are some.
 * @param {unknown} error
 */
export function errorMessage(error) {
  if (error instanceof ApiError) {
    const first = Object.values(error.errors ?? {})[0]?.[0];
    return first && error.status === 422 ? first : error.message;
  }
  return "Something went wrong. Please check your connection and try again.";
}

/**
 * Whether the API says the session ended (signed out elsewhere, or expired).
 * @param {unknown} error
 */
export function isSessionLost(error) {
  return error instanceof ApiError && (error.status === 401 || error.status === 419);
}
