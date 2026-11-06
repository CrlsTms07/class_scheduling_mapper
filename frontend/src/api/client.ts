const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const CSRF_EXPIRED = 419;

/** An error reply from the API, with its message and any field errors. */
export class ApiError extends Error {
  status: number;
  code?: string;
  errors: Record<string, string[]>;
  body: unknown;

  constructor(
    status: number,
    message: string,
    code?: string,
    errors: Record<string, string[]> = {},
    body: unknown = null,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.errors = errors;
    this.body = body;
  }
}

function readCsrfCookie(): string | null {
  const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function fetchCsrfCookie(): Promise<void> {
  await fetch(`${API_URL}/sanctum/csrf-cookie`, { credentials: "include" });
}

function send(path: string, method: string, body?: unknown): Promise<Response> {
  const csrfToken = readCsrfCookie();

  return fetch(`${API_URL}/api${path}`, {
    method,
    credentials: "include", // sends the session cookie
    headers: {
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(csrfToken ? { "X-XSRF-TOKEN": csrfToken } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function toApiError(response: Response): Promise<ApiError> {
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
 * Calls the API. Changes (POST, PUT, ...) need a CSRF cookie from Laravel,
 * so it is fetched first if missing and refreshed once if it has expired.
 */
export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
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

  return response.json();
}

/**
 * Downloads a generated file through the signed-in session and saves it on the device.
 */
export async function downloadFile(path: string): Promise<void> {
  const response = await send(path, "GET");

  if (!response.ok) {
    throw await toApiError(response);
  }

  const disposition = response.headers.get("Content-Disposition") ?? "";
  const fileName = disposition.match(/filename="([^"]+)"/)?.[1] ?? "download";
  const url = URL.createObjectURL(await response.blob());

  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();

  URL.revokeObjectURL(url);
}
