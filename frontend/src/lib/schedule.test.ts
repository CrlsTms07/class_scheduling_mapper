import { describe, expect, it } from "vitest";
import type { DayPattern, Loading, ScheduleEntry, TimeSlot } from "@/types/api";
import {
  entryAt,
  formatTime,
  hasSubject,
  isLocked,
  nextSubject,
  planMove,
  readDrop,
  remainingHint,
  subjectColor,
  subjectsDone,
  termWord,
} from "./schedule";

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

describe("termWord", () => {
  it("uses the word of the school year, never its own", () => {
    expect(termWord({ school_year: { term_label: "Semester" } })).toBe("semester");
    expect(termWord({ school_year: { term_label: "Quarter" } })).toBe("quarter");
    expect(termWord(null)).toBe("period");
  });
});

describe("progress of a section", () => {
  const item = (id: number, scheduled: number, required: number) =>
    ({ id, subject: `S${id}`, scheduled_minutes: scheduled, required_minutes: required }) as Loading;

  it("counts complete subjects, and finds the next one that is short", () => {
    const loading = [item(1, 60, 60), item(2, 100, 60), item(3, 0, 60)];

    expect(subjectsDone(loading)).toBe(1);
    expect(nextSubject(loading)?.id).toBe(3);
    expect(nextSubject([item(1, 60, 60)])).toBeUndefined();
  });

  const monThu = { id: 1, start_time: "07:00", end_time: "07:45", minutes: 45, is_break: false } as TimeSlot;
  const recess = { id: 2, start_time: "07:45", end_time: "08:05", minutes: 20, is_break: true } as TimeSlot;
  const friday = { id: 3, start_time: "07:00", end_time: "07:40", minutes: 40, is_break: false } as TimeSlot;
  const patterns = [
    { id: 1, name: "Monday – Thursday", days: [1, 2, 3, 4], slots: [monThu, recess] },
    { id: 2, name: "Friday", days: [5], slots: [friday] },
  ] as DayPattern[];

  it("says when it is complete or over", () => {
    expect(remainingHint(item(1, 60, 60), { patterns, entries: [], level: "JHS" })).toBe("Complete");
    expect(remainingHint(item(1, 90, 60), { patterns, entries: [], level: "JHS" })).toBe("Over by 30 mins");
  });

  it("JHS: suggests the period that would finish it, counting all the days of its bell schedule", () => {
    expect(remainingHint(item(1, 180, 220), { patterns, entries: [], level: "JHS" })).toBe(
      "40 mins left. This fits: Friday, 7:00 AM – 7:40 AM",
    );
    expect(remainingHint(item(1, 40, 220), { patterns, entries: [], level: "JHS" })).toBe(
      "180 mins left. This fits: Monday – Thursday, 7:00 AM – 7:45 AM",
    );
  });

  it("does not suggest a period that is taken, and never a break", () => {
    const taken = entry({ day: 5, start_time: "07:00", section_subject_id: 9 });

    expect(remainingHint(item(1, 180, 220), { patterns, entries: [taken], level: "JHS" })).toBe("40 mins left");
    expect(remainingHint(item(1, 0, 20), { patterns, entries: [], level: "JHS" })).toBe("20 mins left");
  });

  it("SHS: suggests one free day", () => {
    expect(remainingHint(item(1, 0, 45), { patterns, entries: [], level: "SHS" })).toBe(
      "45 mins left. This fits: Monday, 7:00 AM – 7:45 AM",
    );
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
