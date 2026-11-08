import { describe, expect, it } from "vitest";
import type { ManagedBuilding, ManagedTeacher } from "@/types/api";
import { filterBuildings, RoomSchema, toRoomForm, toRoomInput } from "./buildings";
import {
  filterTeachers,
  isOverLimit,
  TeacherFormSchema,
  toTeacherForm,
  toTeacherInput,
} from "./teachers";

const room = (id: number, room_number: string, room_name: string | null = null) => ({
  id,
  room_number,
  room_name,
  capacity: 40,
  is_active: true,
  cannot_delete_reason: null,
});

const BUILDINGS: ManagedBuilding[] = [
  { id: 1, name: "Main", rooms: [room(1, "101"), room(2, "102", "Science Lab")] },
  { id: 2, name: "Annex", rooms: [room(3, "201")] },
];

describe("filterBuildings", () => {
  it("shows everything with no search", () => {
    expect(filterBuildings(BUILDINGS, "  ")).toEqual(BUILDINGS);
  });

  it("shows all rooms of a matching building", () => {
    expect(filterBuildings(BUILDINGS, "main")[0].rooms).toHaveLength(2);
  });

  it("narrows to matching rooms and drops empty buildings", () => {
    const found = filterBuildings(BUILDINGS, "science");

    expect(found).toHaveLength(1);
    expect(found[0].rooms.map(({ id }) => id)).toEqual([2]);
  });
});

describe("room form", () => {
  it("starts a new room as in use", () => {
    expect(toRoomForm(null)).toEqual({ room_number: "", room_name: "", capacity: "", is_active: true });
  });

  it("sends blank fields as nothing, and keeps a capacity of zero", () => {
    expect(toRoomInput({ room_number: "101", room_name: "", capacity: "", is_active: true })).toEqual({
      room_number: "101",
      room_name: null,
      capacity: null,
      is_active: true,
    });
    expect(toRoomInput({ room_number: "101", room_name: "", capacity: "0", is_active: true }).capacity).toBe(0);
  });

  it("needs a number and takes digits for the capacity", () => {
    expect(RoomSchema.safeParse({ ...toRoomForm(null) }).success).toBe(false);
    expect(RoomSchema.safeParse({ ...toRoomForm(null), room_number: "1", capacity: "abc" }).success).toBe(false);
    expect(RoomSchema.safeParse({ ...toRoomForm(null), room_number: "1" }).success).toBe(true);
  });
});

const teacher = (overrides: Partial<ManagedTeacher> = {}): ManagedTeacher => ({
  id: 1,
  personnel_type: "teaching",
  first_name: "Ana",
  middle_name: null,
  last_name: "Reyes",
  suffix: null,
  display_name: null,
  printed_name: "Ana Reyes",
  department_id: 3,
  department: "Math",
  designation_id: null,
  designation: null,
  shift: "AM",
  max_subjects: 5,
  max_hours_per_week: 30,
  is_active: true,
  account_email: null,
  advisory: null,
  assigned: 0,
  task_ids: [7],
  qualifications: [
    { degree_level: "Bachelor", degree: "BSEd", major: null, school: null, year_completed: 2015 },
  ],
  cannot_delete_reason: null,
  ...overrides,
});

describe("teacher form", () => {
  it("starts a new record as active, whole day, with the default limit", () => {
    expect(toTeacherForm(null)).toMatchObject({
      personnel_type: "teaching",
      shift: "WHOLE_DAY",
      max_subjects: "5",
      max_hours_per_week: "30",
      is_active: true,
      qualifications: [],
    });
  });

  it("goes to the form and back without changing anything", () => {
    const original = teacher();
    const input = toTeacherInput(toTeacherForm(teacher()));

    expect(input).toEqual({
      personnel_type: original.personnel_type,
      first_name: original.first_name,
      middle_name: null,
      last_name: original.last_name,
      suffix: null,
      display_name: null,
      department_id: 3,
      designation_id: null,
      shift: "AM",
      max_subjects: 5,
      max_hours_per_week: 30,
      is_active: true,
      qualifications: original.qualifications,
      task_ids: [7],
    });
  });

  it("accepts a limit from 0 to 8 only", () => {
    const form = toTeacherForm(teacher());

    expect(TeacherFormSchema.safeParse({ ...form, max_subjects: "0" }).success).toBe(true);
    expect(TeacherFormSchema.safeParse({ ...form, max_subjects: "9" }).success).toBe(false);
  });

  it("accepts 1 to 60 hours a week only", () => {
    const form = toTeacherForm(teacher());

    expect(TeacherFormSchema.safeParse({ ...form, max_hours_per_week: "1" }).success).toBe(true);
    expect(TeacherFormSchema.safeParse({ ...form, max_hours_per_week: "60" }).success).toBe(true);
    expect(TeacherFormSchema.safeParse({ ...form, max_hours_per_week: "0" }).success).toBe(false);
    expect(TeacherFormSchema.safeParse({ ...form, max_hours_per_week: "61" }).success).toBe(false);
  });

  it("needs a degree and a real year in a qualification", () => {
    const form = toTeacherForm(teacher());
    const withQualification = (change: object) => ({
      ...form,
      qualifications: [{ ...form.qualifications[0], ...change }],
    });

    expect(TeacherFormSchema.safeParse(withQualification({ degree: "" })).success).toBe(false);
    expect(TeacherFormSchema.safeParse(withQualification({ year_completed: "15" })).success).toBe(false);
    expect(TeacherFormSchema.safeParse(withQualification({ year_completed: "" })).success).toBe(true);
  });
});

describe("filterTeachers", () => {
  const list = [
    teacher(),
    teacher({ id: 2, first_name: "Ben", last_name: "Cruz", printed_name: "Ben Cruz", department: null, personnel_type: "non_teaching" }),
    teacher({ id: 3, first_name: "Cris", last_name: "Lim", printed_name: "Cris Lim", department: null, is_active: false }),
  ];
  const ids = (found: ManagedTeacher[]) => found.map(({ id }) => id);

  it("searches names and departments", () => {
    expect(ids(filterTeachers(list, "cruz", "", ""))).toEqual([2]);
    expect(ids(filterTeachers(list, "MATH", "", ""))).toEqual([1]);
  });

  it("filters by type and status", () => {
    expect(ids(filterTeachers(list, "", "non_teaching", ""))).toEqual([2]);
    expect(ids(filterTeachers(list, "", "", "inactive"))).toEqual([3]);
    expect(ids(filterTeachers(list, "", "teaching", "active"))).toEqual([1]);
  });
});

describe("isOverLimit", () => {
  it("is over only past the limit", () => {
    expect(isOverLimit({ assigned: 5, max_subjects: 5 })).toBe(false);
    expect(isOverLimit({ assigned: 6, max_subjects: 5 })).toBe(true);
  });
});
