import { describe, expect, it } from "vitest";
import type { GuestWeek } from "@/types/api";
import { blocksFromGuestWeek, colorKeyOf, firstDayToShow, rowsOfDay, weekFromGuestWeek, weekFromReportGrid } from "./weekGrid";

const DAYS = [
  { day: 1, name: "Monday" },
  { day: 2, name: "Tuesday" },
];

const WEEK: GuestWeek = {
  days: DAYS,
  patterns: [{ name: "Monday – Tuesday", days: [1, 2] }],
  totals: { 1: "1 hour", 2: "–" },
  rows: [
    {
      start_time: "13:00:00",
      end_time: "13:45:00",
      time: "1:00 - 1:45",
      minutes: 45,
      days: [1, 2],
      cells: { 1: { subject: "Math 7", room: "Main – 101" }, 2: null },
      breaks: [],
      wide_break: null,
    },
    {
      start_time: "13:45:00",
      end_time: "14:05:00",
      time: "1:45 - 2:05",
      minutes: 20,
      days: [1, 2],
      cells: { 1: null, 2: null },
      breaks: { 1: "RECESS", 2: "RECESS" },
      wide_break: "RECESS",
    },
    {
      start_time: "14:05:00",
      end_time: "14:50:00",
      time: "2:05 - 2:50",
      minutes: 45,
      days: [1, 2],
      cells: { 1: null, 2: null },
      breaks: [],
      wide_break: null,
    },
  ],
};

describe("weekFromGuestWeek", () => {
  it("shows times with AM or PM, and leaves out blanks", () => {
    const week = weekFromGuestWeek(WEEK);

    expect(week.rows[0].time).toBe("1:00 PM – 1:45 PM");
    expect(week.rows[0].cells[1][0].lines).toEqual(["Math 7", "Main – 101"]);
    expect(week.rows[0].cells[2]).toEqual([]);
    expect(week.totals[1]).toBe("1 hour");
  });

  it("keeps breaks", () => {
    expect(weekFromGuestWeek(WEEK).rows[1].wideBreak).toBe("RECESS");
  });
});

describe("blocksFromGuestWeek", () => {
  const SPLIT: GuestWeek = {
    days: DAYS,
    patterns: [
      { name: "Monday", days: [1] },
      { name: "Tuesday", days: [2] },
    ],
    totals: { 1: "45 minutes", 2: "40 minutes" },
    rows: [
      { ...WEEK.rows[0], days: [1] },
      {
        start_time: "13:00:00",
        end_time: "13:40:00",
        time: "1:00 - 1:40",
        minutes: 40,
        days: [2],
        cells: { 1: null, 2: { subject: "Science 7", room: null } },
        breaks: [],
        wide_break: null,
      },
      {
        start_time: "14:00:00",
        end_time: "14:20:00",
        time: "2:00 - 2:20",
        minutes: 20,
        days: [2],
        cells: { 1: null, 2: null },
        breaks: { 2: "RECESS" },
        wide_break: null,
      },
    ],
  };

  it("gives each bell schedule only its own days and periods", () => {
    const [monday, tuesday] = blocksFromGuestWeek(SPLIT);

    expect(monday.name).toBe("Monday");
    expect(monday.week.days).toEqual([{ day: 1, name: "Monday" }]);
    expect(monday.week.rows.map(({ minutes }) => minutes)).toEqual([45]);
    expect(tuesday.week.rows.map(({ minutes }) => minutes)).toEqual([40, 20]);
  });

  it("widens a break that covers all the days of its table", () => {
    const [, tuesday] = blocksFromGuestWeek(SPLIT);

    expect(tuesday.week.rows[0].wideBreak).toBeNull();
    expect(tuesday.week.rows[1].wideBreak).toBe("RECESS");
  });
});

describe("weekFromReportGrid", () => {
  it("colors a cell by its subject, the second line", () => {
    const week = weekFromReportGrid({
      days: DAYS,
      totals: { per_day: { 1: 45, 2: 0 }, week: 45, week_duration: "45 minutes" },
      rows: [
        {
          start_time: "07:00",
          end_time: "07:45",
          time: "7:00 AM – 7:45 AM",
          minutes: 45,
          cells: { 1: [["Grade 7 – Honesty", "Math 7", null]], 2: [] },
        },
      ],
    });

    expect(week.rows[0].cells[1][0]).toEqual({ lines: ["Grade 7 – Honesty", "Math 7"], colorKey: colorKeyOf("Math 7") });
    expect(week.totals[1]).toBe(45);
  });
});

describe("colorKeyOf", () => {
  it("is the same for the same text and handles blanks", () => {
    expect(colorKeyOf("Math 7")).toBe(colorKeyOf("Math 7"));
    expect(colorKeyOf("Math 7")).not.toBe(colorKeyOf("Science 7"));
    expect(colorKeyOf(null)).toBe(0);
  });
});

describe("firstDayToShow", () => {
  it("opens on today on a school day", () => {
    expect(firstDayToShow(DAYS, 2)).toBe(2);
  });

  it("opens on the first day on a weekend", () => {
    expect(firstDayToShow(DAYS, 0)).toBe(1);
    expect(firstDayToShow(DAYS, 6)).toBe(1);
  });
});

describe("rowsOfDay", () => {
  it("keeps classes and breaks, not empty periods", () => {
    const { rows } = weekFromGuestWeek(WEEK);

    expect(rowsOfDay(rows, 1).map(({ minutes }) => minutes)).toEqual([45, 20]);
    expect(rowsOfDay(rows, 2).map(({ minutes }) => minutes)).toEqual([20]);
  });
});
