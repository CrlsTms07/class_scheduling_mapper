// @ts-check
import { describe, expect, it } from "vitest";
import { formatTime, minutesBetween, parseTime, splitTime, timeRange } from "./time.js";

describe("12-hour times (team decision, Nov 17, 2026)", () => {
  it.each([
    ["00:00", "12:00 AM"],
    ["07:05", "7:05 AM"],
    ["12:00", "12:00 PM"],
    ["13:30", "1:30 PM"],
    ["23:59", "11:59 PM"],
    ["13:30:00", "1:30 PM"],
  ])("shows %s as %s, never as 24-hour time", (time, shown) => {
    expect(formatTime(time)).toBe(shown);
  });

  it("writes a range with both ends", () => {
    expect(timeRange("07:00", "07:45")).toBe("7:00 AM – 7:45 AM");
  });

  it.each([
    ["7:30", "AM", "07:30"],
    ["7", "AM", "07:00"],
    ["715", "AM", "07:15"],
    ["7.15", "PM", "19:15"],
    ["12:00", "AM", "00:00"],
    ["12:00", "PM", "12:00"],
    ["11:59", "PM", "23:59"],
    [" 1:05 ", "PM", "13:05"],
  ])("reads %s %s as %s", (typed, period, expected) => {
    expect(parseTime(typed, /** @type {"AM" | "PM"} */ (period))).toBe(expected);
  });

  it.each(["13:00", "0:30", "7:60", "abc", "", "7:3:0"])("refuses %s", (typed) => {
    expect(parseTime(typed, "AM")).toBeNull();
  });

  it("splits a time for the picker", () => {
    expect(splitTime("13:30")).toEqual({ typed: "1:30", period: "PM" });
    expect(splitTime("00:15")).toEqual({ typed: "12:15", period: "AM" });
  });

  it("counts minutes between two times", () => {
    expect(minutesBetween("07:00", "07:45")).toBe(45);
    expect(minutesBetween("12:30", "13:50")).toBe(80);
  });
});
