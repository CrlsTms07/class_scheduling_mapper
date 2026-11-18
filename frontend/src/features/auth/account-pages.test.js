// @ts-check
import { describe, expect, it, vi } from "vitest";

vi.mock("@/api/client.js", async (original) => ({ ...(await original()), api: vi.fn(async () => ({ data: { google: false } })) }));
vi.mock("@/api/guest.js", () => ({ getPublicSchool: async () => ({ email: "school@deped.gov.ph" }) }));
const { renderSignUp, renderForgot, renderReset } = await import("./account-pages.js");

describe("account pages", () => {
  it("opens Sign up with both agreement boxes", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    await renderSignUp(container, /** @type {any} */ ({ params: {}, query: new URLSearchParams(), navigate: () => {} }));
    expect(container.querySelector("h1")?.textContent).toBe("Sign up");
    expect(container.querySelectorAll("input[type=checkbox]")).toHaveLength(2);
  });

  it("opens Forgot password and Reset password", () => {
    const forgot = document.createElement("div");
    renderForgot(forgot, /** @type {any} */ ({ params: {}, query: new URLSearchParams(), navigate: () => {} }));
    expect(forgot.textContent).toContain("Forgot your password?");
    const reset = document.createElement("div");
    renderReset(reset, /** @type {any} */ ({ params: {}, query: new URLSearchParams("token=abc&email=ana%40deped.gov.ph"), navigate: () => {} }));
    expect(reset.textContent).toContain("For ana@deped.gov.ph");
  });
});
