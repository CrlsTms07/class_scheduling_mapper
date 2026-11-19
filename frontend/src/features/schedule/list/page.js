// @ts-check
/**
 * The Schedule page: every section of the term, by grade or by building and room. One main
 * button, "New schedule", where every way to start lives (building, copying or importing).
 */
import { h, replace } from "@/lib/dom.js";
import { icon } from "@/components/icons.js";
import { skeletonList } from "@/components/loading.js";
import { emptyState, noMatches, pageHeader } from "@/components/page-header.js";
import { errorMessage } from "@/api/client.js";
import { getScheduleMap, getSections } from "@/api/schedule.js";
import { watch } from "@/state/cache.js";
import { termState } from "@/state/term.js";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/schedule.js";
import { ALL_SECTIONS_TAB, NO_ROOM_TAB, mapTabs, searchRooms, searchSections, sectionsByGrade } from "@/lib/schedule-map.js";
import { openNewScheduleDialog, openRoomSectionDialog } from "./start-dialogs.js";

/** @typedef {import("@/lib/schedule-map.js").SectionSummary} SectionSummary */
/** @typedef {import("@/lib/schedule-map.js").MapRoom} MapRoom */

/** @type {import("@/router.js").RenderPage} */
export async function render(container, { navigate }) {
  const term = termState.term;
  if (!term) {
    container.append(h("div", { class: "p-4 sm:p-6" }, emptyState({ title: "No school year yet", text: "The Admin starts a school year on the School Years page." })));
    return;
  }
  const otherTerms = termState.terms.filter((other) => other.school_year.id === term.school_year.id && other.id !== term.id);
  const ui = { tab: /** @type {string | null} */ (null), grade: /** @type {number | null} */ (null), search: "" };

  const content = h("div", { class: "space-y-4" }, skeletonList(4));
  const searchInput = /** @type {HTMLInputElement} */ (
    h("input", { type: "search", class: "input pl-10", placeholder: "Search rooms, sections or advisers", "aria-label": "Search rooms and sections", oninput: () => { ui.search = searchInput.value; draw(); } })
  );

  /** @type {SectionSummary[]} */
  let sections = [];
  /** @type {import("@/lib/schedule-map.js").ScheduleMap | null} */
  let map = null;

  replace(
    container,
    h(
      "div",
      { class: "space-y-5 p-4 sm:p-6" },
      pageHeader({
        icon: "table",
        title: "Schedule",
        description: `Build the weekly timetable of each section: subjects, teachers, rooms and times. ${term.name}, SY ${term.school_year.name}.`,
        crumbs: [{ label: "Home", to: "/dashboard" }, { label: "Schedule" }],
        actions: [
          h("a", { href: "/guide", class: "btn btn-outline" }, icon("book"), "How to make a schedule"),
          h("button", { type: "button", class: "btn btn-primary", onclick: () => openNewScheduleDialog({ term, otherTerms, sections, navigate }) }, icon("calendar-plus"), "New schedule"),
        ],
      }),
      h(
        "div",
        { class: "card flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between" },
        h("div", { class: "relative sm:w-96" }, h("span", { class: "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" }, icon("search")), searchInput),
        h("a", { href: "/sections", class: "btn btn-outline" }, icon("plus"), "Add section"),
      ),
      content,
    ),
  );

  /** @param {SectionSummary} section */
  const sectionLink = (section) =>
    h(
      "a",
      { href: `/schedule/sections/${section.id}`, class: "flex min-h-14 items-center justify-between gap-2 rounded-lg border bg-surface px-3 py-2 hover:border-brand hover:bg-brand-soft" },
      h("span", { class: "min-w-0" }, h("span", { class: "block text-sm font-medium" }, `Grade ${section.grade} – ${section.name}`), h("span", { class: "block text-small text-muted-foreground" }, `Adviser: ${section.adviser ?? "None yet"}`)),
      h("span", { class: "flex shrink-0 items-center gap-2" }, h("span", { class: `badge ${STATUS_COLORS[section.status]}` }, STATUS_LABELS[section.status]), h("span", { class: "text-small font-medium text-brand" }, "Open")),
    );

  /**
   * @param {MapRoom} room
   * @param {string} [building]
   */
  const roomCard = (room, building) =>
    h(
      "article",
      { class: "card flex flex-col gap-3 p-4" },
      h(
        "div",
        { class: "flex items-start justify-between gap-3" },
        h(
          "div",
          { class: "min-w-0" },
          h("a", { href: `/schedule/rooms/${room.id}`, class: "inline-flex min-h-11 items-center font-semibold text-brand underline-offset-2 hover:underline" }, `Room ${room.room_number}`, room.room_name ? h("span", { class: "ml-1 font-normal text-muted-foreground" }, `– ${room.room_name}`) : null),
          building ? h("p", { class: "text-small text-muted-foreground" }, building) : null,
          room.in_charge ? h("p", { class: "text-small text-muted-foreground" }, `In charge: ${room.in_charge}`) : null,
          !room.is_active ? h("span", { class: "badge bg-surface-muted text-muted-foreground" }, "Not in use") : null,
        ),
        h("button", { type: "button", class: "btn btn-outline shrink-0", onclick: () => openRoomSectionDialog({ term, roomId: room.id, roomLabel: `Room ${room.room_number}` }) }, icon("plus"), "Add section"),
      ),
      h("p", { class: "text-sm text-muted-foreground" }, "Sections in this room:"),
      room.sections.length === 0
        ? h("p", { class: "text-sm text-muted-foreground" }, "None yet.")
        : h("div", { class: "flex flex-wrap gap-2" }, room.sections.map((section) => h("a", { href: `/schedule/sections/${section.id}`, class: "inline-flex min-h-11 items-center gap-1 rounded-lg bg-surface-muted px-3 text-sm font-medium hover:bg-brand-soft hover:text-brand" }, `Grade ${section.grade} – ${section.name}`))),
    );

  const draw = () => {
    if (!map) return;
    const tabs = mapTabs(map, sections.length > 0);

    if (tabs.length === 0) {
      replace(content, emptyState({ title: "No sections yet", text: "A schedule is made for each section. Add the sections of your grade levels first, then come back here.", action: h("a", { href: "/sections", class: "btn btn-primary" }, icon("plus"), "Add a section") }));
      return;
    }

    if (ui.search.trim()) {
      const rooms = searchRooms(map, ui.search);
      const noRoom = searchSections(map.unassigned, ui.search);
      const found = searchSections(sections, ui.search);
      replace(
        content,
        rooms.length === 0 && found.length === 0
          ? noMatches({
              noun: "room or section",
              search: ui.search,
              onClear: () => {
                ui.search = "";
                searchInput.value = "";
                draw();
              },
            })
          : h(
              "div",
              { class: "space-y-5" },
              found.length ? h("section", { class: "space-y-2" }, h("h2", { class: "font-semibold text-accent" }, "Sections"), h("div", { class: "grid gap-2 lg:grid-cols-2" }, found.map(sectionLink))) : null,
              rooms.length ? h("section", { class: "space-y-2" }, h("h2", { class: "font-semibold text-accent" }, "Rooms"), h("div", { class: "grid gap-4 sm:grid-cols-2 xl:grid-cols-3" }, rooms.map((room) => roomCard(room, room.building)))) : null,
              noRoom.length && !found.length ? h("section", { class: "space-y-2" }, h("h2", { class: "font-semibold text-accent" }, "No room yet"), noRoom.map(sectionLink)) : null,
            ),
      );
      return;
    }

    const tab = tabs.some(({ key }) => key === ui.tab) ? ui.tab : tabs[0].key;
    const building = map.buildings.find(({ id }) => String(id) === tab);
    const grades = [...new Set(sections.map(({ grade }) => grade))];
    const groups = sectionsByGrade(sections).filter((group) => ui.grade === null || group.grade === ui.grade);

    replace(
      content,
      h(
        "div",
        { role: "tablist", "aria-label": "Show", class: "flex gap-1 overflow-x-auto rounded-xl bg-surface-muted p-1 sm:w-fit" },
        tabs.map(({ key, label }) => h("button", { type: "button", role: "tab", "aria-selected": String(key === tab), class: `btn shrink-0 ${key === tab ? "bg-surface shadow-sm" : "text-muted-foreground"}`, onclick: () => { ui.tab = key; draw(); } }, label)),
      ),
      tab === ALL_SECTIONS_TAB
        ? h(
            "div",
            { class: "space-y-4" },
            grades.length > 1 ? h("div", { role: "group", "aria-label": "Grade level", class: "flex flex-wrap gap-2" }, [null, ...grades].map((grade) => h("button", { type: "button", "aria-pressed": String(grade === ui.grade), class: `btn border ${grade === ui.grade ? "border-brand bg-brand text-white" : "bg-surface"}`, onclick: () => { ui.grade = grade; draw(); } }, grade === null ? "All grades" : `Grade ${grade}`))) : null,
            groups.map((group) => h("section", { "aria-label": `Grade ${group.grade}`, class: "space-y-2" }, h("h2", { class: "font-semibold text-accent" }, `Grade ${group.grade}`), h("div", { class: "grid gap-2 lg:grid-cols-2" }, group.sections.map(sectionLink)))),
          )
        : null,
      tab === NO_ROOM_TAB ? h("div", { class: "space-y-2" }, h("p", { class: "text-sm text-muted-foreground" }, "These sections have no home room and no classes in a room yet. Open one to start, or add it to a room."), map.unassigned.map(sectionLink)) : null,
      building
        ? h(
            "div",
            { class: "space-y-3" },
            h("div", { class: "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between" }, h("p", { class: "text-sm" }, `${building.rooms.length} ${building.rooms.length === 1 ? "room" : "rooms"}, ${building.rooms.filter(({ sections: used }) => used.length > 0).length} in use.`), h("a", { href: `/schedule/buildings/${building.id}`, class: "btn btn-outline" }, icon("building"), "View building")),
            building.rooms.length === 0 ? emptyState({ title: "No rooms yet", text: "Add this building's rooms on the Rooms & Buildings page.", action: h("a", { href: "/buildings", class: "btn btn-outline" }, "Open Rooms & Buildings") }) : h("div", { class: "grid gap-4 sm:grid-cols-2 xl:grid-cols-3" }, building.rooms.map((room) => roomCard(room))),
          )
        : null,
    );
  };

  const loadAll = async () => {
    try {
      [sections, map] = await Promise.all([getSections(term.id), getScheduleMap(term.id)]);
      draw();
    } catch (error) {
      replace(content, h("p", { role: "alert", class: "text-danger" }, `Could not load the schedules. ${errorMessage(error)}`));
    }
  };

  const stop = watch(["terms", term.id], loadAll);
  await loadAll();
  return stop;
}
