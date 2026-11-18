// @ts-check
import { describe, expect, it, vi } from "vitest";

vi.mock("qrcode", () => ({ default: { toString: async () => "<svg></svg>" } }));
const { guestBlocks } = await import("./pages.js");

const WEEK = {
  days: [1, 2, 3, 4, 5].map((day) => ({ day, name: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"][day - 1] })),
  patterns: [{ name: "Monday – Thursday", days: [1, 2, 3, 4] }, { name: "Friday", days: [5] }],
  rows: [
    { start_time: "07:00", end_time: "07:45", time: "", minutes: 45, days: [1, 2, 3, 4], cells: { 1: { subject: "Math 7", room: "101" }, 2: null, 3: null, 4: null, 5: null }, breaks: [], wide_break: null },
    { start_time: "09:20", end_time: "09:40", time: "", minutes: 20, days: [1, 2, 3, 4, 5], cells: {}, breaks: { 1: "BREAK", 2: "BREAK", 3: "BREAK", 4: "BREAK", 5: "BREAK" }, wide_break: "BREAK" },
    { start_time: "15:50", end_time: "16:30", time: "", minutes: 40, days: [5], cells: { 5: { subject: "Values Education", room: null } }, breaks: [], wide_break: null },
  ],
  totals: { 1: "45 minutes", 5: "1 hour" },
};

describe("Guest view", () => {
  it("shows one table per bell schedule, like the official form", () => {
    const blocks = guestBlocks(WEEK);
    expect(blocks.map(({ name }) => name)).toEqual(["Monday – Thursday", "Friday"]);
    expect(blocks[0].week.days.map(({ name }) => name)).toEqual(["Monday", "Tuesday", "Wednesday", "Thursday"]);
    expect(blocks[1].week.rows.map(({ minutes }) => minutes)).toEqual([20, 40]);
  });

  it("shows subject and room only, never a teacher, and breaks as one wide row", () => {
    const [monThu, friday] = guestBlocks(WEEK);
    expect(monThu.week.rows[0].cells[1][0].lines).toEqual(["Math 7", "101"]);
    expect(monThu.week.rows[1].breakLabel).toBe("BREAK");
    expect(friday.week.rows[1].cells[5][0].lines).toEqual(["Values Education"]);
    expect(friday.week.totals).toEqual({ 5: "1 hour" });
  });
});
