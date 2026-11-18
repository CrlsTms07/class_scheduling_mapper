// @ts-check
/**
 * The Schedule page: sections by grade, buildings and rooms, search, and the words of a copy.
 */

/**
 * @typedef {{ id: number, name: string, grade: number, level: "JHS" | "SHS", adviser: string | null, status: import("./schedule.js").ScheduleStatus }} SectionSummary
 * @typedef {{ id: number, room_number: string, room_name: string | null, in_charge?: string | null, is_active: boolean, sections: SectionSummary[] }} MapRoom
 * @typedef {{ buildings: { id: number, name: string, rooms: MapRoom[] }[], unassigned: SectionSummary[] }} ScheduleMap
 * @typedef {{ sections_copied: number, sections_with_schedule: string[], sections_with_nothing: number, entries: number, filled: number, open_slots: number, left_open: number, not_fitting: number, loading_copied: number }} CopyResult
 */

export const ALL_SECTIONS_TAB = "all-sections";
export const NO_ROOM_TAB = "no-room";

/**
 * The sections of each grade, in the order they came.
 * @param {SectionSummary[]} sections
 */
export function sectionsByGrade(sections) {
  const grades = [...new Set(sections.map(({ grade }) => grade))];
  return grades.map((grade) => ({ grade, sections: sections.filter((section) => section.grade === grade) }));
}

/**
 * "All sections", one tab per building, and "No room yet" when some sections have none.
 * @param {ScheduleMap} map
 * @param {boolean} hasSections
 */
export function mapTabs(map, hasSections) {
  return [
    ...(hasSections ? [{ key: ALL_SECTIONS_TAB, label: "All sections" }] : []),
    ...map.buildings.map(({ id, name }) => ({ key: String(id), label: name })),
    ...(map.unassigned.length > 0 ? [{ key: NO_ROOM_TAB, label: "No room yet" }] : []),
  ];
}

/** @param {SectionSummary} section */
const sectionText = ({ grade, name, adviser }) => `grade ${grade} ${name} ${adviser ?? ""}`.toLowerCase();

/**
 * Rooms matching the search, across buildings. A room that matches keeps all its sections.
 * @param {ScheduleMap} map
 * @param {string} search
 * @returns {(MapRoom & { building: string })[]}
 */
export function searchRooms(map, search) {
  const words = search.trim().toLowerCase();
  return map.buildings.flatMap(({ name: building, rooms }) =>
    rooms.flatMap((room) => {
      const roomMatches = `${building} ${room.room_number} ${room.room_name ?? ""} ${room.in_charge ?? ""}`.toLowerCase().includes(words);
      const sections = room.sections.filter((section) => sectionText(section).includes(words));
      if (!roomMatches && sections.length === 0) return [];
      return [{ ...room, building, sections: roomMatches ? room.sections : sections }];
    }),
  );
}

/**
 * @param {SectionSummary[]} sections
 * @param {string} search
 */
export function searchSections(sections, search) {
  const words = search.trim().toLowerCase();
  return sections.filter((section) => sectionText(section).includes(words));
}

/**
 * What can be copied at once: all, one grade, or one section.
 * @param {SectionSummary[]} sections
 */
export function copyScopes(sections) {
  const grades = [...new Set(sections.map(({ grade }) => grade))];
  return [
    { value: "all", label: "All my sections" },
    ...grades.map((grade) => ({ value: `grade:${grade}`, label: `All of Grade ${grade}` })),
    ...sections.map(({ id, grade, name }) => ({ value: `section:${id}`, label: `Grade ${grade} – ${name}` })),
  ];
}

/** @param {string} scope */
export function scopeToInput(scope) {
  const [kind, id] = scope.split(":");
  return { section_id: kind === "section" ? Number(id) : null, grade: kind === "grade" ? Number(id) : null };
}

/**
 * @param {number} count
 * @param {string} one
 * @param {string} [many]
 */
const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/**
 * A copy's result in words, for the review and for the finished copy.
 * @param {CopyResult} result
 */
export function copySummaryLines(result) {
  const lines = [];
  if (result.sections_copied > 0) lines.push(`${plural(result.sections_copied, "section")}, ${plural(result.entries, "period")}: ${result.filled} with subject and teacher, ${plural(result.open_slots, "open slot")} to fill.`);
  if (result.loading_copied > 0) lines.push(`${plural(result.loading_copied, "teacher assignment")} copied.`);
  if (result.left_open > 0) lines.push(`${plural(result.left_open, "period")} left open, because the teacher or room is already taken.`);
  if (result.not_fitting > 0) lines.push(`${plural(result.not_fitting, "period")} left out, because the bell schedule has changed.`);
  if (result.sections_with_schedule.length > 0) lines.push(`Skipped, because they already have a schedule: ${result.sections_with_schedule.join(", ")}.`);
  if (result.sections_with_nothing > 0) lines.push(`${plural(result.sections_with_nothing, "section")} had nothing to copy.`);
  return lines;
}
