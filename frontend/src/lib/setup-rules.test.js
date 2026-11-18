// @ts-check
import { afterEach, describe, expect, it } from "vitest";
import { presetRows } from "@/features/setup/time-slots.js";
import { buildTerms, dayMonthYear, termName } from "@/features/admin/school-years.js";
import { floorLabel, floorOf, roomsByFloor } from "@/features/schedule/places.js";
import { depEdEmailError, passwordError } from "./forms.js";
import { matchRoute, redirectFor } from "@/router.js";
import { session } from "@/state/session.js";

afterEach(() => {
  session.user = null;
});

describe("bell schedule presets", () => {
  it("makes periods one after another, with a recess and a lunch", () => {
    const rows = presetRows({ rows: 10, start: "07:00", periodMinutes: 45, recess: { after: 3, minutes: 20 }, lunch: { after: 6, minutes: 60 } });
    expect(rows).toHaveLength(10);
    expect(rows?.[0]).toEqual({ is_break: false, label: "", start_time: "07:00", end_time: "07:45" });
    expect(rows?.[3]).toEqual({ is_break: true, label: "Recess", start_time: "09:15", end_time: "09:35" });
    expect(rows?.filter(({ is_break: isBreak }) => isBreak).map(({ label }) => label)).toEqual(["Recess", "Lunch"]);
  });

  it("refuses a break after a period that does not exist, or a day past midnight", () => {
    expect(presetRows({ rows: 8, start: "07:00", periodMinutes: 45, recess: { after: 9, minutes: 20 }, lunch: { after: 0, minutes: 0 } })).toBeNull();
    expect(presetRows({ rows: 16, start: "20:00", periodMinutes: 60, recess: { after: 0, minutes: 0 }, lunch: { after: 0, minutes: 0 } })).toBeNull();
  });
});

describe("school year terms (never hard-coded to 3 or to the word Term)", () => {
  it("names each part from the school year's own word", () => {
    expect(termName(1, "Semester")).toBe("Second Semester");
    expect(termName(3, "Quarter")).toBe("Fourth Quarter");
  });

  it("splits the dates evenly, without gaps", () => {
    const terms = buildTerms(2, "Semester", "2027-06-01", "2028-03-31");
    expect(terms.map(({ name }) => name)).toEqual(["First Semester", "Second Semester"]);
    expect(terms[0].start_date).toBe("2027-06-01");
    expect(terms[1].end_date).toBe("2028-03-31");
    expect(new Date(terms[1].start_date).getTime() - new Date(terms[0].end_date).getTime()).toBe(86_400_000);
  });

  it("shows dates as day/month/year", () => {
    expect(dayMonthYear("2027-06-08")).toBe("08/06/2027 · Tuesday");
    expect(dayMonthYear("")).toBe("");
  });
});

describe("floor plan", () => {
  it("reads the floor from the room number", () => {
    expect(floorOf("101")).toBe(1);
    expect(floorOf("B-204")).toBe(2);
    expect(floorOf("Library")).toBeNull();
    expect(floorLabel(2)).toBe("2nd floor");
  });

  it("puts the top floor first and other rooms last", () => {
    const floors = roomsByFloor([{ room_number: "101" }, { room_number: "Gym" }, { room_number: "301" }, { room_number: "102" }]);
    expect(floors.map(({ floor }) => floor)).toEqual([3, 1, null]);
    expect(floors[1].rooms).toHaveLength(2);
  });
});

describe("account rules", () => {
  it("takes DepEd emails only", () => {
    expect(depEdEmailError("ana@deped.gov.ph")).toBeNull();
    expect(depEdEmailError("ana@gmail.com")).toBe("Use your official DepEd email (@deped.gov.ph)");
    expect(depEdEmailError("")).toBe("Email is required");
  });

  it("asks for a strong password", () => {
    expect(passwordError("Password123!")).toBeNull();
    expect(passwordError("short")).toMatch(/at least 8/);
    expect(passwordError("password123!")).toMatch(/uppercase/);
    expect(passwordError("Password123")).toMatch(/special/);
  });

  it("sends an account to the Terms, then to its own password, before anything else", () => {
    session.user = /** @type {any} */ ({ role: "teacher", terms_accepted_at: null, privacy_accepted_at: null, must_change_password: true });
    expect(redirectFor(matchRoute("/dashboard")?.route ?? null)).toBe("/accept-terms");
    expect(redirectFor(matchRoute("/accept-terms")?.route ?? null)).toBeNull();

    session.user = /** @type {any} */ ({ role: "teacher", terms_accepted_at: "x", privacy_accepted_at: "x", must_change_password: true });
    expect(redirectFor(matchRoute("/dashboard")?.route ?? null)).toBe("/change-password");
    expect(redirectFor(matchRoute("/accept-terms")?.route ?? null)).toBeNull();

    session.user = /** @type {any} */ ({ role: "teacher", terms_accepted_at: "x", privacy_accepted_at: "x", must_change_password: false });
    expect(redirectFor(matchRoute("/change-password")?.route ?? null)).toBe("/dashboard");
    expect(redirectFor(matchRoute("/reset-password")?.route ?? null)).toBeNull();
  });

  it("lets visitors open the home page and the Guest view", () => {
    expect(redirectFor(matchRoute("/")?.route ?? null)).toBeNull();
    expect(redirectFor(matchRoute("/guest/sections/4")?.route ?? null)).toBeNull();
    expect(redirectFor(matchRoute("/somewhere")?.route ?? null)).toBe("/");
  });
});
