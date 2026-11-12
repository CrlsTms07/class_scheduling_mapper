import { describe, expect, it } from "vitest";
import type { ManagedSection } from "@/types/api";
import {
  filterSections,
  homeRoomSharedWith,
  missingAdviserCount,
  SectionFormSchema,
  toSectionForm,
  toSectionInput,
} from "./sections";

const section = (overrides: Partial<ManagedSection> = {}): ManagedSection => ({
  id: 1,
  name: "Honesty",
  label: "Grade 7 – Honesty",
  grade_level_id: 1,
  grade: 7,
  level: "JHS",
  shift: "WHOLE_DAY",
  track_id: null,
  track: null,
  adviser_id: 3,
  adviser: "Ana Reyes",
  co_adviser_id: null,
  co_adviser: null,
  home_room_id: 4,
  home_room: "Main – 101",
  class_size: 40,
  locked_reason: null,
  ...overrides,
});

describe("toSectionInput", () => {
  const form = {
    grade_level_id: "1",
    name: "Honesty",
    shift: "AM" as const,
    track_id: "2",
    adviser_id: "",
    co_adviser_id: "",
    home_room_id: "4",
    class_size: "",
  };

  it("turns ids into numbers and empty fields into nothing", () => {
    expect(toSectionInput(form, false)).toEqual({
      grade_level_id: 1,
      name: "Honesty",
      shift: "AM",
      track_id: null,
      home_room_id: 4,
      adviser_id: null,
      co_adviser_id: null,
      class_size: null,
    });
  });

  it("keeps the track and the usual room for Senior High", () => {
    expect(toSectionInput(form, true)).toMatchObject({ track_id: 2, home_room_id: 4 });
  });

  it("keeps a class size of zero", () => {
    expect(toSectionInput({ ...form, class_size: "0" }, false).class_size).toBe(0);
  });
});

describe("toSectionForm", () => {
  it("starts a new section empty, on the whole day shift", () => {
    expect(toSectionForm(null)).toMatchObject({ grade_level_id: "", name: "", shift: "WHOLE_DAY" });
  });

  it("fills in an existing section", () => {
    expect(toSectionForm(section())).toMatchObject({
      grade_level_id: "1",
      adviser_id: "3",
      co_adviser_id: "",
      class_size: "40",
      track_id: "",
    });
  });
});

describe("filterSections", () => {
  const sections = [
    section(),
    section({ id: 2, name: "Hope", label: "Grade 8 – Hope", grade: 8, adviser: null, adviser_id: null, home_room: null }),
  ];

  it("finds by name, adviser or room", () => {
    expect(filterSections(sections, "hope", "")).toHaveLength(1);
    expect(filterSections(sections, "REYES", "")).toHaveLength(1);
    expect(filterSections(sections, "main", "")).toHaveLength(1);
  });

  it("filters by grade", () => {
    expect(filterSections(sections, "", "8")[0].id).toBe(2);
  });

  it("shows everything with no filter", () => {
    expect(filterSections(sections, "  ", "")).toHaveLength(2);
  });
});

describe("homeRoomSharedWith", () => {
  const whole = section();
  const morning = section({ id: 2, label: "Grade 8 – Hope", shift: "AM" });

  it("finds a section in the same room at the same time", () => {
    expect(homeRoomSharedWith([whole], 4, "WHOLE_DAY", undefined)).toEqual(["Grade 7 – Honesty"]);
    expect(homeRoomSharedWith([morning], 4, "AM", undefined)).toEqual(["Grade 8 – Hope"]);
  });

  it("treats whole day as overlapping both AM and PM", () => {
    expect(homeRoomSharedWith([whole], 4, "AM", undefined)).toHaveLength(1);
    expect(homeRoomSharedWith([morning], 4, "WHOLE_DAY", undefined)).toHaveLength(1);
  });

  it("lets AM and PM share a room", () => {
    expect(homeRoomSharedWith([morning], 4, "PM", undefined)).toEqual([]);
  });

  it("ignores the section itself, other rooms and an empty room", () => {
    expect(homeRoomSharedWith([whole], 4, "WHOLE_DAY", whole.id)).toEqual([]);
    expect(homeRoomSharedWith([whole], 9, "WHOLE_DAY", undefined)).toEqual([]);
    expect(homeRoomSharedWith([whole], null, "WHOLE_DAY", undefined)).toEqual([]);
  });
});

describe("missingAdviserCount", () => {
  it("counts sections with no adviser", () => {
    expect(missingAdviserCount([section(), section({ adviser_id: null })])).toBe(1);
  });
});

describe("SectionFormSchema", () => {
  const valid = toSectionForm(section());

  it("accepts a valid form", () => {
    expect(SectionFormSchema.safeParse(valid).success).toBe(true);
  });

  it("needs a grade and a name", () => {
    expect(SectionFormSchema.safeParse({ ...valid, grade_level_id: "" }).success).toBe(false);
    expect(SectionFormSchema.safeParse({ ...valid, name: "  " }).success).toBe(false);
  });

  it("only takes digits for the class size", () => {
    expect(SectionFormSchema.safeParse({ ...valid, class_size: "abc" }).success).toBe(false);
    expect(SectionFormSchema.safeParse({ ...valid, class_size: "" }).success).toBe(true);
  });
});
