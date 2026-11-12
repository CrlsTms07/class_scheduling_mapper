import { describe, expect, it } from "vitest";
import type { CopyScheduleResult, SectionSummary } from "@/types/api";
import { copyScopes, copySummaryLines, scopeToInput } from "./scheduleCopy";

const RESULT: CopyScheduleResult = {
  sections_copied: 0,
  sections_with_schedule: [],
  sections_with_nothing: 0,
  entries: 0,
  filled: 0,
  open_slots: 0,
  left_open: 0,
  not_fitting: 0,
  loading_copied: 0,
};

const section = (id: number, grade: number, name: string) => ({ id, grade, name }) as SectionSummary;

describe("copyScopes", () => {
  it("offers everything, each grade once, then each section", () => {
    expect(copyScopes([section(1, 7, "Honesty"), section(2, 7, "Hope"), section(3, 8, "Faith")])).toEqual([
      { value: "all", label: "All my sections" },
      { value: "grade:7", label: "All of Grade 7" },
      { value: "grade:8", label: "All of Grade 8" },
      { value: "section:1", label: "Grade 7 – Honesty" },
      { value: "section:2", label: "Grade 7 – Hope" },
      { value: "section:3", label: "Grade 8 – Faith" },
    ]);
  });
});

describe("scopeToInput", () => {
  it.each([
    ["all", { section_id: null, grade: null }],
    ["grade:7", { section_id: null, grade: 7 }],
    ["section:12", { section_id: 12, grade: null }],
  ])("reads %s", (scope, input) => {
    expect(scopeToInput(scope)).toEqual(input);
  });
});

describe("copySummaryLines", () => {
  it("has nothing to say about nothing", () => {
    expect(copySummaryLines(RESULT)).toEqual([]);
  });

  it("describes what is copied", () => {
    expect(
      copySummaryLines({ ...RESULT, sections_copied: 2, entries: 10, filled: 7, open_slots: 3, loading_copied: 1 }),
    ).toEqual([
      "2 sections, 10 periods: 7 with subject and teacher, 3 open slots to fill.",
      "1 teacher assignment copied.",
    ]);
  });

  it("explains everything left behind", () => {
    const lines = copySummaryLines({
      ...RESULT,
      left_open: 1,
      not_fitting: 2,
      sections_with_schedule: ["Grade 7 – Hope"],
      sections_with_nothing: 1,
    });

    expect(lines).toEqual([
      "1 period left open, because the teacher or room is already taken.",
      "2 periods left out, because the bell schedule has changed.",
      "Skipped, because they already have a schedule: Grade 7 – Hope.",
      "1 section had nothing to copy.",
    ]);
  });
});
