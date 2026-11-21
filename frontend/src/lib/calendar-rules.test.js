// @ts-check
import { describe, expect, it } from "vitest";
import { latestEnd, termProblems, yearName, yearProblems } from "./calendar-rules.js";

const YEARS = [{ id: 1, name: "2026-2027", start_date: "2026-06-08", end_date: "2027-03-26" }];

describe("school year rules, checked while the dates are chosen", () => {
  it("makes the name from the first day, so it is never typed wrong", () => {
    expect(yearName("2027-06-07")).toBe("2027-2028");
    expect(yearName("")).toBe("");
  });

  it("allows one year at most", () => {
    expect(latestEnd("2027-06-07")).toBe("2028-06-06");
    expect(yearProblems({ start_date: "2027-06-07", end_date: "2028-06-30" }, YEARS).end_date).toBe("A school year is one year at most: end it by Jun 6, 2028.");
    expect(yearProblems({ start_date: "2027-06-07", end_date: "2027-06-01" }, YEARS).end_date).toBe("The last day must be after the first day.");
    expect(yearProblems({ start_date: "2027-06-07", end_date: "2028-03-31" }, YEARS)).toEqual({});
  });

  it("says when the dates overlap another school year, or its name is taken", () => {
    expect(yearProblems({ start_date: "2026-06-06", end_date: "2027-04-06" }, YEARS).start_date).toContain("SY 2026-2027 already exists");
    expect(yearProblems({ start_date: "2025-06-20", end_date: "2026-06-10" }, YEARS).start_date).toBe("These dates overlap SY 2026-2027 (Jun 8, 2026 – Mar 26, 2027). Start after Mar 26, 2027.");
    // The year being changed is left out.
    expect(yearProblems({ start_date: "2026-06-08", end_date: "2027-03-31" }, YEARS, 1)).toEqual({});
  });
});

describe("term rules", () => {
  const year = { start_date: "2027-06-07", end_date: "2028-03-31" };

  it("passes terms that follow each other inside the year", () => {
    expect(termProblems([
      { name: "First Term", start_date: "2027-06-07", end_date: "2027-09-30" },
      { name: "Second Term", start_date: "2027-10-01", end_date: "2028-03-31" },
    ], year)).toEqual([]);
  });

  it("names each problem, on its own field", () => {
    const problems = termProblems([
      { name: "First Term", start_date: "2027-06-01", end_date: "2027-06-10" },
      { name: "first term", start_date: "2027-06-05", end_date: "2028-04-30" },
    ], year);
    expect(problems).toEqual(expect.arrayContaining([
      { index: 0, field: "end_date", message: "First Term is too short: make it at least 2 months (60 days)." },
      { index: 0, field: "start_date", message: "First Term starts before the school year (Jun 7, 2027)." },
      { index: 1, field: "name", message: "Another part is already called first term." },
      { index: 1, field: "end_date", message: "first term ends after the school year (Mar 31, 2028)." },
      { index: 1, field: "start_date", message: "first term must start after First Term ends (Jun 10, 2027)." },
    ]));
  });
});
