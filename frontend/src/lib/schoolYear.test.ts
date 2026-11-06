import { describe, expect, it } from "vitest";
import type { SchoolYear } from "@/types/api";
import { buildTerms, formatDate, SchoolYearSchema, suggestNextYear, termName } from "./schoolYear";

const validYear = {
  name: "2027-2028",
  start_date: "2027-06-01",
  end_date: "2028-03-31",
  term_label: "Semester",
  terms: [
    { name: "First Semester", start_date: "2027-06-01", end_date: "2027-10-31" },
    { name: "Second Semester", start_date: "2027-11-01", end_date: "2028-03-31" },
  ],
};

/** The form fields with a problem. */
function problemsIn(year: typeof validYear): string[] {
  const result = SchoolYearSchema.safeParse(year);
  return result.success ? [] : result.error.issues.map(({ path }) => path.join("."));
}

describe("buildTerms", () => {
  it("covers the whole year, with no gap and no overlap", () => {
    const terms = buildTerms(3, "Term", "2027-06-01", "2028-03-31");

    expect(terms).toHaveLength(3);
    expect(terms[0].start_date).toBe("2027-06-01");
    expect(terms[2].end_date).toBe("2028-03-31");

    const dayAfter = (date: string) =>
      new Date(Date.parse(date) + 86_400_000).toISOString().slice(0, 10);
    expect(terms[1].start_date).toBe(dayAfter(terms[0].end_date));
    expect(terms[2].start_date).toBe(dayAfter(terms[1].end_date));
  });

  it("names terms with the chosen label", () => {
    expect(buildTerms(2, "Semester", "2027-06-01", "2028-03-31").map(({ name }) => name)).toEqual([
      "First Semester",
      "Second Semester",
    ]);
  });

  it("leaves dates empty when the year has no dates yet", () => {
    expect(buildTerms(1, "Term", "", "")[0]).toEqual({
      name: "First Term",
      start_date: "",
      end_date: "",
    });
  });

  it("produces terms that pass validation for every preset", () => {
    for (const count of [1, 2, 3, 4]) {
      const terms = buildTerms(count, "Term", "2027-06-01", "2028-03-31");
      expect(problemsIn({ ...validYear, terms })).toEqual([]);
    }
  });
});

describe("termName", () => {
  it("counts up to the maximum of four terms", () => {
    expect(termName(3, "Quarter")).toBe("Fourth Quarter");
  });
});

describe("suggestNextYear", () => {
  const latest = {
    name: "2026-2027",
    start_date: "2026-06-01",
    end_date: "2028-02-29",
  } as SchoolYear;

  it("moves the latest year forward by one, keeping dates real", () => {
    expect(suggestNextYear(latest)).toEqual({
      name: "2027-2028",
      start_date: "2027-06-01",
      end_date: "2029-02-28",
    });
  });

  it("uses this year when there is no school year yet", () => {
    expect(suggestNextYear(undefined, new Date("2026-11-06"))).toEqual({
      name: "2026-2027",
      start_date: "",
      end_date: "",
    });
  });
});

describe("formatDate", () => {
  it("does not shift the day in any time zone", () => {
    expect(formatDate("2026-06-01")).toBe("Jun 1, 2026");
  });
});

describe("SchoolYearSchema", () => {
  it("accepts a valid year", () => {
    expect(problemsIn(validYear)).toEqual([]);
  });

  it.each([
    ["a wrong name", { name: "2027" }, "name"],
    ["a name not one year apart", { name: "2027-2029" }, "name"],
    ["a year ending before it starts", { end_date: "2027-01-01" }, "end_date"],
  ])("rejects %s", (_, change, field) => {
    expect(problemsIn({ ...validYear, ...change })).toContain(field);
  });

  it.each([
    ["starting before the year", { start_date: "2027-05-01" }, 0, "terms.0.start_date"],
    ["overlapping the previous term", { start_date: "2027-10-31" }, 1, "terms.1.start_date"],
    ["ending after the year", { end_date: "2028-04-30" }, 1, "terms.1.end_date"],
    ["ending before it starts", { end_date: "2027-05-31" }, 0, "terms.0.end_date"],
    ["with a repeated name", { name: "first semester" }, 1, "terms.1.name"],
  ])("rejects a term %s", (_, change, index, field) => {
    const terms = validYear.terms.map((term, position) =>
      position === index ? { ...term, ...change } : term,
    );
    expect(problemsIn({ ...validYear, terms })).toContain(field);
  });
});
