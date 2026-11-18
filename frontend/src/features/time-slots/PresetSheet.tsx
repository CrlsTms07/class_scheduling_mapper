import React from "react";
import { usePresetSlots } from "@/api/timeSlots";
import { apiErrorMessage } from "@/lib/forms";
import { formatTime } from "@/lib/schedule";
import { PRESET_ROWS, presetRows, type PresetOptions } from "@/lib/timeSlots";
import type { ManagedPattern } from "@/types/api";
import FormAlert from "@/components/global-component/FormAlert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type PresetSheetProp = {
  pattern: ManagedPattern;
  onClose: () => void;
};

const NUMBER = "h-11";

/**
 * Fills an empty bell schedule at once: 8, 10, 14 or 16 rows, with a recess and a lunch.
 * Each row can still be edited afterwards, like any period.
 */
const PresetSheet = ({ pattern, onClose }: PresetSheetProp) => {
  const save = usePresetSlots(pattern.id);
  const [options, setOptions] = React.useState<PresetOptions>({
    rows: 10,
    start: "07:30",
    periodMinutes: 45,
    recess: { after: 3, minutes: 15 },
    lunch: { after: 5, minutes: 60 },
  });
  const [error, setError] = React.useState<string | null>(null);
  const rows = presetRows(options);

  const numberInput = (id: string, label: string, value: number, onChange: (value: number) => void) => (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm text-neutral-800">
        {label}
      </label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        className={NUMBER}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="max-h-dvh overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-branding">Use a preset</SheetTitle>
          <SheetDescription>{pattern.name}. Every row can still be edited afterwards.</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-4">
          {error && <FormAlert>{error}</FormAlert>}

          <fieldset className="space-y-1">
            <legend className="text-sm text-neutral-800">Rows, periods and breaks together</legend>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_ROWS.map((count) => (
                <button
                  key={count}
                  type="button"
                  aria-pressed={options.rows === count}
                  onClick={() => setOptions({ ...options, rows: count })}
                  className={`min-h-11 rounded-md border text-sm font-medium ${
                    options.rows === count ? "bg-[#790D16] text-white border-[#790D16]" : "bg-background text-neutral-700"
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="preset-start" className="text-sm text-neutral-800">
                First period starts
              </label>
              <Input
                id="preset-start"
                type="time"
                className={NUMBER}
                value={options.start}
                onChange={(event) => setOptions({ ...options, start: event.target.value })}
              />
            </div>
            {numberInput("preset-minutes", "Minutes a period", options.periodMinutes, (value) =>
              setOptions({ ...options, periodMinutes: value }),
            )}
            {numberInput("preset-recess-after", "Recess after period", options.recess.after, (value) =>
              setOptions({ ...options, recess: { ...options.recess, after: value } }),
            )}
            {numberInput("preset-recess-minutes", "Recess minutes (0 = none)", options.recess.minutes, (value) =>
              setOptions({ ...options, recess: { ...options.recess, minutes: value } }),
            )}
            {numberInput("preset-lunch-after", "Lunch after period", options.lunch.after, (value) =>
              setOptions({ ...options, lunch: { ...options.lunch, after: value } }),
            )}
            {numberInput("preset-lunch-minutes", "Lunch minutes (0 = none)", options.lunch.minutes, (value) =>
              setOptions({ ...options, lunch: { ...options.lunch, minutes: value } }),
            )}
          </div>

          {rows ? (
            <ol className="divide-y rounded-md border text-sm" aria-label="Preview">
              {rows.map((row) => (
                <li key={row.start_time} className={`flex justify-between gap-2 px-3 py-1.5 ${row.is_break ? "bg-amber-50" : ""}`}>
                  <span>
                    {formatTime(row.start_time)} – {formatTime(row.end_time)}
                  </span>
                  <span className="text-neutral-700">{row.is_break ? row.label : "Period"}</span>
                </li>
              ))}
            </ol>
          ) : (
            <FormAlert>
              This does not fit: each break must come after one of the periods, and the day must end before midnight.
            </FormAlert>
          )}

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              className="h-11"
              disabled={!rows || save.isPending}
              onClick={() =>
                rows &&
                save.mutate(rows, { onSuccess: onClose, onError: (problem) => setError(apiErrorMessage(problem)) })
              }
            >
              {save.isPending ? "Saving..." : `Create these ${rows?.length ?? 0} rows`}
            </Button>
            <Button type="button" variant="outline" className="h-11" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default PresetSheet;
