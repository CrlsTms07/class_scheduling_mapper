import React from "react";
import { Link } from "react-router";
import { ArrowUpRightIcon, Copy, DoorClosed, SearchIcon, TableProperties } from "lucide-react";
import { useScheduleMap, useSections } from "@/api/schedule";
import { useSelectedTerm } from "@/context/selectedTerm";
import { STATUS_COLORS, STATUS_LABELS, termWord } from "@/lib/schedule";
import {
  ALL_SECTIONS_TAB,
  mapTabs,
  NO_ROOM_TAB,
  searchRooms,
  searchSections,
  sectionsByGrade,
} from "@/lib/scheduleMap";
import type { MapRoom, SectionSummary } from "@/types/api";
import CopyScheduleSheet from "@/features/schedule/CopyScheduleSheet";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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
  const { term, isPending: isTermPending, terms } = useSelectedTerm();
  const [isCopyOpen, setIsCopyOpen] = React.useState(false);
  const { data: map, isPending, isError } = useScheduleMap(term?.id);
  const { data: sections = [] } = useSections(term?.id);
  const [grade, setGrade] = React.useState<number | null>(null);
  const [search, setSearch] = React.useState("");
  const [chosenTab, setChosenTab] = React.useState<string | null>(null);

  // Every section can be found in one place, so none hides behind a room it does not have yet.
  const tabs = map
    ? [...(sections.length > 0 ? [{ key: ALL_SECTIONS_TAB, label: "All sections" }] : []), ...mapTabs(map)]
    : [];
  const tab = tabs.some(({ key }) => key === chosenTab) ? chosenTab : tabs[0]?.key;
  const groups = sectionsByGrade(sections).filter((group) => grade === null || group.grade === grade);
  const isSearching = search.trim() !== "";

  const otherTerms = terms.filter(
    (other) => other.school_year.id === term?.school_year.id && other.id !== term?.id,
  );

  const renderContent = () => {
    if (!term && !isTermPending) {
      return <p className="text-sm text-neutral-700">No school year has been set up yet.</p>;
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

        {tab === ALL_SECTIONS_TAB && (
          <div className="space-y-4">
            <div role="group" aria-label="Grade level" className="flex flex-wrap gap-2">
              {[null, ...new Set(sections.map((section) => section.grade))].map((item) => (
                <button
                  key={item ?? "all"}
                  type="button"
                  aria-pressed={item === grade}
                  onClick={() => setGrade(item)}
                  className={`min-h-11 rounded-md border px-3 text-sm font-medium ${
                    item === grade
                      ? "bg-[#790D16] text-white border-[#790D16]"
                      : "bg-background text-neutral-700"
                  }`}
                >
                  {item === null ? "All grades" : `Grade ${item}`}
                </button>
              ))}
            </div>
            {groups.map((group) => (
              <section key={group.grade} aria-label={`Grade ${group.grade}`} className="space-y-2">
                <p className="font-medium text-teal-700">Grade {group.grade}</p>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                  {group.sections.map((section) => <SectionLink key={section.id} section={section} />)}
                </div>
              </section>
            ))}
          </div>
        )}

        {tab === NO_ROOM_TAB && (
          <div className="space-y-2">
            <p className="text-sm text-neutral-700">
              These sections have no home room and no classes in a room yet. Open one to start.
            </p>
            {map.unassigned.map((section) => <SectionLink key={section.id} section={section} />)}
          </div>
        )}

        {building && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
            {building.rooms.map((room) => <RoomCard key={room.id} room={room} />)}
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
              Open a section to build its timetable for{" "}
              {term ? `${term.name}, SY ${term.school_year.name}` : "the selected term"}.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row shrink-0">
          {otherTerms.length > 0 && (
            <Button type="button" variant="outline" className="h-11" onClick={() => setIsCopyOpen(true)}>
              <Copy />
              Copy from another {termWord(term)}
            </Button>
          )}
          <InputGroup className="h-11 sm:w-64">
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
      </div>
      {renderContent()}
      {isCopyOpen && term && (
        <CopyScheduleSheet term={term} otherTerms={otherTerms} onClose={() => setIsCopyOpen(false)} />
      )}
    </div>
  );
};

export default Schedule;
