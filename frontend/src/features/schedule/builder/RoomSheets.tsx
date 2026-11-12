import React from "react";
import { ListChecks } from "lucide-react";
import { useManagedSections } from "@/api/sections";
import { useSetSectionRoom } from "@/api/scheduleBuilder";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { apiErrorMessage } from "@/lib/forms";
import { DAY_NAMES, formatTime, WEEK_DAYS } from "@/lib/schedule";
import type { RoomSchedule, Term } from "@/types/api";
import FormAlert from "@/components/global-component/FormAlert";
import { Minutes } from "@/components/global-component/ScheduleUi";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const useSide = () => (useMediaQuery("(orientation: portrait) and (max-width: 767px)") ? "bottom" : "right");

/** "Section List": choose a grade level and a section; this room becomes its home or usual room. */
export const AddSectionToRoomSheet = ({ term, roomId, roomLabel, onClose }: { term: Term; roomId: number; roomLabel: string; onClose: () => void }) => {
  const side = useSide();
  const { data: sections = [] } = useManagedSections(term.school_year.id);
  const setRoom = useSetSectionRoom(term.id);
  const [grade, setGrade] = React.useState("");
  const [sectionId, setSectionId] = React.useState("");
  const grades = [...new Set(sections.map((section) => section.grade))].sort((a, b) => a - b);
  const shown = sections.filter((section) => grade === "" || section.grade === Number(grade));

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side={side} className="max-h-dvh overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Section list</SheetTitle>
          <SheetDescription>Choose a section to use {roomLabel}. It becomes the room its classes use by default.</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-4">
          {setRoom.isError && <FormAlert>{apiErrorMessage(setRoom.error)}</FormAlert>}
          <div className="space-y-1">
            <label htmlFor="room-grade" className="text-sm font-medium text-neutral-900">
              Grade level
            </label>
            <NativeSelect id="room-grade" className="w-full [&_select]:h-11" value={grade} onChange={(event) => { setGrade(event.target.value); setSectionId(""); }}>
              <NativeSelectOption value="">Select a grade level</NativeSelectOption>
              {grades.map((item) => (
                <NativeSelectOption key={item} value={item}>
                  Grade {item}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1">
            <label htmlFor="room-section" className="text-sm font-medium text-neutral-900">
              Section
            </label>
            <NativeSelect id="room-section" className="w-full [&_select]:h-11" value={sectionId} onChange={(event) => setSectionId(event.target.value)}>
              <NativeSelectOption value="">Select a class section</NativeSelectOption>
              {shown.map((section) => (
                <NativeSelectOption key={section.id} value={section.id}>
                  {section.label}
                  {section.home_room ? ` (now ${section.home_room})` : ""}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <Button
              type="button"
              className="h-11"
              disabled={sectionId === "" || setRoom.isPending}
              onClick={() => setRoom.mutate({ sectionId: Number(sectionId), roomId }, { onSuccess: onClose })}
            >
              {setRoom.isPending ? "Saving..." : "Submit"}
            </Button>
            <Button type="button" variant="outline" className="h-11" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

/** "Room Schedule Log": which sections use the room each day, with their times. */
export const RoomLogSheet = ({ schedule, onClose }: { schedule: RoomSchedule; onClose: () => void }) => {
  const side = useSide();

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side={side} className="max-h-dvh overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Room schedule log</SheetTitle>
          <SheetDescription>Which sections use this room each day, with their times.</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-4">
          {schedule.entries.length === 0 ? (
            <div className="space-y-2 py-10 text-center text-sm text-neutral-700">
              <ListChecks className="mx-auto size-6 text-branding" />
              <p>The classes of this room will be listed here.</p>
            </div>
          ) : (
            WEEK_DAYS.map((day) => {
              const classes = schedule.entries.filter((entry) => entry.day === day);
              if (classes.length === 0) return null;

              return (
                <section key={day} className="space-y-2">
                  <h3 className="font-medium text-neutral-900">{DAY_NAMES[day]}</h3>
                  <ul className="divide-y rounded-lg border">
                    {classes.map((entry) => (
                      <li key={entry.id} className="flex items-center justify-between gap-2 p-2 text-sm">
                        <span className="min-w-0">
                          <span className="block font-medium text-neutral-900">{entry.section}</span>
                          <span className="block text-xs text-neutral-600">
                            {formatTime(entry.start_time)} – {formatTime(entry.end_time)}
                            {entry.subject && ` · ${entry.subject}`}
                          </span>
                        </span>
                        <Minutes minutes={entry.minutes} />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })
          )}
          <Button type="button" className="h-11 w-full" onClick={onClose}>
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
