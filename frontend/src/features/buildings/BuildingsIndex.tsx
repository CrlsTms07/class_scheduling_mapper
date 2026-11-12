import React from "react";
import { Building as BuildingIcon, DoorClosed, DoorOpen, Pencil, Plus, SearchIcon, Trash2, UsersRound } from "lucide-react";
import { useBuildings } from "@/api/buildings";
import { filterBuildings } from "@/lib/buildings";
import type { ManagedBuilding, ManagedRoom } from "@/types/api";
import PageHeader from "@/components/global-component/PageHeader";
import StatTile from "@/components/global-component/StatTile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { BuildingDeleteDialog, RoomDeleteDialog } from "./BuildingDeleteDialogs";
import { BuildingSheet, RoomSheet } from "./BuildingSheets";

const HOW_IT_WORKS = [
  "Add a building, then add its rooms. These are reused every school year.",
  "Rooms in use are offered as home rooms in Sections and as rooms in the plotter.",
  "A room used by a schedule or section cannot be deleted. Mark it as not in use instead, so old schedules stay correct.",
];

const BuildingsIndex = () => {
  const { data: buildings, isPending, isError } = useBuildings();

  const [search, setSearch] = React.useState("");
  // undefined = closed, null = adding a new one
  const [editingBuilding, setEditingBuilding] = React.useState<ManagedBuilding | null | undefined>(undefined);
  const [roomTarget, setRoomTarget] = React.useState<{
    building: ManagedBuilding;
    room: ManagedRoom | null;
  } | null>(null);

  const [deletingBuilding, setDeletingBuilding] = React.useState<ManagedBuilding | null>(null);
  const [deletingRoom, setDeletingRoom] = React.useState<{ room: ManagedRoom; buildingName: string } | null>(null);

  const shown = filterBuildings(buildings ?? [], search);

  const allRooms = (buildings ?? []).flatMap(({ rooms }) => rooms);
  const seats = allRooms.reduce((total, { capacity }) => total + (capacity ?? 0), 0);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <PageHeader
        icon={BuildingIcon}
        title="Buildings and Rooms"
        description="Where classes are held. Reused every school year."
        actions={
          <Button type="button" className="h-11" onClick={() => setEditingBuilding(null)}>
            <Plus />
            Add building
          </Button>
        }
      />

      {buildings && buildings.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile icon={BuildingIcon} label="Buildings" value={buildings.length} />
          <StatTile icon={DoorClosed} label="Rooms" value={allRooms.length} />
          <StatTile icon={DoorOpen} label="In use" value={allRooms.filter(({ is_active: active }) => active).length} />
          <StatTile icon={UsersRound} label="Seats (capacity)" value={seats} />
        </div>
      )}

      <div className="space-y-3 rounded-xl border bg-background p-3 shadow-sm">
        <div className="space-y-1 sm:max-w-sm">
          <label htmlFor="room-search" className="text-sm text-neutral-800">
            Search
          </label>
          <InputGroup className="h-11">
            <InputGroupInput
              id="room-search"
              className="h-11"
              placeholder="Building or room"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <InputGroupAddon align="inline-start">
              <SearchIcon className="text-muted-foreground" />
            </InputGroupAddon>
          </InputGroup>
        </div>
        <details className="rounded-md bg-neutral-50">
          <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-medium text-neutral-800">
            How this works
          </summary>
          <ul className="list-disc space-y-1 px-3 pb-3 pl-8 text-sm text-neutral-700">
            {HOW_IT_WORKS.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
      </div>

      {isPending && <p className="text-sm text-neutral-600">Loading...</p>}
      {isError && <p className="text-sm text-destructive">Could not load the buildings.</p>}
      {buildings?.length === 0 && (
        <div className="space-y-2 rounded-xl border border-dashed p-6 text-center text-sm text-neutral-700">
          <BuildingIcon className="mx-auto size-8 text-branding/60" />
          <p>There are no buildings yet.</p>
        </div>
      )}
      {buildings && buildings.length > 0 && shown.length === 0 && (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-neutral-700">Nothing matches your search.</p>
      )}

      <div className="space-y-5">
        {shown.map((building) => {
          // The search may have narrowed the rooms, so the sheets get the whole building.
          const fullBuilding = buildings?.find(({ id }) => id === building.id) ?? building;
          const count = fullBuilding.rooms.length;

          return (
            <section key={building.id} aria-label={building.name} className="overflow-hidden rounded-xl border bg-background shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b bg-neutral-50 p-3 sm:px-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#790D16] text-white">
                    <BuildingIcon className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold text-neutral-900">{building.name}</h2>
                    <p className="text-xs text-neutral-600">{`${count} ${count === 1 ? "room" : "rooms"}`}</p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 min-w-11 bg-background"
                    aria-label={`Edit building ${building.name}`}
                    onClick={() => setEditingBuilding(fullBuilding)}
                  >
                    <Pencil />
                    <span className="max-sm:sr-only">Edit</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 min-w-11 bg-background text-destructive hover:bg-red-50 hover:text-destructive"
                    aria-label={`Delete building ${building.name}`}
                    onClick={() => setDeletingBuilding(fullBuilding)}
                  >
                    <Trash2 />
                    <span className="max-sm:sr-only">Delete</span>
                  </Button>
                </div>
              </div>

              <div className="space-y-3 p-3 sm:p-4">
                {building.rooms.length === 0 && <p className="text-sm text-neutral-700">No rooms yet.</p>}
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {building.rooms.map((room) => (
                    <li
                      key={room.id}
                      className={`flex h-full items-center gap-3 rounded-lg border p-3 ${room.is_active ? "" : "bg-neutral-50"}`}
                    >
                      <span
                        className={`flex size-9 shrink-0 items-center justify-center rounded-md ${
                          room.is_active ? "bg-[#790D16]/10 text-branding" : "bg-neutral-200 text-neutral-500"
                        }`}
                      >
                        <DoorClosed className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-neutral-900">
                          {room.room_name ? `Room ${room.room_number} – ${room.room_name}` : `Room ${room.room_number}`}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-neutral-600">
                          {room.capacity === null ? "Capacity not set" : `Capacity ${room.capacity}`}
                          {room.in_charge && ` · In charge: ${room.in_charge}`}
                          {!room.is_active && <Badge variant="secondary">Not in use</Badge>}
                        </span>
                      </span>
                      <span className="flex shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-11 text-neutral-600 hover:text-branding"
                          aria-label={`Edit room ${room.room_number} of ${building.name}`}
                          title="Edit"
                          onClick={() => setRoomTarget({ building: fullBuilding, room })}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-11 text-neutral-600 hover:bg-red-50 hover:text-destructive"
                          aria-label={`Delete room ${room.room_number} of ${building.name}`}
                          title="Delete"
                          onClick={() => setDeletingRoom({ room, buildingName: building.name })}
                        >
                          <Trash2 />
                        </Button>
                      </span>
                    </li>
                  ))}
                  <li>
                    <button
                      type="button"
                      aria-label={`Add room to ${building.name}`}
                      onClick={() => setRoomTarget({ building: fullBuilding, room: null })}
                      className="flex h-full min-h-16 w-full items-center justify-center gap-2 rounded-lg border border-dashed p-3 text-sm font-medium text-branding hover:bg-[#790D16]/5 focus-visible:outline-2 focus-visible:outline-[#790D16]"
                    >
                      <Plus className="size-4" />
                      Add room
                    </button>
                  </li>
                </ul>
              </div>
            </section>
          );
        })}
      </div>

      {deletingBuilding && <BuildingDeleteDialog building={deletingBuilding} onClose={() => setDeletingBuilding(null)} />}
      {deletingRoom && (
        <RoomDeleteDialog room={deletingRoom.room} buildingName={deletingRoom.buildingName} onClose={() => setDeletingRoom(null)} />
      )}

      {editingBuilding !== undefined && (
        <BuildingSheet
          key={editingBuilding?.id ?? "new"}
          building={editingBuilding}
          onClose={() => setEditingBuilding(undefined)}
        />
      )}

      {roomTarget && (
        <RoomSheet
          key={roomTarget.room?.id ?? "new"}
          building={roomTarget.building}
          room={roomTarget.room}
          onClose={() => setRoomTarget(null)}
        />
      )}
    </div>
  );
};

export default BuildingsIndex;
