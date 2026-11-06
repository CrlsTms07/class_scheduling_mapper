import { describe, expect, it } from "vitest";
import type { ScheduleEntry, TimeSlot } from "@/types/api";
import { entryAt, formatTime, isLocked, subjectColor } from "./schedule";

const slot = { start_time: "08:00" } as TimeSlot;

const entry = (overrides: Partial<ScheduleEntry>) =>
  ({ day: 1, start_time: "08:00", status: "draft", ...overrides }) as ScheduleEntry;

describe("formatTime", () => {
  it.each([
    ["07:00", "7:00 AM"],
    ["12:00", "12:00 PM"],
    ["12:30", "12:30 PM"],
    ["13:05", "1:05 PM"],
    ["00:15", "12:15 AM"],
  ])("shows %s as %s", (time, expected) => {
    expect(formatTime(time)).toBe(expected);
  });
});

describe("entryAt", () => {
  it("finds the entry for the day and time", () => {
    const monday = entry({ id: 1, day: 1 });
    const tuesday = entry({ id: 2, day: 2 });

    expect(entryAt([monday, tuesday], 2, slot)).toBe(tuesday);
  });

  it("finds nothing at another time", () => {
    expect(entryAt([entry({ start_time: "09:00" })], 1, slot)).toBeUndefined();
  });
});

describe("isLocked", () => {
  it.each([
    ["draft", false],
    ["pending", true],
    ["approved", true],
  ] as const)("%s is locked: %s", (status, expected) => {
    expect(isLocked(entry({ status }))).toBe(expected);
  });
});

describe("subjectColor", () => {
  it("keeps one color per subject", () => {
    expect(subjectColor(5)).toBe(subjectColor(5));
    expect(subjectColor(5)).not.toBe(subjectColor(6));
  });

  it("shows an open slot in gray", () => {
    expect(subjectColor(null)).toContain("neutral");
  });
});
