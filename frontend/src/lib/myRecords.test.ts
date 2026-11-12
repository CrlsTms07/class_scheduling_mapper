import { describe, expect, it } from "vitest";
import type { MySchedule } from "@/types/api";
import { classesOn, nextClass } from "./myRecords";

const SCHEDULE = {
  term_label: "",
  heading: "",
  details: [],
  days: [],
  totals: { per_day: {}, week: 0, week_duration: "" },
  not_final_count: 0,
  rows: [
    { start_time: "07:15", end_time: "08:00", time: "", minutes: 45, cells: { 1: [["Grade 7 – Hope", "Math 7", "Room 101"]], 2: [] } },
    { start_time: "08:00", end_time: "09:20", time: "", minutes: 80, cells: { 1: [["Grade 7 – Faith", "Math 7", "Room 102"]] } },
  ],
} as MySchedule;

describe("a teacher's day", () => {
  it("lists the classes of a day in order", () => {
    expect(classesOn(SCHEDULE, 1).map(({ start }) => start)).toEqual(["07:15", "08:00"]);
    expect(classesOn(SCHEDULE, 2)).toEqual([]);
  });

  it("finds the next class that has not ended", () => {
    const monday = classesOn(SCHEDULE, 1);

    expect(nextClass(monday, "06:00")?.start).toBe("07:15");
    expect(nextClass(monday, "07:30")?.start).toBe("07:15");
    expect(nextClass(monday, "08:10")?.start).toBe("08:00");
    expect(nextClass(monday, "10:00")).toBeUndefined();
  });
});
