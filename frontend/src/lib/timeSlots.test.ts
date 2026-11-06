import { describe, expect, it } from "vitest";
import type { ManagedPattern } from "@/types/api";
import {
  daysWithoutSchedule,
  minutesBetween,
  minutesTotals,
  PatternSchema,
  slotName,
  SlotSchema,
} from "./timeSlots";

const slot = (minutes: number, is_break = false) => ({
  id: minutes,
  period_no: is_break ? null : 1,
  label: null,
  start_time: "07:00",
  end_time: "08:00",
  minutes,
  is_break,
  locked_reason: null,
});

const pattern = (days: number[], slots = [slot(45)]) =>
  ({ id: 1, level: "JHS", shift: "AM", name: "X", days, locked_reason: null, slots }) as ManagedPattern;

describe("minutesBetween", () => {
  it("counts minutes across hours", () => {
    expect(minutesBetween("07:45", "09:05")).toBe(80);
  });

  it("gives nothing when the range is not valid", () => {
    expect(minutesBetween("09:00", "09:00")).toBeNull();
    expect(minutesBetween("09:00", "08:00")).toBeNull();
  });
});

describe("slotName", () => {
  it("names periods by number, with their label if any", () => {
    expect(slotName({ is_break: false, period_no: 2, label: null })).toBe("Period 2");
    expect(slotName({ is_break: false, period_no: 8, label: "HGP" })).toBe("Period 8 (HGP)");
  });

  it("names breaks by their label", () => {
    expect(slotName({ is_break: true, period_no: null, label: "Lunch" })).toBe("Lunch");
  });
});

describe("daysWithoutSchedule", () => {
  it("lists the school days no bell schedule covers", () => {
    expect(daysWithoutSchedule([pattern([1, 2, 3])])).toEqual(["Thursday", "Friday"]);
  });

  it("is empty when the week is covered", () => {
    expect(daysWithoutSchedule([pattern([1, 2, 3, 4]), pattern([5])])).toEqual([]);
  });
});

describe("minutesTotals", () => {
  it("adds class time and breaks separately", () => {
    expect(minutesTotals(pattern([1], [slot(45), slot(80), slot(20, true)]))).toEqual({
      classMinutes: 125,
      breakMinutes: 20,
    });
  });
});

describe("forms", () => {
  const validSlot = { is_break: false, label: "", start_time: "07:00", end_time: "07:45" };

  it("accepts a period with no name", () => {
    expect(SlotSchema.safeParse(validSlot).success).toBe(true);
  });

  it("needs a name for a break", () => {
    expect(SlotSchema.safeParse({ ...validSlot, is_break: true }).success).toBe(false);
  });

  it("needs the end after the start", () => {
    expect(SlotSchema.safeParse({ ...validSlot, end_time: "07:00" }).success).toBe(false);
  });

  it("needs at least one day for a bell schedule", () => {
    const result = PatternSchema.safeParse({ level: "JHS", shift: "AM", name: "Friday", days: [] });
    expect(result.success).toBe(false);
  });
});
