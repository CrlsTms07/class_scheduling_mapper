import * as z from "zod";
import type { ManagedBuilding, ManagedRoom, RoomInput } from "@/types/api";

export const BuildingSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(80, "Use 80 characters or fewer"),
});

export const RoomSchema = z.object({
  room_number: z.string().trim().min(1, "Enter a room number").max(20, "Use 20 characters or fewer"),
  room_name: z.string().trim().max(80, "Use 80 characters or fewer"),
  in_charge: z.string().trim().max(100, "Use 100 characters or fewer"),
  capacity: z.string().regex(/^\d{0,3}$/, "Enter a number"),
  is_active: z.boolean(),
});

export type RoomValues = z.infer<typeof RoomSchema>;

export function toRoomForm(room: ManagedRoom | null): RoomValues {
  return {
    room_number: room?.room_number ?? "",
    room_name: room?.room_name ?? "",
    in_charge: room?.in_charge ?? "",
    capacity: room?.capacity == null ? "" : String(room.capacity),
    is_active: room?.is_active ?? true,
  };
}

export function toRoomInput(values: RoomValues): RoomInput {
  return {
    room_number: values.room_number,
    room_name: values.room_name === "" ? null : values.room_name,
    in_charge: values.in_charge === "" ? null : values.in_charge,
    capacity: values.capacity === "" ? null : Number(values.capacity),
    is_active: values.is_active,
  };
}

/**
 * Buildings matching the search. A building that matches shows all its rooms.
 * Otherwise only the matching rooms show, and a building with none is left out.
 */
export function filterBuildings(buildings: ManagedBuilding[], search: string): ManagedBuilding[] {
  const words = search.trim().toLowerCase();

  if (words === "") return buildings;

  return buildings.flatMap((building) => {
    if (building.name.toLowerCase().includes(words)) return [building];

    const rooms = building.rooms.filter((room) =>
      `${room.room_number} ${room.room_name ?? ""}`.toLowerCase().includes(words),
    );

    return rooms.length > 0 ? [{ ...building, rooms }] : [];
  });
}

/**
 * The floor of a room, from its number as schools write it: 101 and B-204 are on the 1st and 2nd
 * floor. Rooms with other names (Library, Lab A) have no floor and are listed apart.
 */
export function floorOf(roomNumber: string): number | null {
  const match = roomNumber.trim().match(/(?:^|[^\d])(\d)\d{2}$/) ?? roomNumber.trim().match(/^(\d)\d{2}(?!\d)/);

  return match ? Number(match[1]) : null;
}

const ORDINALS = ["Ground", "1st", "2nd", "3rd"];

export const floorLabel = (floor: number | null) =>
  floor === null ? "Other rooms" : `${ORDINALS[floor] ?? `${floor}th`} floor`;

/** Rooms grouped by floor, top floor first, the way a building is drawn; other rooms come last. */
export function roomsByFloor<T extends { room_number: string }>(rooms: T[]): { floor: number | null; rooms: T[] }[] {
  const floors = new Map<number | null, T[]>();
  for (const room of rooms) {
    const floor = floorOf(room.room_number);
    floors.set(floor, [...(floors.get(floor) ?? []), room]);
  }

  return [...floors.entries()]
    .sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : b - a))
    .map(([floor, list]) => ({ floor, rooms: list }));
}
