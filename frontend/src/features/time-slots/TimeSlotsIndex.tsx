import React from "react";
import { Clock, Copy, Pencil, Plus } from "lucide-react";
import { useMe } from "@/api/auth";
import { useDayPatterns } from "@/api/timeSlots";
import { useSelectedTerm } from "@/context/selectedTerm";
import { DAY_NAMES, slotTimeLabel } from "@/lib/schedule";
import {
  daysWithoutSchedule,
  LEVELS,
  minutesTotals,
  SHIFT_LABELS,
  SHIFTS,
  slotName,
} from "@/lib/timeSlots";
import type { ManagedPattern, SchoolLevel, Shift } from "@/types/api";
import PageHeader from "@/components/global-component/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import PatternSheet, { type PatternAction } from "./PatternSheet";
import PresetSheet from "./PresetSheet";
import SlotSheet, { type SlotAction } from "./SlotSheet";

const HOW_IT_WORKS = [
  "A bell schedule is a timetable shared by some days, like Monday – Thursday and Friday.",
  "Each department and shift has its own. Pick them above, then add a bell schedule and its days.",
  "Add its class periods and breaks. Period numbers follow the order of the day by themselves.",
  "Once a section has schedules on a period, its times lock so those schedules stay correct.",
];

type PatternCardProp = {
  pattern: ManagedPattern;
  onPattern: (action: PatternAction) => void;
  onSlot: (action: SlotAction) => void;
};

const PatternCard = ({ pattern, onPattern, onSlot }: PatternCardProp) => {
  const { classMinutes, breakMinutes } = minutesTotals(pattern);
  const [isPresetOpen, setIsPresetOpen] = React.useState(false);

  return (
    <Card className="shadow shadow-[#790D16]/40">
      <CardContent className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <p className="text-teal-700 font-bold text-base">{pattern.name}</p>
            <p className="text-xs text-neutral-700">
              {pattern.days.map((day) => DAY_NAMES[day]).join(", ")}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => onPattern({ mode: "edit", pattern })}
            >
              <Pencil />
              Edit
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => onPattern({ mode: "copy", pattern })}
            >
              <Copy />
              Copy
            </Button>
          </div>
        </div>

        {pattern.slots.length === 0 ? (
          <div className="space-y-2 border-t pt-3">
            <p className="text-sm text-neutral-700">
              No periods yet. Use a preset of 8, 10, 14 or 16 rows, or add them one by one below.
            </p>
            <Button type="button" className="h-11 w-full sm:w-auto" onClick={() => setIsPresetOpen(true)}>
              <Clock />
              Use a preset
            </Button>
            {isPresetOpen && <PresetSheet pattern={pattern} onClose={() => setIsPresetOpen(false)} />}
          </div>
        ) : (
          <ul className="divide-y border-t">
            {pattern.slots.map((slot) => (
              <li
                key={slot.id}
                className={`flex items-center justify-between gap-2 px-2 py-1 ${
                  slot.is_break ? "bg-amber-50" : ""
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-900">{slotTimeLabel(slot)}</p>
                  <p className="text-xs text-neutral-700">
                    {slotName(slot)}, {slot.minutes} mins
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11 shrink-0"
                  aria-label={`Edit ${slotName(slot)}, ${slotTimeLabel(slot)}`}
                  onClick={() => onSlot({ mode: "edit", pattern, slot })}
                >
                  <Pencil />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {pattern.slots.length > 0 && (
          <p className="text-xs text-neutral-700">
            Class time: {classMinutes} mins a day. Breaks: {breakMinutes} mins a day.
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={() => onSlot({ mode: "add", pattern, isBreak: false })}
          >
            <Plus />
            Add period
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={() => onSlot({ mode: "add", pattern, isBreak: true })}
          >
            <Plus />
            Add break
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const TimeSlotsIndex = () => {
  const { term, isPending: isTermPending } = useSelectedTerm();
  const year = term?.school_year;
  const { data: patterns, isPending, isError } = useDayPatterns(year?.id);

  const { data: user } = useMe();
  // A Chairperson sets up the Junior High bell schedules, a Master Teacher the Senior High ones.
  const levels = user?.role !== "glc" && user?.role !== "master_teacher"
    ? LEVELS
    : LEVELS.filter((item) => user.grade_levels.some((grade) => grade.level === item));
  const [chosenLevel, setLevel] = React.useState<SchoolLevel>("JHS");
  const level = levels.includes(chosenLevel) ? chosenLevel : (levels[0] ?? "JHS");
  const [shift, setShift] = React.useState<Shift>("WHOLE_DAY");
  const [patternAction, setPatternAction] = React.useState<PatternAction | null>(null);
  const [slotAction, setSlotAction] = React.useState<SlotAction | null>(null);

  const shown = (patterns ?? []).filter(
    (pattern) => pattern.level === level && pattern.shift === shift,
  );
  const missingDays = daysWithoutSchedule(shown);

  if (!year) {
    return (
      <p className="p-6 text-sm text-neutral-700">
        {isTermPending ? "Loading..." : "Start a school year first, on the School Years page."}
      </p>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <PageHeader
        icon={Clock}
        title="Time Slots"
        description={`Bell schedules of SY ${year.name}${levels.length === 1 ? `, ${levels[0] === "SHS" ? "Senior High" : "Junior High"}` : ""}`}
        actions={
          <Button type="button" className="h-11" onClick={() => setPatternAction({ mode: "create", level, shift })}>
            <Plus />
            Add bell schedule
          </Button>
        }
      />

      <details className="rounded-md border bg-background">
        <summary className="flex min-h-11 cursor-pointer items-center p-3 text-sm font-medium">
          How this works
        </summary>
        <ol className="list-decimal space-y-1 px-3 pb-3 pl-8 text-sm text-neutral-700">
          {HOW_IT_WORKS.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      </details>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <div role="tablist" aria-label="Department" className={`grid grid-cols-2 gap-2 sm:w-56 ${levels.length < 2 ? "hidden" : ""}`}>
          {levels.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={item === level}
              onClick={() => setLevel(item)}
              className={`min-h-11 rounded-md border px-4 text-sm font-medium ${
                item === level
                  ? "bg-[#790D16] text-white border-[#790D16]"
                  : "bg-background text-neutral-700"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="space-y-1 sm:w-56">
          <label htmlFor="shift-filter" className="text-sm text-neutral-800">
            Shift
          </label>
          <NativeSelect
            id="shift-filter"
            className="w-full [&_select]:h-11"
            value={shift}
            onChange={(event) => setShift(event.target.value as Shift)}
          >
            {SHIFTS.map((item) => (
              <NativeSelectOption key={item} value={item}>
                {SHIFT_LABELS[item]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>

      {isPending && <p className="text-sm text-neutral-600">Loading...</p>}
      {isError && <p className="text-sm text-destructive">Could not load the bell schedules.</p>}

      {patterns && missingDays.length > 0 && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {level}, {SHIFT_LABELS[shift]}: {missingDays.join(", ")}{" "}
          {missingDays.length === 1 ? "has" : "have"} no bell schedule yet.
        </p>
      )}

      {patterns && shown.length === 0 && (
        <div className="space-y-2 rounded-xl border border-dashed p-6 text-sm text-neutral-700">
          <p className="font-medium text-neutral-900">
            No {level} bell schedule for the {SHIFT_LABELS[shift].toLowerCase()} shift yet
          </p>
          <p>
            {level === "SHS"
              ? "Senior High often has an AM and a PM shift. Choose the shift above, then add a bell schedule for its days, such as Monday – Friday."
              : "Add a bell schedule for each group of days, such as Monday – Thursday and Friday."}{" "}
            Then use a preset of 8, 10, 14 or 16 rows, or add the periods one by one.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        {shown.map((pattern) => (
          <PatternCard
            key={pattern.id}
            pattern={pattern}
            onPattern={setPatternAction}
            onSlot={setSlotAction}
          />
        ))}
      </div>

      {patternAction && (
        <PatternSheet
          yearId={year.id}
          action={patternAction}
          onSaved={(savedLevel, savedShift) => {
            setLevel(savedLevel);
            setShift(savedShift);
            setPatternAction(null);
          }}
          onClose={() => setPatternAction(null)}
        />
      )}

      {slotAction && <SlotSheet action={slotAction} onClose={() => setSlotAction(null)} />}
    </div>
  );
};

export default TimeSlotsIndex;
