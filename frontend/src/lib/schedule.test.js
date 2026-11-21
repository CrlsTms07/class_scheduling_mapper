// @ts-check
import { describe, expect, it } from "vitest";
import { defaultDays, entryAt, fittingPeriods, hasSubject, minutesText, planMove, subjectColor } from "./schedule.js";

const slot = (id, start, end, minutes, isBreak = false) => ({ id, period_no: null, label: isBreak ? "Recess" : null, start_time: start, end_time: end, minutes, is_break: isBreak });
const P1 = slot(1, "07:00", "07:45", 45);
const P2 = slot(2, "07:45", "09:05", 80);
const BREAK = slot(3, "09:05", "09:25", 20, true);
const P4 = slot(4, "09:25", "10:10", 45);
const PATTERN = { id: 10, name: "Monday – Thursday", days: [1, 2, 3, 4], slots: [P1, P2, BREAK, P4] };

const loading = (scheduled, required = 220) => ({ id: 50, subject_id: 5, teacher_id: 7, subject: "Math", is_priority: false, required_minutes: required, scheduled_minutes: scheduled, teacher: "Ana" });
const free = (slotId, days, busy = []) => ({ slot_id: slotId, minutes: 0, free_days: days, busy });
const entry = (day, start, sectionSubjectId = 50, activityId = null) => ({ id: day * 100, day, start_time: start, end_time: "x", status: /** @type {const} */ ("draft"), section_subject_id: sectionSubjectId, activity_id: activityId, subject: "Math", teacher: "Ana", room_id: 1, room: "101" });

describe("which periods a class may go to (UI requirement 6)", () => {
  it("offers only free periods, never breaks", () => {
    const result = fittingPeriods({ patterns: [PATTERN], loading: loading(0), free: [free(1, [1, 2]), free(2, []), free(4, [3])] });

    expect(result.map(({ slot: { id } }) => id)).toEqual([1, 4]);
    expect(result[0].freeDays).toEqual([1, 2]);
  });

  it("leaves out periods longer than the minutes still to place", () => {
    // 220 needed, 160 placed: 60 left, so the 80-minute period does not fit.
    const result = fittingPeriods({ patterns: [PATTERN], loading: loading(160), free: [free(1, [1]), free(2, [1]), free(4, [1])] });

    expect(result.map(({ slot: { id } }) => id)).toEqual([1, 4]);
  });

  it("offers nothing for a subject that is complete", () => {
    expect(fittingPeriods({ patterns: [PATTERN], loading: loading(220), free: [free(1, [1, 2, 3, 4])] })).toEqual([]);
  });

  it("counts the class being changed as not placed, and its own place as free", () => {
    const result = fittingPeriods({
      patterns: [PATTERN],
      loading: loading(220),
      free: [free(2, [], [{ day: 1, reason: "This section already has a class then." }])],
      editing: { slotId: 2, days: [1], sameSubject: true },
    });

    expect(result.map(({ slot: { id } }) => id)).toEqual([2]);
    expect(result[0].freeDays).toEqual([1]);
    expect(result[0].busy).toEqual([]);
  });

  it("keeps the reasons of busy days", () => {
    const [period] = fittingPeriods({ patterns: [PATTERN], loading: loading(0), free: [free(1, [2], [{ day: 1, reason: "Ana Reyes is teaching Grade 7 – Hope." }])] });

    expect(period.busy).toEqual([{ day: 1, reason: "Ana Reyes is teaching Grade 7 – Hope." }]);
  });
});

describe("default days of a new class", () => {
  const plotter = (level, entries = []) => /** @type {any} */ ({ section: { level }, entries });

  it("takes every free day of the bell schedule in Junior High", () => {
    expect(defaultDays(plotter("JHS"), PATTERN, P1, 2, [1, 2, 3, 4])).toEqual([1, 2, 3, 4]);
  });

  it("leaves days that already have a class, and busy days", () => {
    expect(defaultDays(plotter("JHS", [entry(3, "07:00")]), PATTERN, P1, 2, [1, 2, 3])).toEqual([1, 2]);
  });

  it("takes only the tapped day in Senior High", () => {
    expect(defaultDays(plotter("SHS"), PATTERN, P1, 2, [1, 2, 3, 4])).toEqual([2]);
  });
});

describe("moving a class", () => {
  const entries = [entry(1, "07:00"), entry(2, "07:00"), entry(3, "07:00")];

  it("moves the whole subject across the bell schedule in Junior High", () => {
    expect(planMove({ loadingId: 50, slot: P4, day: 1, from: { slot: P1, day: 1 } }, [PATTERN], entries, "JHS")).toEqual({ from_days: [1, 2, 3], days: [1, 2, 3] });
  });

  it("moves one class in Senior High", () => {
    expect(planMove({ loadingId: 50, slot: P4, day: 2, from: { slot: P1, day: 1 } }, [PATTERN], entries, "SHS")).toEqual({ from_days: [1], days: [2] });
  });

  it("does nothing when dropped where it already is", () => {
    expect(planMove({ loadingId: 50, slot: P1, day: 1, from: { slot: P1, day: 1 } }, [PATTERN], entries, "SHS")).toBeNull();
  });
});

describe("words and colors", () => {
  it("says how much of a subject is placed", () => {
    expect(minutesText({ ...loading(160), required_minutes: null })).toBe("160 mins a week on the schedule");
    expect(minutesText(loading(160))).toBe("160 of 220 mins · 60 left");
    expect(minutesText(loading(220))).toBe("220 of 220 mins · Complete");
    expect(minutesText(loading(240))).toBe("240 of 220 mins · Over by 20 mins");
  });

  it("treats an open slot as empty and an activity as taken", () => {
    expect(hasSubject(entry(1, "07:00", null))).toBe(false);
    expect(hasSubject(entry(1, "07:00", null, 3))).toBe(true);
    expect(entryAt([entry(1, "07:00")], 1, P1)?.day).toBe(1);
  });

  it("keeps one color per subject, plain when colors are off", () => {
    expect(subjectColor(50)).toBe(subjectColor(50));
    expect(subjectColor(50, false)).toContain("bg-surface");
  });
});
