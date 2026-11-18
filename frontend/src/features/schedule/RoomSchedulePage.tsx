import React from "react";
import { Link, useParams } from "react-router";
import { ArrowUpRight, DoorClosed, LayoutGrid, ListChecks, MoveRight, Pencil, Plus, Printer, UsersRound } from "lucide-react";
import { useMe } from "@/api/auth";
import { downloadFile } from "@/api/client";
import { useRoomSchedule } from "@/api/schedule";
import { useSelectedTerm } from "@/context/selectedTerm";
import { ROLES } from "@/lib/navigation";
import { DAY_NAMES, formatTime, WEEK_DAYS } from "@/lib/schedule";
import type { RoomSchedule } from "@/types/api";
import ClassFormSheet, { type ClassTarget } from "@/features/schedule/builder/ClassFormSheet";
import { AddSectionToRoomSheet, RoomLogSheet } from "@/features/schedule/builder/RoomSheets";
import FormAlert from "@/components/global-component/FormAlert";
import { Chip, ChipRow, Crumbs, DayHeader, DetailHeader, Minutes, SectionHeading, TermTabs } from "@/components/global-component/ScheduleUi";
import { Button } from "@/components/ui/button";

type RoomEntry = RoomSchedule["entries"][number];

/** One class in the room: section, time, minutes, subject and teacher, and Edit. */
const ClassCard = ({ entry, onEdit }: { entry: RoomEntry; onEdit?: () => void }) => (
  <article className="flex flex-col rounded-xl border bg-background p-4 shadow-sm">
    <div className="flex items-start justify-between gap-2 border-b pb-3">
      <div className="min-w-0">
        {entry.can_open ? (
          <Link to={`/schedule/sections/${entry.section_id}`} className="inline-flex min-h-11 items-center gap-1 font-semibold text-neutral-900 underline-offset-2 hover:underline">
            {entry.section}
            <ArrowUpRight className="size-4 shrink-0" />
          </Link>
        ) : (
          <p className="font-semibold text-neutral-900">{entry.section}</p>
        )}
        <p className="flex items-center gap-1 text-sm text-neutral-700">
          {formatTime(entry.start_time)}
          <MoveRight className="size-4" aria-label="to" />
          {formatTime(entry.end_time)}
        </p>
      </div>
      <Minutes minutes={entry.minutes} />
    </div>
    <div className="flex flex-1 items-center gap-3 py-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[#790D16]/10 text-branding">
        <LayoutGrid className="size-4" />
      </span>
      <div className="min-w-0 text-sm">
        <p className="font-medium text-neutral-900">{entry.subject ?? "Open slot"}</p>
        <p className="text-neutral-700">{entry.teacher ?? "No teacher yet"}</p>
      </div>
    </div>
    {onEdit && (
      <Button type="button" variant="secondary" className="h-11 w-full" aria-label={`Edit ${entry.section}, ${formatTime(entry.start_time)}`} onClick={onEdit}>
        <Pencil />
        Edit
      </Button>
    )}
  </article>
);

/** A classroom: the sections that use it, and its classes day by day, which can be added and changed here. */
const RoomSchedulePage = () => {
  const roomId = Number(useParams().roomId);
  const { term } = useSelectedTerm();
  const { data: me } = useMe();
  const { data, isPending, isError } = useRoomSchedule(term?.id, roomId);
  const [search, setSearch] = React.useState<Record<number, string>>({});
  const [adding, setAdding] = React.useState<number | null>(null);
  const [editing, setEditing] = React.useState<ClassTarget | null>(null);
  const [isAddingSection, setIsAddingSection] = React.useState(false);
  const [isLogOpen, setIsLogOpen] = React.useState(false);
  const [printError, setPrintError] = React.useState<string | null>(null);
  const canPlot = !!me?.role && ROLES.STAFF.includes(me.role);

  const crumbs = [{ label: "Home", to: "/dashboard" }, { label: "Schedule", to: "/schedule" }, { label: data?.room.label ?? "Room" }];

  if (isError) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <Crumbs items={crumbs} />
        <FormAlert>This room could not be loaded.</FormAlert>
      </div>
    );
  }

  if (isPending || !data || !term) {
    return <p className="p-6 text-sm text-neutral-600">Loading...</p>;
  }

  const print = () => {
    setPrintError(null);
    downloadFile(`/terms/${term.id}/reports/rooms/${roomId}/schedule.pdf`).catch((problem: Error) => setPrintError(problem.message));
  };

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <Crumbs items={crumbs} />

      <DetailHeader
        icon={DoorClosed}
        title={data.room.label}
        subtitle={[data.room.room_name, data.room.building, data.room.in_charge ? `In charge: ${data.room.in_charge}` : null, data.room.capacity ? `Seats ${data.room.capacity}` : null].filter(Boolean).join(" · ")}
        actions={
          <>
            {canPlot && (
              <Button type="button" className="h-11" onClick={() => setIsAddingSection(true)}>
                <Plus />
                Section
              </Button>
            )}
            <Button type="button" variant="outline" size="icon" className="size-11" aria-label="Print the room schedule" title="Print" onClick={print}>
              <Printer />
            </Button>
            <Button type="button" variant="outline" size="icon" className="size-11" aria-label="Room schedule log" title="Log" onClick={() => setIsLogOpen(true)}>
              <ListChecks />
            </Button>
          </>
        }
      />
      {printError && <FormAlert>{printError}</FormAlert>}

      <ChipRow label="Sections" chips={data.sections.map((section) => <Chip key={section}>{section}</Chip>)} />

      <TermTabs />

      <SectionHeading title="Daily Schedule" term={term}>
        Plan and manage the week of this room. Add a class, choose its section, time, subject and teacher.
      </SectionHeading>

      <div className="space-y-6">
        {WEEK_DAYS.map((day) => {
          const query = (search[day] ?? "").trim().toLowerCase();
          const classes = data.entries.filter((entry) => entry.day === day);
          const shown = classes.filter((entry) => `${entry.section} ${entry.subject ?? ""} ${entry.teacher ?? ""}`.toLowerCase().includes(query));
          const sectionCount = new Set(classes.map(({ section_id: id }) => id)).size;

          return (
            <section key={day} aria-label={DAY_NAMES[day]} className="space-y-3">
              <DayHeader
                day={DAY_NAMES[day]}
                icon={UsersRound}
                count={sectionCount}
                noun={sectionCount === 1 ? "Section onboard" : "Sections onboard"}
                search={search[day] ?? ""}
                onSearch={classes.length > 0 ? (value) => setSearch({ ...search, [day]: value }) : undefined}
                onAdd={canPlot ? () => setAdding(day) : undefined}
                addLabel={`Add a class on ${DAY_NAMES[day]}`}
              />
              {classes.length === 0 ? (
                <p className="text-sm text-neutral-600">This room is free all day.</p>
              ) : shown.length === 0 ? (
                <p className="text-sm text-neutral-600">Nothing matches your search.</p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {shown.map((entry) => (
                    <ClassCard
                      key={entry.id}
                      entry={entry}
                      onEdit={
                        canPlot && entry.can_open
                          ? () =>
                              setEditing({
                                sectionId: entry.section_id,
                                day,
                                start_time: entry.start_time,
                                end_time: entry.end_time,
                                section_subject_id: null,
                                room_id: roomId,
                              })
                          : undefined
                      }
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {adding !== null && <ClassFormSheet termId={term.id} day={adding} roomId={roomId} onClose={() => setAdding(null)} />}
      {editing && <ClassFormSheet termId={term.id} day={editing.day} roomId={roomId} editing={editing} onClose={() => setEditing(null)} />}
      {isAddingSection && <AddSectionToRoomSheet term={term} roomId={roomId} roomLabel={data.room.label} onClose={() => setIsAddingSection(false)} />}
      {isLogOpen && <RoomLogSheet schedule={data} onClose={() => setIsLogOpen(false)} />}
    </div>
  );
};

export default RoomSchedulePage;
