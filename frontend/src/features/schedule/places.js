// @ts-check
/**
 * A room's week (Room Schedule) and a building at a glance (floor plan, floor by floor, top floor
 * first, with the sections that use each room). Both download as PDF and CSV.
 */
import { h, replace } from "@/lib/dom.js";
import { icon } from "@/components/icons.js";
import { downloadButtons } from "@/components/download-buttons.js";
import { skeletonPage } from "@/components/loading.js";
import { breadcrumbs, emptyState, pageHeader } from "@/components/page-header.js";
import { api, errorMessage } from "@/api/client.js";
import { getScheduleMap } from "@/api/schedule.js";
import { load } from "@/state/cache.js";
import { termState } from "@/state/term.js";
import { DAY_NAMES, STATUS_COLORS, STATUS_LABELS, WEEK_DAYS } from "@/lib/schedule.js";
import { timeRange } from "@/lib/time.js";
import { openRoomSectionDialog } from "./list/start-dialogs.js";

/**
 * The floor of a room, from its number as schools write it: 101 and B-204 are on the 1st and 2nd
 * floor. Rooms with other names (Library, Lab A) have no floor and are listed apart.
 * @param {string} roomNumber
 */
export function floorOf(roomNumber) {
  const match = roomNumber.trim().match(/(?:^|[^\d])(\d)\d{2}$/) ?? roomNumber.trim().match(/^(\d)\d{2}(?!\d)/);
  return match ? Number(match[1]) : null;
}

const ORDINALS = ["Ground", "1st", "2nd", "3rd"];
export const floorLabel = (/** @type {number | null} */ floor) => (floor === null ? "Other rooms" : `${ORDINALS[floor] ?? `${floor}th`} floor`);

/**
 * Rooms grouped by floor, top floor first; other rooms come last.
 * @template {{ room_number: string }} T
 * @param {T[]} rooms
 */
export function roomsByFloor(rooms) {
  /** @type {Map<number | null, T[]>} */
  const floors = new Map();
  for (const room of rooms) {
    const floor = floorOf(room.room_number);
    floors.set(floor, [...(floors.get(floor) ?? []), room]);
  }
  return [...floors.entries()].sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : b - a)).map(([floor, list]) => ({ floor, rooms: list }));
}

/** @type {import("@/router.js").RenderPage} */
export async function renderRoom(container, { params }) {
  const term = termState.term;
  if (!term) return;
  const roomId = Number(params.roomId);
  replace(container, skeletonPage());
  try {
    const data = await load(["terms", term.id, "rooms", roomId, "schedule"], async () => /** @type {{ data: any }} */ (await api(`/terms/${term.id}/rooms/${roomId}/schedule`)).data);
    const room = data.room;
    replace(
      container,
      h(
        "div",
        { class: "space-y-5 p-4 sm:p-6" },
        breadcrumbs([{ label: "Home", to: "/dashboard" }, { label: "Schedule", to: "/schedule" }, { label: room.label }]),
        pageHeader({
          icon: "building",
          title: room.label,
          description: [room.room_name, room.in_charge ? `In charge: ${room.in_charge}` : null, room.capacity ? `${room.capacity} seats` : null, `${term.name}, SY ${term.school_year.name}`].filter(Boolean).join(" · "),
          actions: [h("button", { type: "button", class: "btn btn-outline", onclick: () => openRoomSectionDialog({ term, roomId, roomLabel: room.label }) }, icon("plus"), "Add section"), downloadButtons({ basePath: `/terms/${term.id}/reports/rooms/${roomId}/schedule`, label: `Room Schedule of ${room.label}` })],
        }),
        data.sections.length ? h("p", { class: "text-sm" }, h("strong", null, "Sections in this room: "), data.sections.join(", ")) : null,
        h("div", { class: "grid gap-4 md:grid-cols-2 xl:grid-cols-3" }, WEEK_DAYS.map((day) => {
          const entries = data.entries.filter((/** @type {any} */ entry) => entry.day === day);
          return h("section", { "aria-label": DAY_NAMES[day], class: "card space-y-2 p-4" },
            h("h2", { class: "flex items-baseline justify-between font-semibold text-accent" }, DAY_NAMES[day], h("span", { class: "text-small font-normal text-muted-foreground" }, entries.length ? `${entries.length} ${entries.length === 1 ? "class" : "classes"}` : "free all day")),
            entries.length === 0 ? h("p", { class: "text-sm text-muted-foreground" }, "Free all day.") : h("ul", { class: "space-y-2" }, entries.map((/** @type {any} */ entry) =>
              h("li", { class: "rounded-lg border p-2 text-sm" },
                h("p", { class: "text-small text-muted-foreground" }, `${timeRange(entry.start_time, entry.end_time)} · ${entry.minutes} mins`),
                entry.can_open ? h("a", { href: `/schedule/sections/${entry.section_id}`, class: "inline-flex min-h-11 items-center font-medium text-brand underline-offset-2 hover:underline" }, entry.section) : h("p", { class: "font-medium" }, entry.section),
                h("p", null, [entry.subject, entry.teacher].filter(Boolean).join(" · ")),
                entry.status !== "draft" ? h("span", { class: `badge ${STATUS_COLORS[/** @type {keyof typeof STATUS_COLORS} */ (entry.status)] ?? ""}` }, STATUS_LABELS[/** @type {keyof typeof STATUS_LABELS} */ (entry.status)] ?? entry.status) : null,
              ),
            )),
          );
        })),
      ),
    );
  } catch (error) {
    replace(container, h("div", { class: "p-4 sm:p-6" }, emptyState({ title: "This room could not be opened", text: errorMessage(error), action: h("a", { href: "/schedule", class: "btn btn-outline" }, "Back to the schedule") })));
  }
}

/** @type {import("@/router.js").RenderPage} */
export async function renderBuilding(container, { params, query, navigate }) {
  const term = termState.term;
  if (!term) return;
  const buildingId = Number(params.buildingId);
  const layout = query.get("view") === "list" ? "list" : "map";
  replace(container, skeletonPage());
  try {
    const map = await getScheduleMap(term.id);
    const building = map.buildings.find((item) => item.id === buildingId);
    if (!building) {
      replace(container, h("div", { class: "p-4 sm:p-6" }, emptyState({ title: "Building not found", text: "It is not in the term selected at the top.", action: h("a", { href: "/schedule", class: "btn btn-outline" }, "Back to the schedule") })));
      return;
    }
    const used = building.rooms.filter(({ sections }) => sections.length > 0).length;
    const roomBox = (/** @type {import("@/lib/schedule-map.js").MapRoom} */ room) =>
      h("a", { href: `/schedule/rooms/${room.id}`, class: `block min-h-24 rounded-xl border p-3 hover:border-brand ${room.sections.length ? "bg-brand-soft" : "bg-surface"}` },
        h("p", { class: "font-semibold" }, `Room ${room.room_number}`),
        room.room_name ? h("p", { class: "text-small text-muted-foreground" }, room.room_name) : null,
        room.sections.length ? h("ul", { class: "mt-1 space-y-0.5 text-sm" }, room.sections.map((section) => h("li", null, `Grade ${section.grade} – ${section.name}`))) : h("p", { class: "mt-1 text-small text-muted-foreground" }, room.is_active ? "Free" : "Not in use"),
      );

    replace(
      container,
      h(
        "div",
        { class: "space-y-5 p-4 sm:p-6" },
        breadcrumbs([{ label: "Home", to: "/dashboard" }, { label: "Schedule", to: "/schedule" }, { label: building.name }]),
        pageHeader({ icon: "building", title: building.name, description: `${building.rooms.length} ${building.rooms.length === 1 ? "room" : "rooms"}, ${used} in use. ${term.name}, SY ${term.school_year.name}.`, actions: downloadButtons({ basePath: `/terms/${term.id}/reports/room-usage?building=${building.id}`, label: `Room usage of ${building.name}` }) }),
        building.rooms.length
          ? h("div", { role: "tablist", "aria-label": "Show", class: "grid grid-cols-2 gap-1 rounded-xl bg-surface-muted p-1 sm:w-72" }, [["map", "Floor plan"], ["list", "List"]].map(([key, label]) => h("button", { type: "button", role: "tab", "aria-selected": String(layout === key), class: `btn ${layout === key ? "bg-surface shadow-sm" : "text-muted-foreground"}`, onclick: () => navigate(`/schedule/buildings/${building.id}${key === "list" ? "?view=list" : ""}`) }, label)))
          : null,
        building.rooms.length === 0
          ? emptyState({ title: "No rooms yet", text: "Add this building's rooms on the Rooms & Buildings page.", action: h("a", { href: "/buildings", class: "btn btn-outline" }, "Open Rooms & Buildings") })
          : layout === "map"
            ? roomsByFloor(building.rooms).map(({ floor, rooms }) => h("section", { "aria-label": floorLabel(floor), class: "space-y-2" }, h("h2", { class: "text-small font-semibold uppercase tracking-wide text-muted-foreground" }, floorLabel(floor)), h("div", { class: "grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" }, rooms.map(roomBox))))
            : h("ul", { class: "card divide-y" }, building.rooms.map((room) => h("li", { class: "flex flex-col gap-1 p-3 text-sm sm:flex-row sm:items-center sm:justify-between" }, h("a", { href: `/schedule/rooms/${room.id}`, class: "inline-flex min-h-11 items-center font-medium text-brand underline-offset-2 hover:underline" }, `Room ${room.room_number}${room.room_name ? ` – ${room.room_name}` : ""}`), h("span", { class: "text-muted-foreground" }, room.sections.length ? room.sections.map((section) => `Grade ${section.grade} – ${section.name}`).join(", ") : "Free")))),
      ),
    );
  } catch (error) {
    replace(container, h("p", { role: "alert", class: "p-6 text-danger" }, errorMessage(error)));
  }
}
