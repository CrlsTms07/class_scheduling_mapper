import React from "react";
import { Link } from "react-router";
import { ArrowUpRightIcon, DoorClosed, SearchIcon, TableProperties } from "lucide-react";
import { useScheduleMap } from "@/api/schedule";
import { useSelectedTerm } from "@/context/selectedTerm";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/schedule";
import {
  firstTab,
  mapTabs,
  NO_ROOM_TAB,
  searchRooms,
  searchSections,
} from "@/lib/scheduleMap";
import type { MapRoom, SectionSummary } from "@/types/api";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

const SectionLink = ({ section }: { section: SectionSummary }) => (
  <Link
    to={`/schedule/sections/${section.id}`}
    className="flex min-h-11 items-center justify-between gap-2 rounded-md border px-3 py-1 hover:bg-[#790D16]/5 focus-visible:outline-2 focus-visible:outline-[#790D16]"
  >
    <span className="min-w-0">
      <span className="block text-sm font-medium text-neutral-900">
        Grade {section.grade} – {section.name}
      </span>
      <span className="block text-xs text-neutral-700">
        Adviser: {section.adviser ?? "None yet"}
      </span>
    </span>
    <span className="flex shrink-0 items-center gap-1">
      <Badge className={STATUS_COLORS[section.status]}>{STATUS_LABELS[section.status]}</Badge>
      <ArrowUpRightIcon className="size-4 text-neutral-500" />
    </span>
  </Link>
);

const RoomCard = ({ room, building }: { room: MapRoom; building?: string }) => (
  <Card className="shadow shadow-[#790D16]/40">
    <CardContent className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-teal-700 font-bold text-base">
            Room: {room.room_number}
            {room.room_name && ` – ${room.room_name}`}
          </p>
          {building && <p className="text-xs text-neutral-700">{building}</p>}
          {!room.is_active && <Badge variant="secondary">Not in use</Badge>}
        </div>
        <Link
          to={`/schedule/rooms/${room.id}`}
          aria-label={`Room schedule of ${room.room_number}`}
          className={buttonVariants({ variant: "outline", className: "h-11 shrink-0" })}
        >
          <DoorClosed />
          Schedule
        </Link>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-neutral-700">Sections in this room:</p>
        {room.sections.length === 0 ? (
          <p className="text-xs text-neutral-500">None yet.</p>
        ) : (
          room.sections.map((section) => <SectionLink key={section.id} section={section} />)
        )}
      </div>
    </CardContent>
  </Card>
);

const Schedule = () => {
  const { term, isPending: isTermPending } = useSelectedTerm();
  const { data: map, isPending, isError } = useScheduleMap(term?.id);
  const [search, setSearch] = React.useState("");
  const [chosenTab, setChosenTab] = React.useState<string | null>(null);

  const tabs = map ? mapTabs(map) : [];
  const tab = tabs.some(({ key }) => key === chosenTab) ? chosenTab : map ? firstTab(map) : undefined;
  const isSearching = search.trim() !== "";

  const renderContent = () => {
    if (!term && !isTermPending) {
      return <p className="text-sm text-neutral-700">No term has been set up yet.</p>;
    }
    if (isError) {
      return <p className="text-sm text-destructive">Could not load the schedules.</p>;
    }
    if (isPending || !map) {
      return <p className="text-sm text-neutral-600">Loading...</p>;
    }
    if (tabs.length === 0) {
      return (
        <p className="text-sm text-neutral-700">
          There are no rooms or sections in your grade levels for this school year yet.
        </p>
      );
    }

    if (isSearching) {
      const rooms = searchRooms(map, search);
      const noRoom = searchSections(map.unassigned, search);

      if (rooms.length === 0 && noRoom.length === 0) {
        return <p className="text-sm text-neutral-700">Nothing matches your search.</p>;
      }

      return (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
            {rooms.map((room) => (
              <RoomCard key={room.id} room={room} building={room.building} />
            ))}
          </div>
          {noRoom.length > 0 && (
            <div className="space-y-2">
              <p className="font-medium text-branding">No room yet</p>
              {noRoom.map((section) => <SectionLink key={section.id} section={section} />)}
            </div>
          )}
        </div>
      );
    }

    const building = map.buildings.find(({ id }) => String(id) === tab);

    return (
      <div className="space-y-4">
        <div role="tablist" aria-label="Building" className="flex flex-wrap gap-2">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={key === tab}
              onClick={() => setChosenTab(key)}
              className={`min-h-11 rounded-md border px-4 text-sm font-medium ${
                key === tab
                  ? "bg-[#790D16] text-white border-[#790D16]"
                  : "bg-background text-neutral-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === NO_ROOM_TAB ? (
          <div className="space-y-2">
            <p className="text-sm text-neutral-700">
              These sections have no home room and no classes in a room yet. Open one to start.
            </p>
            {map.unassigned.map((section) => <SectionLink key={section.id} section={section} />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
            {building?.rooms.map((room) => <RoomCard key={room.id} room={room} />)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-end">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-[#790D16]/20 rounded-sm">
            <TableProperties className="text-branding size-5" />
          </div>
          <div>
            <p className="text-branding text-xl font-medium">
              Schedule Configuration
            </p>
            <p className="text-sm text-neutral-700">
              Choose a building and room, then a section, to build its timetable for{" "}
              {term ? `${term.name}, SY ${term.school_year.name}` : "the selected term"}.
            </p>
          </div>
        </div>
        <InputGroup className="h-11 sm:w-64 shrink-0">
          <InputGroupInput
            aria-label="Search rooms and sections"
            className="h-11"
            placeholder="Search..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <InputGroupAddon align="inline-start">
            <SearchIcon className="text-muted-foreground" />
          </InputGroupAddon>
        </InputGroup>
      </div>
      {renderContent()}
    </div>
  );
};

export default Schedule;
