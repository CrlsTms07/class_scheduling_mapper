import type { MapRoom, ScheduleMap, SectionSummary } from "@/types/api";

export const NO_ROOM_TAB = "no-room";
export const ALL_SECTIONS_TAB = "all-sections";

/** The sections of one grade, in the order they came. */
export function sectionsByGrade(sections: SectionSummary[]): { grade: number; sections: SectionSummary[] }[] {
  const grades = [...new Set(sections.map(({ grade }) => grade))];

  return grades.map((grade) => ({ grade, sections: sections.filter((section) => section.grade === grade) }));
}

export type MapTab = { key: string; label: string };

/** One tab per building, plus one for sections that have no room yet. */
export function mapTabs(map: ScheduleMap): MapTab[] {
  return [
    ...map.buildings.map(({ id, name }) => ({ key: String(id), label: name })),
    ...(map.unassigned.length > 0 ? [{ key: NO_ROOM_TAB, label: "No room yet" }] : []),
  ];
}

/** Opens on the first building that has sections, so the page never starts out looking empty. */
export function firstTab(map: ScheduleMap): string | undefined {
  const withSections = map.buildings.find(({ rooms }) =>
    rooms.some(({ sections }) => sections.length > 0),
  );

  return withSections ? String(withSections.id) : mapTabs(map)[0]?.key;
}

const sectionText = ({ grade, name, adviser }: SectionSummary) =>
  `grade ${grade} ${name} ${adviser ?? ""}`.toLowerCase();

/** Rooms matching the search, across all buildings. A room that matches keeps all its sections. */
export function searchRooms(
  map: ScheduleMap,
  search: string,
): (MapRoom & { building: string })[] {
  const words = search.trim().toLowerCase();

  return map.buildings.flatMap(({ name: building, rooms }) =>
    rooms.flatMap((room) => {
      const roomMatches = `${building} ${room.room_number} ${room.room_name ?? ""} ${room.in_charge ?? ""}`
        .toLowerCase()
        .includes(words);
      const sections = room.sections.filter((section) => sectionText(section).includes(words));

      if (!roomMatches && sections.length === 0) return [];

      return [{ ...room, building, sections: roomMatches ? room.sections : sections }];
    }),
  );
}

export function searchSections(sections: SectionSummary[], search: string): SectionSummary[] {
  const words = search.trim().toLowerCase();

  return sections.filter((section) => sectionText(section).includes(words));
}
