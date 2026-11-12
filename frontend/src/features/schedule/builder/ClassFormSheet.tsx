import React from "react";
import { usePlotter, useSections } from "@/api/schedule";
import { conflictDetailsOf } from "@/api/schedule";
import { usePlaceClass, useRemoveClass, useResolvePeriod } from "@/api/scheduleBuilder";
import { useChangeTeacher, useSectionLoading } from "@/api/teacherLoading";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { apiErrorMessage } from "@/lib/forms";
import { DAY_NAMES } from "@/lib/schedule";
import FormAlert from "@/components/global-component/FormAlert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/** The class being changed: where it is now. */
export type ClassTarget = {
  sectionId: number;
  day: number;
  start_time: string;
  end_time: string;
  section_subject_id: number | null;
  room_id: number | null;
};

type ClassFormSheetProp = {
  termId: number;
  day: number;
  /** From a room page: the room is fixed and the section is chosen. */
  roomId?: number;
  /** From a section page: the section is fixed and the room is chosen. */
  sectionId?: number;
  /** Set when editing. */
  editing?: ClassTarget;
  onClose: () => void;
};

const hhmm = (time: string) => time.slice(0, 5);

/**
 * Add or edit one class on one day: section, start and end time, subject, teacher and room. A time
 * that is not a period yet becomes one in the bell schedule, so every rule still applies.
 */
const ClassFormSheet = ({ termId, day, roomId, sectionId: fixedSection, editing, onClose }: ClassFormSheetProp) => {
  const isPhonePortrait = useMediaQuery("(orientation: portrait) and (max-width: 767px)");
  // From a section page the section is known, so the list is not needed.
  const { data: sections = [] } = useSections(fixedSection ? undefined : termId);
  const [sectionId, setSectionId] = React.useState<number | "">(editing?.sectionId ?? fixedSection ?? "");
  const [start, setStart] = React.useState(editing ? hhmm(editing.start_time) : "");
  const [end, setEnd] = React.useState(editing ? hhmm(editing.end_time) : "");
  const [loadingId, setLoadingId] = React.useState<number | "">(editing?.section_subject_id ?? "");
  const [teacherId, setTeacherId] = React.useState<number | "">("");
  const [chosenRoom, setChosenRoom] = React.useState<number | "">(editing?.room_id ?? roomId ?? "");
  const [error, setError] = React.useState<string | null>(null);

  const chosen = sectionId === "" ? 0 : sectionId;
  const { data: plotter } = usePlotter(chosen ? termId : undefined, chosen);
  const { data: loadingInfo } = useSectionLoading(chosen ? termId : undefined, chosen || undefined);
  const resolve = useResolvePeriod(termId);
  const place = usePlaceClass(termId);
  const remove = useRemoveClass(termId);
  const changeTeacher = useChangeTeacher(termId, chosen);

  // Opened from a room, the class's subject is read from the section's own schedule.
  const editedEntry = editing
    ? plotter?.entries.find((entry) => entry.day === editing.day && hhmm(entry.start_time) === hhmm(editing.start_time))
    : undefined;
  const shownLoading = loadingId === "" ? (editedEntry?.section_subject_id ?? "") : loadingId;
  const loadingRow = plotter?.loading.find(({ id }) => id === shownLoading);
  const room = roomId ?? (chosenRoom === "" ? plotter?.section.home_room_id ?? "" : chosenRoom);
  const shownTeacher = teacherId === "" ? loadingRow?.teacher_id ?? "" : teacherId;
  const isBusy = resolve.isPending || place.isPending || remove.isPending || changeTeacher.isPending;
  const canSave = chosen && start && end && loadingRow && room !== "";

  // The slot of a class already placed, found in the section's bell schedule.
  const slotOf = (target: ClassTarget) =>
    plotter?.patterns
      .filter(({ days }) => days.includes(target.day))
      .flatMap(({ slots }) => slots)
      .find((slot) => hhmm(slot.start_time) === hhmm(target.start_time) && hhmm(slot.end_time) === hhmm(target.end_time));

  const save = async () => {
    if (!canSave || !loadingRow) return;
    setError(null);
    try {
      if (shownTeacher !== "" && shownTeacher !== loadingRow.teacher_id) {
        await changeTeacher.mutateAsync({ subjectId: loadingRow.subject_id, teacherId: Number(shownTeacher) });
      }
      const { data } = await resolve.mutateAsync({ sectionId: chosen, days: [day], start_time: start, end_time: end });
      const slotId = data.slots[String(day)];
      await place.mutateAsync({ sectionId: chosen, slotId, section_subject_id: loadingRow.id, room_id: Number(room), days: [day] });

      // A new time: take the class off its old period.
      const old = editing && slotOf(editing);
      if (editing && old && old.id !== slotId) {
        await remove.mutateAsync({ sectionId: editing.sectionId, slotId: old.id, days: [day] });
      }
      onClose();
    } catch (problem) {
      const conflict = conflictDetailsOf(problem);
      setError(conflict ? conflict.conflicts.map(({ message }) => message).join(" ") : apiErrorMessage(problem));
    }
  };

  const deleteClass = async () => {
    const old = editing && slotOf(editing);
    if (!editing || !old) return;
    setError(null);
    try {
      await remove.mutateAsync({ sectionId: editing.sectionId, slotId: old.id, days: [day] });
      onClose();
    } catch (problem) {
      setError(apiErrorMessage(problem));
    }
  };

  const dayName = DAY_NAMES[day];

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side={isPhonePortrait ? "bottom" : "right"} className="max-h-dvh overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{editing ? `Edit class for ${dayName}` : `Add class for ${dayName}`}</SheetTitle>
          <SheetDescription>
            {editing ? "Change this class, or delete it." : "Fill out all the fields to add a class."} A new time becomes a period of the bell
            schedule.
          </SheetDescription>
        </SheetHeader>

        <form
          noValidate
          className="space-y-4 px-4 pb-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          {error && <FormAlert>{error}</FormAlert>}

          <div className="space-y-1">
            <label htmlFor="class-section" className="text-sm font-medium text-neutral-900">
              Section
            </label>
            <NativeSelect
              id="class-section"
              className="w-full [&_select]:h-11"
              value={sectionId}
              disabled={!!fixedSection || !!editing}
              onChange={(event) => {
                setSectionId(event.target.value === "" ? "" : Number(event.target.value));
                setLoadingId("");
                setTeacherId("");
              }}
            >
              <NativeSelectOption value="">Select a section</NativeSelectOption>
              {fixedSection && plotter && <NativeSelectOption value={fixedSection}>{plotter.section.label}</NativeSelectOption>}
              {sections.map(({ id, grade, name }) => (
                <NativeSelectOption key={id} value={id}>
                  Grade {grade} – {name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="class-start" className="text-sm font-medium text-neutral-900">
                Start time
              </label>
              <Input id="class-start" type="time" className="h-11" value={start} onChange={(event) => setStart(event.target.value)} />
            </div>
            <div className="space-y-1">
              <label htmlFor="class-end" className="text-sm font-medium text-neutral-900">
                End time
              </label>
              <Input id="class-end" type="time" className="h-11" value={end} onChange={(event) => setEnd(event.target.value)} />
            </div>
          </div>
          {plotter && plotter.patterns.some(({ days }) => days.includes(day)) && (
            <div className="space-y-1">
              <p className="text-xs text-neutral-600">Or use a period of the bell schedule:</p>
              <div className="flex flex-wrap gap-1">
                {plotter.patterns
                  .filter(({ days }) => days.includes(day))
                  .flatMap(({ slots }) => slots)
                  .filter(({ is_break: isBreak }) => !isBreak)
                  .map((slot) => (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => {
                        setStart(hhmm(slot.start_time));
                        setEnd(hhmm(slot.end_time));
                      }}
                      className={`min-h-11 rounded-md border px-3 text-xs ${
                        hhmm(slot.start_time) === start && hhmm(slot.end_time) === end ? "border-[#790D16] bg-[#790D16]/10 text-branding" : "text-neutral-700"
                      }`}
                    >
                      {hhmm(slot.start_time)}–{hhmm(slot.end_time)}
                    </button>
                  ))}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label htmlFor="class-subject" className="text-sm font-medium text-neutral-900">
              Subject
            </label>
            <NativeSelect
              id="class-subject"
              className="w-full [&_select]:h-11"
              value={shownLoading}
              disabled={!chosen}
              onChange={(event) => {
                setLoadingId(event.target.value === "" ? "" : Number(event.target.value));
                setTeacherId("");
              }}
            >
              <NativeSelectOption value="">{chosen ? "Select a subject" : "Choose the section first"}</NativeSelectOption>
              {plotter?.loading.map(({ id, subject }) => (
                <NativeSelectOption key={id} value={id}>
                  {subject}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {plotter && plotter.loading.length === 0 && (
              <p className="text-xs text-amber-900">This section has no teacher loading yet. Add its subjects in Teacher Loading first.</p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="class-teacher" className="text-sm font-medium text-neutral-900">
              Teacher
            </label>
            <NativeSelect
              id="class-teacher"
              className="w-full [&_select]:h-11"
              value={shownTeacher}
              disabled={!loadingRow}
              onChange={(event) => setTeacherId(event.target.value === "" ? "" : Number(event.target.value))}
            >
              <NativeSelectOption value="">Select a teacher</NativeSelectOption>
              {(loadingInfo?.teachers ?? []).map(({ id, name }) => (
                <NativeSelectOption key={id} value={id}>
                  {name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <p className="text-xs text-neutral-600">Changing the teacher changes it for all classes of this subject in the section.</p>
          </div>

          {roomId === undefined && (
            <div className="space-y-1">
              <label htmlFor="class-room" className="text-sm font-medium text-neutral-900">
                Room
              </label>
              <NativeSelect
                id="class-room"
                className="w-full [&_select]:h-11"
                value={room}
                disabled={!chosen}
                onChange={(event) => setChosenRoom(event.target.value === "" ? "" : Number(event.target.value))}
              >
                <NativeSelectOption value="">Select a room</NativeSelectOption>
                {plotter?.rooms.map(({ id, label }) => (
                  <NativeSelectOption key={id} value={id}>
                    {label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <Button type="submit" className="h-11" disabled={!canSave || isBusy}>
              {isBusy ? "Saving..." : editing ? "Save changes" : "Add class"}
            </Button>
            {editing && (
              <Button type="button" variant="outline" className="h-11 border-red-200 bg-red-50 text-destructive hover:bg-red-100" disabled={isBusy} onClick={() => void deleteClass()}>
                Delete
              </Button>
            )}
            <Button type="button" variant="outline" className="h-11" onClick={onClose}>
              Close
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default ClassFormSheet;
