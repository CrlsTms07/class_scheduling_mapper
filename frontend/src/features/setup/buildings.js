// @ts-check
/**
 * Step 4 of the setup: Rooms & Buildings. Junior High and Senior High keep their own buildings;
 * a shared building (gym, library) is changed by the Admin only (team decision, Nov 13, 2026).
 */
import { h, replace } from "@/lib/dom.js";
import { icon } from "@/components/icons.js";
import { openFormDialog } from "@/components/form-dialog.js";
import { skeletonList } from "@/components/loading.js";
import { emptyState, pageHeader } from "@/components/page-header.js";
import { errorMessage } from "@/api/client.js";
import { changeRecord, getRecords } from "@/api/records.js";
import { watch } from "@/state/cache.js";
import { session } from "@/state/session.js";

/** @type {import("@/router.js").RenderPage} */
export async function render(container) {
  const isAdmin = session.user?.role === "super_admin";
  const content = h("div", { class: "space-y-5" }, skeletonList(3));
  const departmentOptions = [{ value: "", label: "Shared by both (like a gym or library)" }, { value: "JHS", label: "Junior High" }, { value: "SHS", label: "Senior High" }];

  const buildingForm = (/** @type {any} */ building = null) =>
    openFormDialog({
      title: building ? `Edit ${building.name}` : "Add a building",
      fields: [
        { name: "name", label: "Building name", required: true, value: building?.name },
        ...(isAdmin ? [{ name: "department", label: "Department", type: /** @type {const} */ ("select"), value: building?.department ?? "", options: departmentOptions, help: "A department's building is changed by its own Chairperson or Master Teacher." }] : []),
      ],
      submitLabel: building ? "Save changes" : "Add building",
      onSubmit: async (values) => {
        const body = isAdmin ? { name: values.name, department: values.department || null } : { name: values.name };
        await changeRecord(building ? `/buildings/${building.id}` : "/buildings", building ? "PUT" : "POST", body);
        return building ? `${values.name} was saved.` : `${values.name} was added.`;
      },
      remove: building ? { label: "Delete this building", message: `This deletes ${building.name}. Its rooms must be deleted first.`, run: async () => { await changeRecord(`/buildings/${building.id}`, "DELETE"); return `${building.name} was deleted.`; } } : undefined,
    });

  const roomForm = (/** @type {any} */ building, /** @type {any} */ room = null) =>
    openFormDialog({
      title: room ? `Edit room ${room.room_number}` : `Add a room to ${building.name}`,
      fields: [
        { name: "room_number", label: "Room number", required: true, value: room?.room_number },
        { name: "room_name", label: "Room name", value: room?.room_name, help: "Like Science Lab" },
        { name: "capacity", label: "Capacity", type: "number", min: 1, max: 200, value: room?.capacity, help: "How many students fit" },
        { name: "in_charge", label: "In charge", value: room?.in_charge, help: "Who looks after the room" },
        { name: "is_active", label: "In use", type: "checkbox", value: room ? room.is_active : true, help: "Rooms not in use are not offered on schedules." },
      ],
      submitLabel: room ? "Save changes" : "Add room",
      onSubmit: async (values) => {
        const body = { ...values, room_name: values.room_name || null, in_charge: values.in_charge || null };
        await changeRecord(room ? `/rooms/${room.id}` : `/buildings/${building.id}/rooms`, room ? "PUT" : "POST", body);
        return `Room ${values.room_number} was ${room ? "saved" : "added"}.`;
      },
      remove: room ? { label: "Delete this room", message: `This deletes room ${room.room_number} of ${building.name}.`, blockedReason: room.cannot_delete_reason, run: async () => { await changeRecord(`/rooms/${room.id}`, "DELETE"); return `Room ${room.room_number} was deleted.`; } } : undefined,
    });

  replace(
    container,
    h(
      "div",
      { class: "space-y-5 p-4 sm:p-6" },
      pageHeader({ icon: "building", title: "Rooms & Buildings", description: "Step 4 of the setup: the buildings and rooms classes are held in.", crumbs: [{ label: "Home", to: "/dashboard" }, { label: "Rooms & Buildings" }], actions: h("button", { type: "button", class: "btn btn-primary", onclick: () => buildingForm() }, icon("plus"), "Add building") }),
      content,
    ),
  );

  const draw = async () => {
    try {
      const buildings = await getRecords("/buildings");
      const rooms = buildings.flatMap((/** @type {any} */ building) => building.rooms);
      const tile = (/** @type {string} */ label, /** @type {number} */ value) => h("div", { class: "card p-4" }, h("p", { class: "text-small text-muted-foreground" }, label), h("p", { class: "text-2xl font-bold text-accent" }, String(value)));
      replace(
        content,
        h("div", { class: "grid grid-cols-2 gap-3 lg:grid-cols-4" }, tile("Buildings", buildings.length), tile("Rooms", rooms.length), tile("In use", rooms.filter((/** @type {any} */ room) => room.is_active).length), tile("Seats (capacity)", rooms.reduce((sum, /** @type {any} */ room) => sum + (room.capacity ?? 0), 0))),
        buildings.length === 0
          ? emptyState({ title: "No buildings yet", text: "Add your first building, then its rooms.", action: h("button", { type: "button", class: "btn btn-primary", onclick: () => buildingForm() }, icon("plus"), "Add building") })
          : buildings.map((/** @type {any} */ building) => {
              const canEdit = building.can_edit !== false;
              return h(
                "section",
                { "aria-label": building.name, class: "card space-y-3 p-4" },
                h(
                  "div",
                  { class: "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between" },
                  h("div", null, h("h2", { class: "text-lg font-semibold text-accent" }, building.name), h("p", { class: "text-small text-muted-foreground" }, `${building.department ? { JHS: "Junior High", SHS: "Senior High" }[/** @type {"JHS" | "SHS"} */ (building.department)] : "Shared by both"} · ${building.rooms.length} ${building.rooms.length === 1 ? "room" : "rooms"}`)),
                  canEdit
                    ? h("div", { class: "flex flex-wrap gap-2" }, h("button", { type: "button", class: "btn btn-outline", "aria-label": `Edit ${building.name}`, onclick: () => buildingForm(building) }, icon("pencil"), "Edit"), h("button", { type: "button", class: "btn btn-outline", onclick: () => roomForm(building) }, icon("plus"), "Add room"), h("a", { href: `/schedule/buildings/${building.id}`, class: "btn btn-quiet" }, "View floor plan"))
                    : h("p", { class: "text-small text-muted-foreground" }, "View only: changed by the Admin."),
                ),
                building.rooms.length === 0
                  ? h("p", { class: "text-sm text-muted-foreground" }, "No rooms yet.")
                  : h("ul", { class: "grid gap-2 sm:grid-cols-2 xl:grid-cols-3" }, building.rooms.map((/** @type {any} */ room) =>
                      h("li", { class: `flex items-start justify-between gap-2 rounded-lg border p-3 ${room.is_active ? "" : "opacity-70"}` },
                        h("div", { class: "min-w-0 text-sm" }, h("p", { class: "font-medium" }, `Room ${room.room_number}${room.room_name ? ` – ${room.room_name}` : ""}`), h("p", { class: "text-small text-muted-foreground" }, [room.capacity ? `${room.capacity} seats` : null, room.in_charge ? `In charge: ${room.in_charge}` : null, room.is_active ? null : "Not in use"].filter(Boolean).join(" · ") || "No details yet")),
                        canEdit ? h("button", { type: "button", class: "btn btn-outline shrink-0", "aria-label": `Edit room ${room.room_number} of ${building.name}`, onclick: () => roomForm(building, room) }, icon("pencil"), "Edit") : null,
                      ),
                    )),
              );
            }),
      );
    } catch (error) {
      replace(content, h("p", { role: "alert", class: "text-danger" }, errorMessage(error)));
    }
  };

  const stop = watch(["records"], draw);
  await draw();
  return stop;
}
