import React from "react";
import { usePlaceActivity } from "@/api/schedule";
import { apiErrorMessage } from "@/lib/forms";
import { DAY_NAMES } from "@/lib/schedule";
import type { ActivityPlacement, ActivityScope, DayPattern, Plotter, ScheduleEntry, TimeSlot } from "@/types/api";
import FormAlert from "@/components/global-component/FormAlert";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

type ActivityFormProp = {
  plotter: Plotter;
  termId: number;
  pattern: DayPattern;
  slot: TimeSlot;
  day: number;
  currentEntry: ScheduleEntry | undefined;
  isLocked: boolean;
  /** Removes what is in this period on the chosen days, for this section only. */
  removeButton: React.ReactNode;
  onClose: () => void;
};

const TOGGLE = "min-h-11 rounded-md border px-3 text-xs font-medium text-left disabled:opacity-50";
const ON = "bg-[#790D16] text-white border-[#790D16]";
const OFF = "bg-background text-neutral-700";

/**
 * An activity (Flag Ceremony, Catch-up Friday...) for this section, its grade level, or all
 * sections. A review comes first: which sections get it, and which classes it replaces.
 */
const ActivityForm = ({ plotter, termId, pattern, slot, day, currentEntry, isLocked, removeButton, onClose }: ActivityFormProp) => {
  const { section, activities, apply_counts: counts } = plotter;
  const place = usePlaceActivity(termId, section.id);

  const [activityId, setActivityId] = React.useState<number | null>(currentEntry?.activity_id ?? null);
  const [scope, setScope] = React.useState<ActivityScope>("section");
  const [days, setDays] = React.useState<number[]>([day]);
  const [review, setReview] = React.useState<ActivityPlacement | null>(null);
  const [done, setDone] = React.useState<ActivityPlacement | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const scopes: { value: ActivityScope; label: string }[] = [
    { value: "section", label: "This section only" },
    { value: "grade", label: `All Grade ${section.grade} sections (${counts.grade})` },
    { value: "all", label: `All my sections (${counts.all})` },
  ];

  // Any change makes the review out of date.
  const change = (apply: () => void) => {
    apply();
    setReview(null);
    setError(null);
  };

  const send = (preview: boolean) => {
    if (!activityId || days.length === 0) {
      setError("Choose an activity and at least one day.");
      return;
    }

    place.mutate(
      { slotId: slot.id, activity_id: activityId, scope, days, preview },
      {
        onSuccess: ({ summary }) => (preview ? setReview(summary) : setDone(summary)),
        onError: (problem) => setError(apiErrorMessage(problem)),
      },
    );
  };

  if (done) {
    return (
      <div className="space-y-3" role="status">
        <p className="text-sm font-medium text-emerald-800">
          {done.activity} was placed on {done.placed_sections} {done.placed_sections === 1 ? "section" : "sections"}.
        </p>
        <Unplaced summary={done} />
        <Button type="button" className="h-11 w-full" onClick={onClose}>
          Done
        </Button>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <FormAlert>
        There are no activities for this school year yet. Add them in Subjects, under Activities.
      </FormAlert>
    );
  }

  return (
    <div className="space-y-4">
      {error && <FormAlert>{error}</FormAlert>}

      <div className="space-y-1">
        <label htmlFor="entry-activity" className="text-sm text-neutral-800">
          Activity
        </label>
        <NativeSelect
          id="entry-activity"
          className="w-full [&_select]:h-11"
          value={activityId ?? ""}
          disabled={isLocked}
          onChange={(event) => change(() => setActivityId(Number(event.target.value) || null))}
        >
          <NativeSelectOption value="">Select an activity</NativeSelectOption>
          {activities.map((activity) => (
            <NativeSelectOption key={activity.id} value={activity.id}>
              {activity.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <fieldset className="space-y-1">
        <legend className="text-sm text-neutral-800">Apply to</legend>
        <div className="grid gap-2">
          {scopes.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={scope === value}
              disabled={isLocked}
              onClick={() => change(() => setScope(value))}
              className={`${TOGGLE} ${scope === value ? ON : OFF}`}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-1">
        <legend className="text-sm text-neutral-800">Days</legend>
        <div className="flex flex-wrap gap-2">
          {pattern.days.map((patternDay) => {
            const isOn = days.includes(patternDay);
            return (
              <button
                key={patternDay}
                type="button"
                aria-pressed={isOn}
                disabled={isLocked}
                onClick={() =>
                  change(() =>
                    setDays((current) =>
                      isOn ? current.filter((item) => item !== patternDay) : [...current, patternDay].sort(),
                    ),
                  )
                }
                className={`${TOGGLE} min-w-14 text-center ${isOn ? ON : OFF}`}
              >
                {DAY_NAMES[patternDay].slice(0, 3)}
              </button>
            );
          })}
        </div>
      </fieldset>

      {review && (
        <div className="space-y-2 rounded-md border bg-neutral-50 p-3 text-sm" aria-live="polite">
          <p className="font-medium text-neutral-900">
            {review.activity}, {review.time}: {review.placed_sections}{" "}
            {review.placed_sections === 1 ? "section" : "sections"} will get it.
          </p>
          <ul className="space-y-1 text-xs text-neutral-700">
            {review.sections
              .filter(({ skipped }) => skipped)
              .map(({ id, label, skipped }) => (
                <li key={id}>
                  Left out: {label}. {skipped}
                </li>
              ))}
          </ul>
          <Unplaced summary={review} />
        </div>
      )}

      <div className="flex flex-col gap-2 pt-2">
        {!isLocked &&
          (review ? (
            <Button
              type="button"
              className="h-11"
              disabled={place.isPending || review.placed_sections === 0}
              onClick={() => send(false)}
            >
              {place.isPending
                ? "Applying..."
                : `Apply to ${review.placed_sections} ${review.placed_sections === 1 ? "section" : "sections"}`}
            </Button>
          ) : (
            <Button type="button" className="h-11" disabled={place.isPending} onClick={() => send(true)}>
              {place.isPending ? "Checking..." : "Review"}
            </Button>
          ))}
        {currentEntry && !isLocked && removeButton}
        <Button type="button" variant="outline" className="h-11" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
};

/** Classes an activity takes the place of. They are not deleted: they wait to be placed again. */
const Unplaced = ({ summary }: { summary: ActivityPlacement }) => {
  const sections = summary.sections.filter(({ skipped, unplaced }) => !skipped && unplaced.length > 0);

  if (sections.length === 0) return null;

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
      <p className="font-medium">
        Moves to Unplaced ({summary.unplaced_classes}). Their teacher loading stays, so they can be placed again:
      </p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4">
        {sections.map(({ id, label, unplaced }) => (
          <li key={id}>
            {label}: {unplaced.join(", ")}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ActivityForm;
