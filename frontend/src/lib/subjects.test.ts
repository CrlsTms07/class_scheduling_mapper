import { describe, expect, it } from "vitest";
import type { ManagedSubject } from "@/types/api";
import {
  filterSubjects,
  SubjectFormSchema,
  termLabel,
  toSubjectForm,
  toSubjectInput,
} from "./subjects";

const subject = (overrides: Partial<ManagedSubject> = {}): ManagedSubject => ({
  id: 1,
  grade_level_id: 1,
  grade: 7,
  level: "JHS",
  track_id: null,
  track: null,
  term_no: null,
  code: "MATH7",
  name: "Mathematics 7",
  subject_type: "core",
  minutes_per_week: 225,
  is_priority: false,
  is_active: true,
  locked_reason: null,
  ...overrides,
});

describe("subject form", () => {
  it("starts a new subject as core, offered, for the whole year", () => {
    expect(toSubjectForm(null)).toMatchObject({
      subject_type: "core",
      term_no: "",
      is_active: true,
      is_priority: false,
    });
  });

  it("goes to the form and back without changing anything", () => {
    const original = subject({ term_no: 2 });
    const input = toSubjectInput(toSubjectForm(original), false);

    expect(input).toEqual({
      grade_level_id: 1,
      track_id: null,
      term_no: 2,
      code: "MATH7",
      name: "Mathematics 7",
      subject_type: "core",
      minutes_per_week: 225,
      is_priority: false,
      is_active: true,
    });
  });

  it("keeps a track for Senior High only", () => {
    const form = toSubjectForm(subject({ track_id: 5 }));

    expect(toSubjectInput(form, true).track_id).toBe(5);
    expect(toSubjectInput(form, false).track_id).toBeNull();
  });

  it("needs a grade, a name and real minutes", () => {
    const valid = toSubjectForm(subject());

    expect(SubjectFormSchema.safeParse(valid).success).toBe(true);
    expect(SubjectFormSchema.safeParse({ ...valid, grade_level_id: "" }).success).toBe(false);
    expect(SubjectFormSchema.safeParse({ ...valid, name: " " }).success).toBe(false);
    expect(SubjectFormSchema.safeParse({ ...valid, minutes_per_week: "0" }).success).toBe(false);
    expect(SubjectFormSchema.safeParse({ ...valid, minutes_per_week: "abc" }).success).toBe(false);
  });
});

describe("termLabel", () => {
  const terms = [{ term_no: 1, name: "First Semester" }];

  it("reads the name from the school year", () => {
    expect(termLabel(1, terms)).toBe("First Semester");
  });

  it("says whole year when there is no term", () => {
    expect(termLabel(null, terms)).toBe("Whole year");
  });
});

describe("filterSubjects", () => {
  const list = [
    subject(),
    subject({ id: 2, name: "Science 8", code: null, grade: 8, term_no: 2 }),
    subject({ id: 3, name: "Robotics", code: null, grade: 11, level: "SHS", track: "TechPro", term_no: 1 }),
  ];
  const ids = (found: ManagedSubject[]) => found.map(({ id }) => id);

  it("searches names, codes and tracks", () => {
    expect(ids(filterSubjects(list, "science", "", ""))).toEqual([2]);
    expect(ids(filterSubjects(list, "math7", "", ""))).toEqual([1]);
    expect(ids(filterSubjects(list, "techpro", "", ""))).toEqual([3]);
  });

  it("filters by grade and term, including whole-year subjects", () => {
    expect(ids(filterSubjects(list, "", "8", ""))).toEqual([2]);
    expect(ids(filterSubjects(list, "", "", "1"))).toEqual([3]);
    expect(ids(filterSubjects(list, "", "", "whole"))).toEqual([1]);
  });
});
