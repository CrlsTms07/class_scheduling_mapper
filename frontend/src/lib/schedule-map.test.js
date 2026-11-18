// @ts-check
import { describe, expect, it } from "vitest";
import { copyScopes, copySummaryLines, mapTabs, scopeToInput, searchRooms, searchSections, sectionsByGrade } from "./schedule-map.js";
import { shiftWarning } from "@/api/teacher-loading.js";

const section = (id, grade, name, adviser = null) => ({ id, grade, name, adviser, level: /** @type {const} */ ("JHS"), status: /** @type {const} */ ("draft") });
const A = section(1, 7, "Honesty", "Ana Reyes");
const B = section(2, 7, "Hope");
const C = section(3, 8, "Faith", "Ben Cruz");
const MAP = {
  buildings: [{ id: 9, name: "Main", rooms: [{ id: 101, room_number: "101", room_name: "Lab", is_active: true, sections: [A] }, { id: 102, room_number: "102", room_name: null, is_active: true, sections: [] }] }],
  unassigned: [B],
};

describe("Schedule page", () => {
  it("groups sections by grade", () => {
    expect(sectionsByGrade([A, B, C]).map(({ grade, sections }) => [grade, sections.length])).toEqual([[7, 2], [8, 1]]);
  });

  it("has All sections, a tab per building, and No room yet", () => {
    expect(mapTabs(MAP, true).map(({ label }) => label)).toEqual(["All sections", "Main", "No room yet"]);
    expect(mapTabs({ ...MAP, unassigned: [] }, false).map(({ label }) => label)).toEqual(["Main"]);
  });

  it("finds rooms by number or by a section in them, and sections by adviser", () => {
    expect(searchRooms(MAP, "lab").map(({ id }) => id)).toEqual([101]);
    expect(searchRooms(MAP, "honesty")[0].sections).toEqual([A]);
    expect(searchSections([A, B, C], "ben")).toEqual([C]);
  });
});

describe("copying another term's schedule", () => {
  it("offers all, each grade and each section", () => {
    expect(copyScopes([A, C]).map(({ value }) => value)).toEqual(["all", "grade:7", "grade:8", "section:1", "section:3"]);
    expect(scopeToInput("grade:8")).toEqual({ section_id: null, grade: 8 });
    expect(scopeToInput("section:3")).toEqual({ section_id: 3, grade: null });
    expect(scopeToInput("all")).toEqual({ section_id: null, grade: null });
  });

  it("says what a copy does, in plain words", () => {
    const lines = copySummaryLines({ sections_copied: 2, entries: 80, filled: 70, open_slots: 10, loading_copied: 22, left_open: 1, not_fitting: 0, sections_with_schedule: ["Grade 7 – Hope"], sections_with_nothing: 0 });
    expect(lines).toEqual([
      "2 sections, 80 periods: 70 with subject and teacher, 10 open slots to fill.",
      "22 teacher assignments copied.",
      "1 period left open, because the teacher or room is already taken.",
      "Skipped, because they already have a schedule: Grade 7 – Hope.",
    ]);
  });
});

describe("teacher loading", () => {
  it("warns when the teacher's shift does not match the section's", () => {
    expect(shiftWarning("AM", "PM")).toBe("This teacher's shift is Morning (AM), but this section's is Afternoon (PM).");
    expect(shiftWarning("WHOLE_DAY", "PM")).toBeNull();
    expect(shiftWarning("AM", "AM")).toBeNull();
  });
});
