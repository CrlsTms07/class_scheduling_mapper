import React from "react";
import {
  conflictDetailsOf,
  useAssignSlot,
  useClearSlot,
} from "@/api/schedule";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { DAY_NAMES, entryAt, hasSubject, isLocked, slotTimeLabel } from "@/lib/schedule";
import { apiErrorMessage } from "@/lib/forms";
import type { DayPattern, Plotter, TimeSlot } from "@/types/api";
import FormAlert from "@/components/global-component/FormAlert";
import { Button } from "@/components/ui/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export type SheetTarget = {
  pattern: DayPattern;
  slot: TimeSlot;
  day: number;
  /** A choice already made, such as from a tap-to-assign that hit a conflict. */
  loadingId?: number | null;
  days?: number[];
  error?: unknown;
};

type EntrySheetProp = {
  target: SheetTarget;
  plotter: Plotter;
  termId: number;
  onClose: () => void;
};

const SELECT_CLASS = "w-full [&_select]:h-11";

const EntrySheet = ({ target, plotter, termId, onClose }: EntrySheetProp) => {
  const { pattern, slot, day } = target;
  const isPhonePortrait = useMediaQuery("(orientation: portrait) and (max-width: 767px)");
  const sectionId = plotter.section.id;
  const assign = useAssignSlot(termId, sectionId);
  const clear = useClearSlot(termId, sectionId);

  const currentEntry = entryAt(plotter.entries, day, slot);
  // JHS usually keeps a subject across the pattern; SHS changes it day by day.
  // Days that already have a subject stay as they are, unless the user turns them on.
  const defaultDays = (plotter.section.level === "JHS" ? pattern.days : [day]).filter(
    (item) => item === day || !hasSubject(entryAt(plotter.entries, item, slot)),
  );

  const [loadingId, setLoadingId] = React.useState<number | null>(
    target.loadingId ?? currentEntry?.section_subject_id ?? null,
  );
  const [roomId, setRoomId] = React.useState<number | null>(
    currentEntry?.room_id ?? plotter.section.home_room_id,
  );
  const [days, setDays] = React.useState<number[]>(
    target.days ?? (hasSubject(currentEntry) ? [day] : defaultDays),
  );
  const [error, setError] = React.useState<unknown>(target.error ?? null);
  const [validation, setValidation] = React.useState<string | null>(null);

  const selectedLoading = plotter.loading.find(({ id }) => id === loadingId);
  const conflict = conflictDetailsOf(error);
  const isBusy = assign.isPending || clear.isPending;
  const isCurrentLocked = currentEntry ? isLocked(currentEntry) : false;

  const toggleDay = (patternDay: number) =>
    setDays((current) =>
      current.includes(patternDay)
        ? current.filter((item) => item !== patternDay)
        : [...current, patternDay].sort(),
    );

  const handleSave = () => {
    setError(null);
    setValidation(null);

    if (!loadingId || !roomId || days.length === 0) {
      setValidation("Choose a subject, a room and at least one day.");
      return;
    }

    assign.mutate(
      { slotId: slot.id, section_subject_id: loadingId, room_id: roomId, days },
      { onSuccess: onClose, onError: setError },
    );
  };

  const handleRemove = () => {
    setError(null);
    setValidation(null);

    if (days.length === 0) {
      setValidation("Choose at least one day to remove.");
      return;
    }

    clear.mutate({ slotId: slot.id, days }, { onSuccess: onClose, onError: setError });
  };

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={isPhonePortrait ? "bottom" : "right"}
        className="max-h-[90dvh] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="text-branding">{slotTimeLabel(slot)}</SheetTitle>
          <SheetDescription>
            {plotter.section.label} · {pattern.name} · {slot.minutes} mins
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-4">
          {validation && <FormAlert>{validation}</FormAlert>}

          {conflict && (
            <div role="alert" className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <p className="font-medium text-destructive">Not saved. This conflicts with:</p>
              <ul className="list-disc space-y-1 pl-4 text-destructive">
                {conflict.conflicts.map((item, index) => (
                  <li key={index}>{item.message}</li>
                ))}
              </ul>
              {conflict.suggestions.slots.length > 0 && (
                <p className="text-xs text-neutral-700">
                  Free periods for this teacher and room:{" "}
                  {conflict.suggestions.slots.map(({ label }) => label).join(", ")}
                </p>
              )}
              {conflict.suggestions.rooms.length > 0 && (
                <div>
                  <p className="text-xs text-neutral-700 mb-1">Free rooms at this time:</p>
                  <div className="flex flex-wrap gap-2">
                    {conflict.suggestions.rooms.map((room) => (
                      <Button
                        key={room.id}
                        type="button"
                        variant="outline"
                        className="h-11"
                        onClick={() => {
                          setRoomId(room.id);
                          setError(null);
                        }}
                      >
                        {room.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {error != null && !conflict && <FormAlert>{apiErrorMessage(error)}</FormAlert>}

          {isCurrentLocked && (
            <FormAlert>
              This entry is {currentEntry?.status} and cannot be changed.
            </FormAlert>
          )}

          <div className="space-y-1">
            <label htmlFor="entry-subject" className="text-sm text-neutral-800">
              Subject
            </label>
            <NativeSelect
              id="entry-subject"
              className={SELECT_CLASS}
              value={loadingId ?? ""}
              disabled={isCurrentLocked}
              onChange={(event) => setLoadingId(Number(event.target.value) || null)}
            >
              <NativeSelectOption value="">Select a subject</NativeSelectOption>
              {plotter.loading.map((item) => (
                <NativeSelectOption key={item.id} value={item.id}>
                  {item.subject} ({item.scheduled_minutes}/{item.required_minutes} mins)
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {selectedLoading && (
              <p className="text-xs text-neutral-600">Teacher: {selectedLoading.teacher}</p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="entry-room" className="text-sm text-neutral-800">
              Room
            </label>
            <NativeSelect
              id="entry-room"
              className={SELECT_CLASS}
              value={roomId ?? ""}
              disabled={isCurrentLocked}
              onChange={(event) => setRoomId(Number(event.target.value) || null)}
            >
              <NativeSelectOption value="">Select a room</NativeSelectOption>
              {plotter.rooms.map((room) => (
                <NativeSelectOption key={room.id} value={room.id}>
                  {room.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          <fieldset className="space-y-1">
            <legend className="text-sm text-neutral-800">Apply to days</legend>
            <div className="flex flex-wrap gap-2">
              {pattern.days.map((patternDay) => {
                const isOn = days.includes(patternDay);
                return (
                  <button
                    key={patternDay}
                    type="button"
                    aria-pressed={isOn}
                    disabled={isCurrentLocked}
                    onClick={() => toggleDay(patternDay)}
                    className={`min-h-11 min-w-14 rounded-md border px-2 text-xs font-medium disabled:opacity-50 ${
                      isOn
                        ? "bg-[#790D16] text-white border-[#790D16]"
                        : "bg-background text-neutral-700"
                    }`}
                  >
                    {DAY_NAMES[patternDay].slice(0, 3)}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="flex flex-col gap-2 pt-2">
            {!isCurrentLocked && (
              <Button type="button" className="h-11" disabled={isBusy} onClick={handleSave}>
                {assign.isPending ? "Saving..." : "Save"}
              </Button>
            )}
            {currentEntry && !isCurrentLocked && (
              <Button
                type="button"
                variant="destructive"
                className="h-11"
                disabled={isBusy}
                onClick={handleRemove}
              >
                {clear.isPending ? "Removing..." : "Remove from selected days"}
              </Button>
            )}
            <Button type="button" variant="outline" className="h-11" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default EntrySheet;
