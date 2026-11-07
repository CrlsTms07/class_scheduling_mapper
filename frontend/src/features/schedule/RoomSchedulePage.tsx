import { Link, useParams } from "react-router";
import { ArrowLeft, ArrowUpRight, DoorClosed, MoveRight, UserRound, UserRoundCheck } from "lucide-react";
import { useRoomSchedule } from "@/api/schedule";
import { useSelectedTerm } from "@/context/selectedTerm";
import { DAY_NAMES, formatTime, WEEK_DAYS } from "@/lib/schedule";
import type { RoomSchedule } from "@/types/api";
import FormAlert from "@/components/global-component/FormAlert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const ClassCard = ({ entry }: { entry: RoomSchedule["entries"][number] }) => (
  <Card>
    <CardContent className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {entry.can_open ? (
            <Link
              to={`/schedule/sections/${entry.section_id}`}
              className="flex min-h-11 items-center gap-1 font-bold underline-offset-2 hover:underline"
            >
              {entry.section}
              <ArrowUpRight className="size-4 shrink-0" />
            </Link>
          ) : (
            <p className="font-bold">{entry.section}</p>
          )}
          <p className="flex items-center gap-1 text-xs">
            {formatTime(entry.start_time)}
            <MoveRight className="size-4" />
            {formatTime(entry.end_time)}
          </p>
        </div>
        <Badge className="bg-[#790D16] text-white shrink-0">{entry.minutes} mins</Badge>
      </div>
      <div className="flex items-center gap-3 border-t pt-3">
        <div className="bg-[#790D16]/20 p-1 rounded-sm">
          <UserRound className="size-5 text-branding" />
        </div>
        <div className="min-w-0 text-xs">
          <p>{entry.subject ?? "Open slot"}</p>
          <p>{entry.teacher ?? "No teacher yet"}</p>
        </div>
      </div>
    </CardContent>
  </Card>
);

/** Who uses a room on each day of the week, in the selected term. */
const RoomSchedulePage = () => {
  const roomId = Number(useParams().roomId);
  const { term } = useSelectedTerm();
  const { data, isPending, isError } = useRoomSchedule(term?.id, roomId);

  const backLink = (
    <Link
      to="/schedule"
      className={buttonVariants({ variant: "link", className: "h-11 px-0 text-xs" })}
    >
      <ArrowLeft />
      All rooms
    </Link>
  );

  if (isError) {
    return (
      <div className="p-4 sm:p-6">
        {backLink}
        <FormAlert>This room could not be loaded.</FormAlert>
      </div>
    );
  }

  if (isPending || !data || !term) {
    return <p className="p-6 text-sm text-neutral-600">Loading...</p>;
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {backLink}

      <div className="flex items-center gap-3">
        <div className="bg-[#790D16]/10 p-2 rounded-sm shrink-0">
          <DoorClosed className="text-branding" />
        </div>
        <div className="min-w-0">
          <p className="text-xl font-bold text-teal-700">{data.room.label}</p>
          <p className="text-neutral-700 text-xs">
            {data.room.room_name && `${data.room.room_name}. `}
            {term.name}, SY {term.school_year.name}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t pt-2">
        <p className="text-xs text-neutral-700">Sections:</p>
        {data.sections.length === 0 && <p className="text-xs text-neutral-500">None yet.</p>}
        {data.sections.map((section) => (
          <Badge key={section} variant="secondary">
            {section}
          </Badge>
        ))}
      </div>

      <div className="space-y-6">
        {WEEK_DAYS.map((day) => {
          const classes = data.entries.filter((entry) => entry.day === day);
          const sectionCount = new Set(classes.map(({ section_id: id }) => id)).size;

          return (
            <section key={day} aria-label={DAY_NAMES[day]} className="space-y-3">
              <div className="flex items-center gap-3 border-y p-2">
                <p className="font-bold text-branding">{DAY_NAMES[day]}</p>
                <div className="flex items-center gap-2">
                  <UserRoundCheck className="size-5 text-neutral-700" />
                  <p className="text-lg font-bold text-teal-700">{sectionCount}</p>
                  <p className="text-xs">{sectionCount === 1 ? "section" : "sections"}</p>
                </div>
              </div>
              {classes.length === 0 ? (
                <p className="text-sm text-neutral-700">This room is free all day.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {classes.map((entry) => (
                    <ClassCard key={entry.id} entry={entry} />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
};

export default RoomSchedulePage;
