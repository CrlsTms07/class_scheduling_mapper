import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "./client";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

const empty = () => new Response(null, { status: 204 });

function setCsrfCookie(value: string) {
  document.cookie = `XSRF-TOKEN=${value}; path=/`;
}

function clearCsrfCookie() {
  document.cookie = "XSRF-TOKEN=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
}

describe("api", () => {
  beforeEach(clearCsrfCookie);

  it("sends the session cookie and asks for JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, { data: 1 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(api("/me")).resolves.toEqual({ data: 1 });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/me$/);
    expect(options.credentials).toBe("include");
    expect(options.headers.Accept).toBe("application/json");
  });

  it("fetches a CSRF cookie before the first change", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => {
        setCsrfCookie("abc%3D");
        return empty();
      })
      .mockResolvedValueOnce(json(200, {}));
    vi.stubGlobal("fetch", fetchMock);

    await api("/login", { method: "POST", body: { email: "a" } });

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/sanctum\/csrf-cookie$/);

    const [, options] = fetchMock.mock.calls[1];
    expect(options.headers["X-XSRF-TOKEN"]).toBe("abc=");
    expect(options.body).toBe(JSON.stringify({ email: "a" }));
  });

  it("does not fetch a CSRF cookie for a read", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, {}));
    vi.stubGlobal("fetch", fetchMock);

    await api("/active-term");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes an expired CSRF token and retries once", async () => {
    setCsrfCookie("old");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(419, { message: "CSRF token mismatch." }))
      .mockImplementationOnce(async () => {
        setCsrfCookie("new");
        return empty();
      })
      .mockResolvedValueOnce(json(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(api("/logout", { method: "POST" })).resolves.toEqual({ ok: true });

    expect(fetchMock.mock.calls[2][1].headers["X-XSRF-TOKEN"]).toBe("new");
  });

  it("throws an ApiError with the message, code and field errors", async () => {
    setCsrfCookie("token");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        json(422, {
          message: "Invalid.",
          code: "some_code",
          errors: { email: ["Taken."] },
        }),
      ),
    );

    const error: ApiError = await api<never>("/register", {
      method: "POST",
      body: {},
    }).catch((caught) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(422);
    expect(error.message).toBe("Invalid.");
    expect(error.code).toBe("some_code");
    expect(error.errors.email).toEqual(["Taken."]);
  });

  it("still gives a readable error when the reply is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<html>", { status: 500 })),
    );

    await expect(api("/me")).rejects.toThrow("Something went wrong");
  });
});
