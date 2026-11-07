import { describe, expect, it } from "vitest";
import type { DayPattern, ScheduleEntry, TimeSlot } from "@/types/api";
import { entryAt, formatTime, hasSubject, isLocked, planMove, readDrop, subjectColor } from "./schedule";

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

describe("hasSubject", () => {
  it("is false for an empty period and an open slot", () => {
    expect(hasSubject(undefined)).toBe(false);
    expect(hasSubject(entry({ section_subject_id: null }))).toBe(false);
    expect(hasSubject(entry({ section_subject_id: 5 }))).toBe(true);
  });
});

describe("readDrop", () => {
  const slot = { id: 9 } as TimeSlot;
  const active = { data: { current: { loadingId: 4 } } };

  it("reads the subject and the slot it landed on", () => {
    expect(readDrop({ active, over: { data: { current: { slot, day: 2 } } } })).toEqual({ loadingId: 4, slot, day: 2 });
  });

  it("places nothing when dropped outside a slot", () => {
    expect(readDrop({ active, over: null })).toBeNull();
  });

  it("keeps where a placed class came from", () => {
    const from = { slot: { id: 8 } as TimeSlot, day: 1 };

    expect(
      readDrop({ active: { data: { current: { loadingId: 4, from } } }, over: { data: { current: { slot, day: 2 } } } }),
    ).toEqual({ loadingId: 4, slot, day: 2, from });
  });
});

describe("planMove", () => {
  const first = { id: 1, start_time: "07:00" } as TimeSlot;
  const second = { id: 2, start_time: "07:45" } as TimeSlot;
  const friday = { id: 3, start_time: "07:00" } as TimeSlot;
  const patterns = [
    { id: 1, days: [1, 2, 3, 4], slots: [first, second] },
    { id: 2, days: [5], slots: [friday] },
  ] as DayPattern[];
  const placed = (day: number, id = 50) => entry({ day, start_time: "07:00", section_subject_id: id });

  const plan = (to: TimeSlot, day: number, level: "JHS" | "SHS", entries: ScheduleEntry[]) =>
    planMove({ loadingId: 50, slot: to, day, from: { slot: first, day: 1 } }, patterns, entries, level);

  it("JHS: moves the subject across its bell schedule, leaving other subjects", () => {
    expect(plan(second, 1, "JHS", [placed(1), placed(2), placed(3, 51), placed(4)])).toEqual({
      from_days: [1, 2, 4],
      days: [1, 2, 4],
    });
  });

  it("JHS: dropping on another day at the same time changes nothing", () => {
    expect(plan(first, 3, "JHS", [placed(1)])).toBeNull();
  });

  it("JHS: moves only the dragged class to another bell schedule", () => {
    expect(plan(friday, 5, "JHS", [placed(1), placed(2)])).toEqual({ from_days: [1], days: [5] });
  });

  it("SHS: moves one class, to any day", () => {
    expect(plan(second, 3, "SHS", [placed(1), placed(2)])).toEqual({ from_days: [1], days: [3] });
  });

  it("SHS: dropping on its own place changes nothing", () => {
    expect(plan(first, 1, "SHS", [placed(1)])).toBeNull();
  });
});
