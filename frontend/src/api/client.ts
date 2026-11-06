const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const CSRF_EXPIRED = 419;

/** An error reply from the API, with its message and any field errors. */
export class ApiError extends Error {
  status: number;
  code?: string;
  errors: Record<string, string[]>;

  constructor(
    status: number,
    message: string,
    code?: string,
    errors: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.errors = errors;
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
