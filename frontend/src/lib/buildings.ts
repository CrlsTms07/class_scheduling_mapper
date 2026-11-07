import * as z from "zod";
import type { ManagedBuilding, ManagedRoom, RoomInput } from "@/types/api";

export const BuildingSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(80, "Use 80 characters or fewer"),
});

export const RoomSchema = z.object({
  room_number: z.string().trim().min(1, "Enter a room number").max(20, "Use 20 characters or fewer"),
  room_name: z.string().trim().max(80, "Use 80 characters or fewer"),
  capacity: z.string().regex(/^\d{0,3}$/, "Enter a number"),
  is_active: z.boolean(),
});

export type RoomValues = z.infer<typeof RoomSchema>;

export function toRoomForm(room: ManagedRoom | null): RoomValues {
  return {
    room_number: room?.room_number ?? "",
    room_name: room?.room_name ?? "",
    capacity: room?.capacity == null ? "" : String(room.capacity),
    is_active: room?.is_active ?? true,
  };
}

export function toRoomInput(values: RoomValues): RoomInput {
  return {
    room_number: values.room_number,
    room_name: values.room_name === "" ? null : values.room_name,
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
