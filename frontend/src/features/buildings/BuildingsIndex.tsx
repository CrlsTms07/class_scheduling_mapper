import React from "react";
import { Building as BuildingIcon, Pencil, Plus, SearchIcon } from "lucide-react";
import { useBuildings } from "@/api/buildings";
import { filterBuildings } from "@/lib/buildings";
import type { ManagedBuilding, ManagedRoom } from "@/types/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
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

  const shown = filterBuildings(buildings ?? [], search);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-[#790D16]/20 rounded-sm">
            <BuildingIcon className="text-branding size-5" />
          </div>
          <div>
            <p className="text-branding text-xl font-medium">Buildings and Rooms</p>
            <p className="text-sm text-neutral-700">Where classes are held.</p>
          </div>
        </div>
        <Button type="button" className="h-11 shrink-0" onClick={() => setEditingBuilding(null)}>
          <Plus />
          Add building
        </Button>
      </div>

      <details className="rounded-md border bg-background">
        <summary className="flex min-h-11 cursor-pointer items-center p-3 text-sm font-medium">
          How this works
        </summary>
        <ul className="list-disc space-y-1 px-3 pb-3 pl-8 text-sm text-neutral-700">
          {HOW_IT_WORKS.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>

      <div className="space-y-1 sm:w-72">
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

      {isPending && <p className="text-sm text-neutral-600">Loading...</p>}
      {isError && <p className="text-sm text-destructive">Could not load the buildings.</p>}
      {buildings?.length === 0 && (
        <p className="text-sm text-neutral-700">There are no buildings yet.</p>
      )}
      {buildings && buildings.length > 0 && shown.length === 0 && (
        <p className="text-sm text-neutral-700">Nothing matches your search.</p>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        {shown.map((building) => {
          // The search may have narrowed the rooms, so the sheets get the whole building.
          const fullBuilding = buildings?.find(({ id }) => id === building.id) ?? building;

          return (
            <Card key={building.id} className="shadow shadow-[#790D16]/40">
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-teal-700 font-bold text-base">{building.name}</p>
                    <p className="text-xs text-neutral-700">
                      {fullBuilding.rooms.length} {fullBuilding.rooms.length === 1 ? "room" : "rooms"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 shrink-0"
                    aria-label={`Edit building ${building.name}`}
                    onClick={() => setEditingBuilding(fullBuilding)}
                  >
                    <Pencil />
                    Edit
                  </Button>
                </div>

                {building.rooms.length === 0 ? (
                  <p className="border-t pt-3 text-sm text-neutral-700">No rooms yet.</p>
                ) : (
                  <ul className="divide-y border-t">
                    {building.rooms.map((room) => (
                      <li key={room.id} className="flex min-h-11 items-center justify-between gap-2 py-1">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-neutral-900">
                            Room {room.room_number}
                            {room.room_name && ` – ${room.room_name}`}
                          </p>
                          <p className="text-xs text-neutral-700">
                            {room.capacity === null ? "Capacity not set" : `Capacity ${room.capacity}`}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {!room.is_active && <Badge variant="secondary">Not in use</Badge>}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-11"
                            aria-label={`Edit room ${room.room_number} of ${building.name}`}
                            onClick={() => setRoomTarget({ building: fullBuilding, room })}
                          >
                            <Pencil />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full"
                  aria-label={`Add room to ${building.name}`}
                  onClick={() => setRoomTarget({ building: fullBuilding, room: null })}
                >
                  <Plus />
                  Add room
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

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
