import { DAY_NAMES, entryAt, hasSubject, slotTimeLabel } from "@/lib/schedule";
import type { DayPattern, ScheduleEntry, TimeSlot } from "@/types/api";
import ScheduleCell from "./ScheduleCell";
import SlotDropZone from "./SlotDropZone";

type ScheduleGridProp = {
  pattern: DayPattern;
  entries: ScheduleEntry[];
  onSelect?: (slot: TimeSlot, day: number) => void;
};

/** Weekly grid for wide screens: a sticky time column, one column per day. */
const ScheduleGrid = ({ pattern, entries, onSelect }: ScheduleGridProp) => {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[40rem] border-collapse text-sm">
        <thead>
          <tr className="bg-neutral-100">
            <th className="sticky left-0 z-[1] bg-neutral-100 p-2 text-left text-xs font-medium w-32">
              Time
            </th>
            {pattern.days.map((day) => (
              <th key={day} className="p-2 text-xs font-medium">
                {DAY_NAMES[day]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pattern.slots.map((slot) => (
            <tr key={slot.id} className="border-t">
              <th className="sticky left-0 z-[1] bg-background p-2 text-left font-normal text-xs whitespace-nowrap">
                {slotTimeLabel(slot)}
                <span className="block text-[11px] text-neutral-500">
                  {slot.minutes} mins
                </span>
              </th>
              {slot.is_break ? (
                <td
                  colSpan={pattern.days.length}
                  className="bg-neutral-200 p-2 text-center text-xs font-bold tracking-wide"
                >
                  {slot.label?.toUpperCase()}
                </td>
              ) : (
                pattern.days.map((day) => {
                  const entry = entryAt(entries, day, slot);

                  return (
                    <td key={day} className="p-1 h-px align-top">
                      <SlotDropZone slot={slot} day={day} isDisabled={!onSelect || hasSubject(entry)}>
                        <ScheduleCell
                          entry={entry}
                          slot={slot}
                          day={day}
                          label={`${DAY_NAMES[day]}, ${slotTimeLabel(slot)}`}
                          onSelect={onSelect && (() => onSelect(slot, day))}
                        />
                      </SlotDropZone>
                    </td>
                  );
                })
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ScheduleGrid;
