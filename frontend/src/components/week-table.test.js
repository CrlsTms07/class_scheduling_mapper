// @ts-check
import { describe, expect, it } from "vitest";
import { colorKeyOf, weekFromReportGrid, weekTable } from "./week-table.js";
import { downloadButtons } from "./download-buttons.js";

const GRID = {
  days: [{ day: 1, name: "Monday" }, { day: 2, name: "Tuesday" }],
  rows: [{ start_time: "07:00", end_time: "07:45", time: "7:00 AM – 7:45 AM", minutes: 45, cells: { 1: [["Grade 7 – Honesty", "Math 7", "Room 101"]], 2: [] } }],
  totals: { per_day: { 1: 45, 2: 0 } },
};

describe("week table", () => {
  it("turns a Teacher Program into rows and cells, keeping one color per subject", () => {
    const week = weekFromReportGrid(GRID);
    expect(week.rows[0].cells[1][0].lines).toEqual(["Grade 7 – Honesty", "Math 7", "Room 101"]);
    expect(week.rows[0].cells[1][0].colorKey).toBe(colorKeyOf("Math 7"));
    expect(week.totals).toEqual({ 1: 45, 2: 0 });
  });

  it("shows a table with the totals, and day tabs for phones", () => {
    const element = weekTable(weekFromReportGrid(GRID));
    expect(element.querySelector("table")?.textContent).toContain("Math 7");
    expect(element.querySelector("table")?.textContent).toContain("Total minutes");
    expect([...element.querySelectorAll("[role=tab]")].map((tab) => tab.textContent)).toEqual(["Mon", "Tue"]);
  });
});

describe("downloads (team decision, Nov 18, 2026)", () => {
  it("offers PDF and CSV only", () => {
    const element = downloadButtons({ basePath: "/terms/1/reports/teacher-load", label: "Teacher Load Report" });
    expect([...element.querySelectorAll("button")].map((button) => button.getAttribute("aria-label"))).toEqual(["Download Teacher Load Report as PDF", "Download Teacher Load Report as CSV"]);
  });
});
