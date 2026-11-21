// @ts-check
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearAll, invalidate, load, peek, setData, watch } from "./cache.js";
import { matchRoute, redirectFor } from "@/router.js";
import { session } from "./session.js";
import { navigationFor } from "@/lib/navigation.js";

beforeEach(() => {
  clearAll();
  session.user = null;
});

describe("data cache", () => {
  it("asks the API once while the data is fresh", async () => {
    const fetcher = vi.fn(async () => ["a"]);
    await load(["terms"], fetcher);
    await load(["terms"], fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("loads again after a change, and tells the pages that show it", async () => {
    const fetcher = vi.fn(async () => ["a"]);
    const seen = vi.fn();
    watch(["terms", 3], seen);
    await load(["terms", 3, "sections"], fetcher);

    invalidate(["terms", 3]);
    await load(["terms", 3, "sections"], fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(seen).toHaveBeenCalled();
  });

  it("keeps the schedule a save sent back", () => {
    setData(["terms", 3, "sections", 5, "plotter"], { status: "draft" });
    invalidate(["terms", 3], { except: ["terms", 3, "sections", 5, "plotter"] });
    expect(peek(["terms", 3, "sections", 5, "plotter"])).toEqual({ status: "draft" });
  });
});

describe("router", () => {
  it("reads the parts of an address", () => {
    expect(matchRoute("/schedule/sections/12")?.params).toEqual({ sectionId: "12" });
    expect(matchRoute("/nowhere")).toBeNull();
  });

  it("sends visitors to sign in, and keeps pages to their roles", () => {
    expect(redirectFor(matchRoute("/schedule")?.route ?? null)).toBe("/login");

    session.user = /** @type {any} */ ({ role: "teacher" });
    expect(redirectFor(matchRoute("/schedule")?.route ?? null)).toBe("/dashboard");
    expect(redirectFor(matchRoute("/my-schedule")?.route ?? null)).toBeNull();
    expect(redirectFor(matchRoute("/login")?.route ?? null)).toBe("/dashboard");

    session.user = /** @type {any} */ ({ role: "glc" });
    expect(redirectFor(matchRoute("/schedule/sections/4")?.route ?? null)).toBeNull();
    expect(redirectFor(matchRoute("/approvals")?.route ?? null)).toBe("/dashboard");
  });
});

describe("menu (design audit, Must fix #2)", () => {
  it("follows the setup steps in order, and stays short", () => {
    const groups = navigationFor("super_admin");
    expect(groups.map(({ label }) => label)).toEqual(["Main", "Setup", "Admin"]);
    expect(groups[1].items.map(({ name }) => name)).toEqual(["1 · Teachers", "2 · Subjects", "3 · Sections", "4 · Rooms & Buildings", "5 · Teacher Loading", "Class Hours"]);
    expect(groups[0].items.map(({ name }) => name)).toEqual(["Dashboard", "Schedule", "Approvals", "Reports"]);
    expect(groups.flatMap(({ items }) => items)).toHaveLength(13);
  });

  it("shows a teacher only their own records", () => {
    expect(navigationFor("teacher").flatMap(({ items }) => items).map(({ name }) => name)).toEqual(["Dashboard", "My Schedule", "My Profile"]);
  });

  it("shows My Schedule to a chairperson only with a personnel record", () => {
    const names = (hasPersonnel) => navigationFor("glc", hasPersonnel).flatMap(({ items }) => items).map(({ name }) => name);
    expect(names(false)).not.toContain("My Schedule");
    expect(names(true)).toContain("My Schedule");
  });
});
