import { Lock, MoveRight, Pencil, Plus, UserRound } from "lucide-react";
import { DAY_NAMES, entryAt, formatTime, hasSubject, isLocked, slotTimeLabel, subjectColor, WEEK_DAYS } from "@/lib/schedule";
import type { DayPattern, ScheduleEntry, TimeSlot } from "@/types/api";
import { Badge } from "@/components/ui/badge";
import SlotDropZone from "./SlotDropZone";
import { useEntryDrag } from "./useEntryDrag";

const TimeRange = ({ slot }: { slot: TimeSlot }) => (
  <span className="flex items-center gap-1 text-xs">
    {formatTime(slot.start_time)}
    <MoveRight className="size-4" />
    {formatTime(slot.end_time)}
  </span>
);

type SlotCardProp = {
  slot: TimeSlot;
  day: number;
  entry: ScheduleEntry | undefined;
  onSelect?: () => void;
};

const SlotCard = ({ slot, day, entry, onSelect }: SlotCardProp) => {
  const { dragRef, dragListeners, dragClasses } = useEntryDrag(entry, slot, day, onSelect !== undefined);

  const content = (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="flex items-center gap-1 font-bold text-sm">
            {entry ? (entry.subject ?? "Open slot") : "No subject yet"}
            {entry && isLocked(entry) && <Lock className="size-3 shrink-0" aria-label={entry.status} />}
          </span>
          <TimeRange slot={slot} />
        </span>
        <Badge className="bg-[#790D16] text-white shrink-0">{slot.minutes} mins</Badge>
      </span>

      {entry ? (
        <span className="mt-2 block border-t border-current/20 pt-2 text-xs">
          <span className="flex items-center gap-1">
            <UserRound className="size-3.5 shrink-0" />
            {entry.teacher ?? "No teacher yet"}
          </span>
          {entry.room && <span className="block opacity-80">{entry.room}</span>}
          {onSelect && (
            <span className="mt-1 flex items-center gap-1 font-medium">
              <Pencil className="size-3.5" />
              Edit
            </span>
          )}
        </span>
      ) : (
        onSelect && (
          <span className="mt-2 flex items-center gap-1 border-t border-neutral-200 pt-2 text-xs font-medium text-branding">
            <Plus className="size-3.5" />
            Add subject
          </span>
        )
      )}
    </>
  );

  const classes = `block w-full h-full min-h-11 rounded-lg border p-3 text-left ${
    entry ? subjectColor(entry.section_subject_id) : "border-dashed border-neutral-300 bg-background"
  }`;

  if (!onSelect) {
    return <div className={classes}>{content}</div>;
  }

  return (
    <button
      ref={dragRef}
      type="button"
      aria-label={`${DAY_NAMES[day]}, ${slotTimeLabel(slot)}`}
      onClick={onSelect}
      {...dragListeners}
      className={`${classes} cursor-pointer hover:brightness-95 focus-visible:outline-2 focus-visible:outline-[#790D16] ${dragClasses}`}
    >
      {content}
    </button>
  );
};

type ScheduleDayCardsProp = {
  patterns: DayPattern[];
  entries: ScheduleEntry[];
  onSelect?: (slot: TimeSlot, day: number) => void;
};

/** Monday to Friday, one after the other, with a card for each period and break of the day. */
const ScheduleDayCards = ({ patterns, entries, onSelect }: ScheduleDayCardsProp) => (
  <div className="space-y-6">
    {WEEK_DAYS.map((day) => {
      const pattern = patterns.find(({ days }) => days.includes(day));
      const subjects = new Set(
        entries
          .filter((entry) => entry.day === day && entry.section_subject_id !== null)
          .map(({ section_subject_id: id }) => id),
      ).size;

      return (
        <section key={day} aria-label={DAY_NAMES[day]} className="space-y-2">
          <div className="flex items-center gap-3 border-y p-2">
            <p className="font-bold text-branding">{DAY_NAMES[day]}</p>
            <p className="text-xs text-neutral-700">
              <span className="text-lg font-bold text-teal-700">{subjects}</span>{" "}
              {subjects === 1 ? "subject" : "subjects"}
            </p>
          </div>

          {!pattern && (
            <p className="text-sm text-neutral-700">No bell schedule covers {DAY_NAMES[day]}.</p>
          )}

          <ul className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3">
            {pattern?.slots.map((slot) => (
              <li key={slot.id}>
                {slot.is_break ? (
                  <div className="flex h-full min-h-11 items-center justify-between gap-2 rounded-lg bg-neutral-200 p-3">
                    <span>
                      <span className="block font-bold text-sm">{slot.label ?? "Break"}</span>
                      <TimeRange slot={slot} />
                    </span>
                    <Badge className="bg-[#790D16] text-white shrink-0">{slot.minutes} mins</Badge>
                  </div>
                ) : (
                  <SlotDropZone
                    slot={slot}
                    day={day}
                    isDisabled={!onSelect || hasSubject(entryAt(entries, day, slot))}
                  >
                    <SlotCard
                      slot={slot}
                      day={day}
                      entry={entryAt(entries, day, slot)}
                      onSelect={onSelect && (() => onSelect(slot, day))}
                    />
                  </SlotDropZone>
                )}
              </li>
            ))}
          </ul>
        </section>
      );
    })}
  </div>
);

export default ScheduleDayCards;
