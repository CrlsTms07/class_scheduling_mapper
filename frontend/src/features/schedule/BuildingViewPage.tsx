import React from "react";
import { Link, useParams } from "react-router";
import { ArrowUpRight, Building2, DoorClosed, FileSpreadsheet, Printer } from "lucide-react";
import { downloadFile } from "@/api/client";
import { useScheduleMap } from "@/api/schedule";
import { useSelectedTerm } from "@/context/selectedTerm";
import { floorLabel, roomsByFloor } from "@/lib/buildings";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/schedule";
import type { MapRoom } from "@/types/api";
import FormAlert from "@/components/global-component/FormAlert";
import { Crumbs, DetailHeader, SegmentedTabs, TermTabs } from "@/components/global-component/ScheduleUi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Layout = "map" | "list";

/** One room on the floor plan: free rooms are plain, used ones show their sections. */
const RoomTile = ({ room }: { room: MapRoom }) => (
  <Link
    to={`/schedule/rooms/${room.id}`}
    aria-label={`Room ${room.room_number}: ${room.sections.length === 0 ? "free" : room.sections.map(({ grade, name }) => `Grade ${grade} – ${name}`).join(", ")}`}
    className={`flex min-h-24 w-40 shrink-0 flex-col gap-1 rounded-lg border-2 p-2 text-left transition-shadow hover:shadow-md sm:w-44 ${
      !room.is_active
        ? "border-dashed border-neutral-300 bg-neutral-50 text-neutral-500"
        : room.sections.length === 0
          ? "border-neutral-200 bg-background"
          : "border-[#790D16]/40 bg-[#790D16]/5"
    }`}
  >
    <span className="flex items-center justify-between gap-1">
      <span className="text-sm font-semibold text-teal-700">{room.room_number}</span>
      <DoorClosed className="size-3.5 text-neutral-400" />
    </span>
    {room.room_name && <span className="truncate text-xs text-neutral-700">{room.room_name}</span>}
    {room.sections.length === 0 ? (
      <span className="text-xs text-neutral-500">{room.is_active ? "Free" : "Not in use"}</span>
    ) : (
      room.sections.map((section) => (
        <span key={section.id} className="truncate text-xs font-medium text-neutral-900">
          G{section.grade} – {section.name}
        </span>
      ))
    )}
    {room.in_charge && <span className="mt-auto truncate text-[11px] text-neutral-600">In charge: {room.in_charge}</span>}
  </Link>
);

/** The building drawn floor by floor, top floor first, so a room is found where it really is. */
const FloorPlan = ({ rooms }: { rooms: MapRoom[] }) => (
  <div className="space-y-3 rounded-2xl border bg-neutral-50 p-3 sm:p-4">
    {roomsByFloor(rooms).map(({ floor, rooms: onFloor }) => (
      <section key={floor ?? "other"} aria-label={floorLabel(floor)} className="space-y-2">
        <h2 className="text-xs font-semibold tracking-wide text-neutral-600 uppercase">{floorLabel(floor)}</h2>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {onFloor.map((room) => (
            <RoomTile key={room.id} room={room} />
          ))}
        </div>
      </section>
    ))}
    <p className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs text-neutral-600">
      <span className="inline-flex items-center gap-1"><span className="size-3 rounded border-2 border-[#790D16]/40 bg-[#790D16]/5" /> Used</span>
      <span className="inline-flex items-center gap-1"><span className="size-3 rounded border-2 border-neutral-200 bg-background" /> Free</span>
      <span className="inline-flex items-center gap-1"><span className="size-3 rounded border-2 border-dashed border-neutral-300" /> Not in use</span>
    </p>
  </div>
);

/**
 * A building at a glance: every room floor by floor, and the sections that use each one. It
 * prints as the room usage form of that building only.
 */
const BuildingViewPage = () => {
  const buildingId = Number(useParams().buildingId);
  const { term } = useSelectedTerm();
  const { data: map, isPending, isError } = useScheduleMap(term?.id);
  const [downloadError, setDownloadError] = React.useState<string | null>(null);
  const [layout, setLayout] = React.useState<Layout>("map");
  const building = map?.buildings.find(({ id }) => id === buildingId);

  const crumbs = [{ label: "Home", to: "/dashboard" }, { label: "Schedule", to: "/schedule" }, { label: building?.name ?? "Building" }];

  if (isError || (map && !building)) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <Crumbs items={crumbs} />
        <FormAlert>This building could not be found.</FormAlert>
      </div>
    );
  }

  if (isPending || !building || !term) {
    return <p className="p-6 text-sm text-neutral-600">Loading...</p>;
  }

  const download = (extension: "pdf" | "xlsx") => {
    setDownloadError(null);
    downloadFile(`/terms/${term.id}/reports/room-usage.${extension}?building=${building.id}`).catch((problem: Error) => setDownloadError(problem.message));
  };
  const used = building.rooms.filter(({ sections }) => sections.length > 0).length;
  const sectionCount = building.rooms.reduce((total, { sections }) => total + sections.length, 0);

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <Crumbs items={crumbs} />

      <DetailHeader
        icon={Building2}
        title={building.name}
        subtitle={`${building.rooms.length} ${building.rooms.length === 1 ? "room" : "rooms"}, ${used} in use, ${sectionCount} ${sectionCount === 1 ? "section" : "sections"}. ${term.name}, SY ${term.school_year.name}.`}
        actions={
          <>
            <Button type="button" className="h-11" onClick={() => download("pdf")}>
              <Printer />
              Print
            </Button>
            <Button type="button" variant="outline" className="h-11" onClick={() => download("xlsx")}>
              <FileSpreadsheet />
              XLSX
            </Button>
          </>
        }
      />
      {downloadError && <FormAlert>{downloadError}</FormAlert>}

      <TermTabs />

      {building.rooms.length > 0 && (
        <SegmentedTabs
          label="Show"
          className="sm:max-w-sm"
          items={[
            { value: "map" as const, label: "Floor plan" },
            { value: "list" as const, label: "List" },
          ]}
          value={layout}
          onChange={setLayout}
        />
      )}

      {building.rooms.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-neutral-700">
          This building has no rooms yet. Add them on the Rooms &amp; Buildings page.
        </p>
      ) : layout === "map" ? (
        <FloorPlan rooms={building.rooms} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {building.rooms.map((room) => (
            <section key={room.id} aria-label={`Room ${room.room_number}`} className="overflow-hidden rounded-xl border bg-background shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b bg-neutral-50 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[#790D16]/10 text-branding">
                    <DoorClosed className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-semibold text-teal-700">
                      Room {room.room_number}
                      {room.room_name && <span className="font-normal text-neutral-600"> – {room.room_name}</span>}
                    </h2>
                    <p className="text-xs text-neutral-600">
                      {room.sections.length === 0 ? "Free" : `${room.sections.length} ${room.sections.length === 1 ? "section" : "sections"}`}
                      {!room.is_active && " · Not in use"}
                      {room.in_charge && ` · In charge: ${room.in_charge}`}
                    </p>
                  </div>
                </div>
                <Link
                  to={`/schedule/rooms/${room.id}`}
                  aria-label={`Open the schedule of room ${room.room_number}`}
                  className="inline-flex min-h-11 items-center gap-1 rounded-md px-3 text-sm font-medium text-branding hover:bg-[#790D16]/5"
                >
                  Schedule
                  <ArrowUpRight className="size-4" />
                </Link>
              </div>
              {room.sections.length === 0 ? (
                <p className="p-4 text-sm text-neutral-600">No section uses this room yet.</p>
              ) : (
                <ul className="divide-y">
                  {room.sections.map((section) => (
                    <li key={section.id}>
                      <Link to={`/schedule/sections/${section.id}`} className="flex min-h-11 items-center justify-between gap-3 px-4 py-2 hover:bg-[#790D16]/3">
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-neutral-900">
                            Grade {section.grade} – {section.name}
                          </span>
                          <span className="block text-xs text-neutral-600">Adviser: {section.adviser ?? "None yet"}</span>
                        </span>
                        <Badge className={STATUS_COLORS[section.status]}>{STATUS_LABELS[section.status]}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default BuildingViewPage;
