import { describe, expect, it } from "vitest";
import type { LoadingRow, LoadingTeacher } from "@/types/api";
import {
  copyResultLines,
  isOverLoad,
  loadedCount,
  QuickAddSchema,
  shiftWarning,
  teacherOptionLabel,
  teachersForRow,
} from "./teacherLoading";

const teacher: LoadingTeacher = { id: 1, name: "Ana Reyes", shift: "WHOLE_DAY", assigned: 3, limit: 5 };

describe("copyResultLines", () => {
  it("only mentions what happened", () => {
    expect(copyResultLines({ copied: 1, already_set: 0, not_offered: 0, teacher_unavailable: 0 })).toEqual([
      "1 subject was copied.",
    ]);
  });

  it("explains everything left out", () => {
    const lines = copyResultLines({ copied: 2, already_set: 1, not_offered: 2, teacher_unavailable: 1 });

    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe("2 subjects were copied.");
    expect(lines[1]).toMatch(/already had a teacher/);
    expect(lines[2]).toMatch(/2 are not taken/);
    expect(lines[3]).toMatch(/no longer active/);
  });
});

describe("loadedCount", () => {
  it("counts subjects with a teacher", () => {
    expect(loadedCount([{ teacher_id: 1 }, { teacher_id: null }] as LoadingRow[])).toBe(1);
  });
});

describe("isOverLoad", () => {
  it("is over only past the limit", () => {
    expect(isOverLoad({ assigned: 5, limit: 5 })).toBe(false);
    expect(isOverLoad({ assigned: 6, limit: 5 })).toBe(true);
  });
});

describe("teacherOptionLabel", () => {
  it("shows the load", () => {
    expect(teacherOptionLabel(teacher)).toBe("Ana Reyes (3 of 5)");
  });
});

describe("shiftWarning", () => {
  it("is quiet when the shifts fit", () => {
    expect(shiftWarning("WHOLE_DAY", "AM")).toBeNull();
    expect(shiftWarning("AM", "AM")).toBeNull();
  });

  it("warns when they do not", () => {
    expect(shiftWarning("AM", "PM")).toMatch(/Morning \(AM\).*Afternoon \(PM\)/);
    expect(shiftWarning("AM", "WHOLE_DAY")).toMatch(/Whole day/);
  });
});

describe("teachersForRow", () => {
  it("offers the list as it is", () => {
    expect(teachersForRow([teacher], { teacher_id: 1, teacher: "Ana Reyes" })).toEqual([teacher]);
    expect(teachersForRow([teacher], { teacher_id: null, teacher: null })).toEqual([teacher]);
  });

  it("keeps a current teacher who has since become inactive", () => {
    const found = teachersForRow([teacher], { teacher_id: 9, teacher: "Gone Away" });

    expect(found.map(({ id }) => id)).toEqual([9, 1]);
    expect(found[0].name).toBe("Gone Away");
  });
});

describe("QuickAddSchema", () => {
  it("needs both names", () => {
    expect(QuickAddSchema.safeParse({ first_name: "A", last_name: " " }).success).toBe(false);
    expect(QuickAddSchema.safeParse({ first_name: "A", last_name: "B" }).success).toBe(true);
  });
});
