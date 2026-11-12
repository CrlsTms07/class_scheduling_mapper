import React from "react";
import { Link } from "react-router";
import { ArrowUpRightIcon, Building2, CalendarPlus, Copy, DoorClosed, FileUp, Plus, SearchIcon, TableProperties } from "lucide-react";
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
import ImportScheduleSheet from "@/features/schedule/ImportScheduleSheet";
import NewScheduleSheet from "@/features/schedule/NewScheduleSheet";
import PageHeader from "@/components/global-component/PageHeader";
import { Crumbs } from "@/components/global-component/ScheduleUi";
import { AddSectionToRoomSheet } from "@/features/schedule/builder/RoomSheets";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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

/** A room: its name, "+ Add Section", and the sections that use it, each a link to its schedule. */
const RoomCard = ({ room, building, onAddSection }: { room: MapRoom; building?: string; onAddSection?: (room: MapRoom) => void }) => (
  <article className="flex flex-col gap-4 rounded-xl border bg-background p-5 shadow-sm transition-shadow hover:shadow-md">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <Link
          to={`/schedule/rooms/${room.id}`}
          aria-label={`Room schedule of ${room.room_number}`}
          className="inline-flex min-h-11 items-center gap-1 text-base font-semibold text-teal-700 underline-offset-2 hover:underline"
        >
          Room {room.room_number}
          {room.room_name && <span className="font-normal text-neutral-600"> – {room.room_name}</span>}
        </Link>
        {building && <p className="text-xs text-neutral-600">{building}</p>}
        {room.in_charge && <p className="text-xs text-neutral-600">In charge: {room.in_charge}</p>}
        {!room.is_active && <Badge variant="secondary">Not in use</Badge>}
      </div>
      {onAddSection && (
        <Button type="button" variant="outline" className="h-11 shrink-0" aria-label={`Add a section to room ${room.room_number}`} onClick={() => onAddSection(room)}>
          <Plus />
          Add Section
        </Button>
      )}
    </div>
    <div className="space-y-2">
      <p className="text-sm text-neutral-700">Sections in this room:</p>
      {room.sections.length === 0 ? (
        <p className="text-sm text-neutral-500">None yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {room.sections.map((section) => (
            <Link
              key={section.id}
              to={`/schedule/sections/${section.id}`}
              title={`Adviser: ${section.adviser ?? "None yet"} · ${STATUS_LABELS[section.status]}`}
              className="inline-flex min-h-11 items-center gap-1 rounded-md bg-neutral-100 px-3 text-xs font-medium text-neutral-800 hover:bg-[#790D16]/10 hover:text-branding"
            >
              Grade {section.grade} – {section.name}
              <ArrowUpRightIcon className="size-3.5" />
            </Link>
          ))}
        </div>
      )}
    </div>
  </article>
);

const Schedule = () => {
  const { term, isPending: isTermPending, terms } = useSelectedTerm();
  const [isCopyOpen, setIsCopyOpen] = React.useState(false);
  const [isImportOpen, setIsImportOpen] = React.useState(false);
  const [isNewOpen, setIsNewOpen] = React.useState(false);
  const { data: map, isPending, isError } = useScheduleMap(term?.id);
  const { data: sections = [] } = useSections(term?.id);
  const [grade, setGrade] = React.useState<number | null>(null);
  const [search, setSearch] = React.useState("");
  const [chosenTab, setChosenTab] = React.useState<string | null>(null);
  const [roomForSection, setRoomForSection] = React.useState<MapRoom | null>(null);

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
        <div className="space-y-3 rounded-xl border border-dashed p-6 text-sm text-neutral-700">
          <p className="font-medium text-neutral-900">No sections yet</p>
          <p>A schedule is made for each section. Add the sections of your grade levels first, then come back here.</p>
          <Link
            to="/sections?add=1"
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[#790D16] px-4 font-medium text-white hover:bg-[#790D16]/90"
          >
            <Plus className="size-4" />
            Add a section
          </Link>
        </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {rooms.map((room) => (
              <RoomCard key={room.id} room={room} building={room.building} onAddSection={term ? setRoomForSection : undefined} />
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
        <div role="tablist" aria-label="Building" className="flex gap-1 overflow-x-auto rounded-xl bg-neutral-100 p-1 sm:w-fit">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={key === tab}
              onClick={() => setChosenTab(key)}
              className={`min-h-11 shrink-0 whitespace-nowrap rounded-lg px-5 text-sm font-medium transition-colors ${
                key === tab ? "bg-background text-neutral-900 shadow-sm" : "text-neutral-600 hover:text-neutral-900"
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
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-md bg-[#790D16]/10 text-branding">
                  <DoorClosed className="size-4" />
                </span>
                <p className="text-sm text-neutral-800">
                  Map the sections to their classrooms.{" "}
                  <span className="text-neutral-600">
                    {building.rooms.length} {building.rooms.length === 1 ? "room" : "rooms"},{" "}
                    {building.rooms.filter(({ sections: used }) => used.length > 0).length} in use
                  </span>
                </p>
              </div>
              <Link to={`/schedule/buildings/${building.id}`} className={buttonVariants({ variant: "outline", className: "h-11" })}>
                <Building2 />
                View building
              </Link>
            </div>
            {building.rooms.length === 0 ? (
              <p className="rounded-xl border border-dashed p-6 text-center text-sm text-neutral-700">
                This building has no rooms yet. Add them on the Buildings and Rooms page.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {building.rooms.map((room) => <RoomCard key={room.id} room={room} onAddSection={term ? setRoomForSection : undefined} />)}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <Crumbs items={[{ label: "Home", to: "/dashboard" }, { label: "Schedule" }]} />
      <PageHeader
        icon={TableProperties}
        title="Schedule Configuration"
        description={`Build the weekly timetable of each section: subjects, teachers, rooms and times, in one place. ${term ? `${term.name}, SY ${term.school_year.name}.` : ""}`}
        actions={
          term && (
            <Button type="button" className="h-11" onClick={() => setIsNewOpen(true)}>
              <CalendarPlus />
              New schedule
            </Button>
          )
        }
      />

      <div className="flex flex-col gap-2 rounded-xl border bg-background p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <InputGroup className="h-11 lg:w-80">
          <InputGroupInput
            aria-label="Search rooms and sections"
            className="h-11"
            placeholder="Search rooms, sections or advisers..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <InputGroupAddon align="inline-start">
            <SearchIcon className="text-muted-foreground" />
          </InputGroupAddon>
        </InputGroup>
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          <Link to="/sections?add=1" className={buttonVariants({ variant: "outline", className: "h-11" })}>
            <Plus />
            Add section
          </Link>
          {term && (
            <Button type="button" variant="outline" className="h-11" onClick={() => setIsImportOpen(true)}>
              <FileUp />
              Import from a file
            </Button>
          )}
          {otherTerms.length > 0 && (
            <Button type="button" variant="outline" className="h-11" onClick={() => setIsCopyOpen(true)}>
              <Copy />
              Copy from another {termWord(term)}
            </Button>
          )}
        </div>
      </div>

      {renderContent()}
      {isNewOpen && (
        <NewScheduleSheet
          sections={sections}
          onCopy={otherTerms.length > 0 ? () => { setIsNewOpen(false); setIsCopyOpen(true); } : undefined}
          onImport={() => { setIsNewOpen(false); setIsImportOpen(true); }}
          onClose={() => setIsNewOpen(false)}
        />
      )}
      {isImportOpen && term && <ImportScheduleSheet term={term} onClose={() => setIsImportOpen(false)} />}
      {roomForSection && term && (
        <AddSectionToRoomSheet
          term={term}
          roomId={roomForSection.id}
          roomLabel={`Room ${roomForSection.room_number}`}
          onClose={() => setRoomForSection(null)}
        />
      )}
      {isCopyOpen && term && (
        <CopyScheduleSheet term={term} otherTerms={otherTerms} onClose={() => setIsCopyOpen(false)} />
      )}
    </div>
  );
};

export default Schedule;
