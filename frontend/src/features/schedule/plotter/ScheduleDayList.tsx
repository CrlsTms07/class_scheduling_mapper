import { DAY_NAMES, entryAt, slotTimeLabel, WEEK_DAYS } from "@/lib/schedule";
import type { DayPattern, ScheduleEntry, TimeSlot } from "@/types/api";
import ScheduleCell from "./ScheduleCell";

type ScheduleDayListProp = {
  patterns: DayPattern[];
  entries: ScheduleEntry[];
  day: number;
  onDayChange: (day: number) => void;
  onSelect?: (slot: TimeSlot, day: number) => void;
};

/** For phones in portrait: tabs for Monday to Friday, then the periods of that day. */
const ScheduleDayList = ({
  patterns,
  entries,
  day,
  onDayChange,
  onSelect,
}: ScheduleDayListProp) => {
  const pattern = patterns.find(({ days }) => days.includes(day));

  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="Day" className="grid grid-cols-5 gap-1">
        {WEEK_DAYS.map((weekDay) => (
          <button
            key={weekDay}
            type="button"
            role="tab"
            aria-selected={weekDay === day}
            onClick={() => onDayChange(weekDay)}
            className={`min-h-11 rounded-md text-xs font-medium border ${
              weekDay === day
                ? "bg-[#790D16] text-white border-[#790D16]"
                : "bg-background text-neutral-700"
            }`}
          >
            {DAY_NAMES[weekDay].slice(0, 3)}
          </button>
        ))}
      </div>

      {!pattern && (
        <p className="text-sm text-neutral-700">
          No bell schedule covers {DAY_NAMES[day]}.
        </p>
      )}

      <div className="space-y-2">
        {pattern?.slots.map((slot) =>
          slot.is_break ? (
            <div
              key={slot.id}
              className="flex justify-between gap-2 rounded-md bg-neutral-200 p-2 text-xs font-bold"
            >
              <span>{slot.label?.toUpperCase()}</span>
              <span className="font-normal">{slotTimeLabel(slot)}</span>
            </div>
          ) : (
            <div key={slot.id}>
              <p className="text-xs text-neutral-600 mb-1">
                {slotTimeLabel(slot)} · {slot.minutes} mins
              </p>
              <ScheduleCell
                entry={entryAt(entries, day, slot)}
                label={`${DAY_NAMES[day]}, ${slotTimeLabel(slot)}`}
                onSelect={onSelect && (() => onSelect(slot, day))}
              />
            </div>
          ),
        )}
      </div>
    </div>
  );
};

export default ScheduleDayList;
