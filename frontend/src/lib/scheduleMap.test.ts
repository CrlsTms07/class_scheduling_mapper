import { describe, expect, it } from "vitest";
import type { ScheduleMap, SectionSummary } from "@/types/api";
import { firstTab, mapTabs, NO_ROOM_TAB, searchRooms, searchSections } from "./scheduleMap";

const section = (id: number, name: string, grade = 7): SectionSummary => ({
  id,
  name,
  grade,
  level: "JHS",
  adviser: id === 1 ? "Ana Reyes" : null,
  status: "draft",
});

const room = (id: number, room_number: string, sections: SectionSummary[] = []) => ({
  id,
  room_number,
  room_name: null,
  is_active: true,
  sections,
});

const MAP: ScheduleMap = {
  buildings: [
    { id: 1, name: "Annex", rooms: [room(1, "201")] },
    { id: 2, name: "Main", rooms: [room(2, "101", [section(1, "Honesty")]), room(3, "102", [section(2, "Hope")])] },
  ],
  unassigned: [section(3, "Faith", 8)],
};

describe("mapTabs", () => {
  it("has one tab per building and one for sections with no room", () => {
    expect(mapTabs(MAP)).toEqual([
      { key: "1", label: "Annex" },
      { key: "2", label: "Main" },
      { key: NO_ROOM_TAB, label: "No room yet" },
    ]);
  });

  it("has no extra tab when every section has a room", () => {
    expect(mapTabs({ ...MAP, unassigned: [] })).toHaveLength(2);
  });
});

describe("firstTab", () => {
  it("opens on the first building with sections", () => {
    expect(firstTab(MAP)).toBe("2");
  });

  it("falls back to whatever exists", () => {
    expect(firstTab({ buildings: [{ id: 1, name: "Annex", rooms: [room(1, "201")] }], unassigned: [] })).toBe("1");
    expect(firstTab({ buildings: [], unassigned: [section(3, "Faith")] })).toBe(NO_ROOM_TAB);
    expect(firstTab({ buildings: [], unassigned: [] })).toBeUndefined();
  });
});

describe("searchRooms", () => {
  it("searches every building", () => {
    expect(searchRooms(MAP, "201").map(({ id }) => id)).toEqual([1]);
    expect(searchRooms(MAP, "hope").map(({ id }) => id)).toEqual([3]);
  });

  it("finds sections by grade and adviser", () => {
    expect(searchRooms(MAP, "reyes").map(({ id }) => id)).toEqual([2]);
  });

  it("keeps all sections when the room itself matches", () => {
    expect(searchRooms(MAP, "main").flatMap(({ sections }) => sections)).toHaveLength(2);
  });
});

describe("searchSections", () => {
  it("filters sections with no room", () => {
    expect(searchSections(MAP.unassigned, "faith")).toHaveLength(1);
    expect(searchSections(MAP.unassigned, "hope")).toHaveLength(0);
  });
});
