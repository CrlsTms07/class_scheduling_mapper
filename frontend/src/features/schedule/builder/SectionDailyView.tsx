import React from "react";
import { Coffee, GraduationCap, MoveRight, Plus, Trash2, UserRound } from "lucide-react";
import { useResolvePeriod } from "@/api/scheduleBuilder";
import { useDeleteSlot } from "@/api/timeSlots";
import { apiErrorMessage } from "@/lib/forms";
import { DAY_NAMES, formatTime, WEEK_DAYS } from "@/lib/schedule";
import type { Plotter, ScheduleEntry, Term, TimeSlot } from "@/types/api";
import ClassFormSheet, { type ClassTarget } from "./ClassFormSheet";
import DeleteDialog from "@/components/global-component/DeleteDialog";
import FormAlert from "@/components/global-component/FormAlert";
import { DayHeader, Minutes, SectionHeading } from "@/components/global-component/ScheduleUi";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

const BREAK_TYPES = ["Recess", "Lunch", "Snack break", "Homeroom break"];
const minutesBetween = (start: string, end: string) => {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
};

/** "Add break time": start, end, type and days. It becomes a break of the bell schedule. */
const BreakDialog = ({ termId, sectionId, department, onClose }: { termId: number; sectionId: number; department: string; onClose: () => void }) => {
  const resolve = useResolvePeriod(termId);
  const [start, setStart] = React.useState("");
  const [end, setEnd] = React.useState("");
  const [type, setType] = React.useState(BREAK_TYPES[0]);
  const [days, setDays] = React.useState<number[]>([...WEEK_DAYS]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add break time</DialogTitle>
          <DialogDescription>
            A break is left free in the schedule. It is part of the {department} bell schedule, so the other sections on it get it too.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            resolve.mutate({ sectionId, days, start_time: start, end_time: end, is_break: true, label: type }, { onSuccess: onClose });
          }}
        >
          {resolve.isError && <FormAlert>{apiErrorMessage(resolve.error)}</FormAlert>}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="break-start" className="text-sm font-medium text-neutral-900">
                Start time
              </label>
              <Input id="break-start" type="time" className="h-11" value={start} onChange={(event) => setStart(event.target.value)} />
            </div>
            <div className="space-y-1">
              <label htmlFor="break-end" className="text-sm font-medium text-neutral-900">
                End time
              </label>
              <Input id="break-end" type="time" className="h-11" value={end} onChange={(event) => setEnd(event.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor="break-type" className="text-sm font-medium text-neutral-900">
              Type
            </label>
            <NativeSelect id="break-type" className="w-full [&_select]:h-11" value={type} onChange={(event) => setType(event.target.value)}>
              {BREAK_TYPES.map((item) => (
                <NativeSelectOption key={item} value={item}>
                  {item}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-neutral-900">Days</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {WEEK_DAYS.map((day) => (
                <label key={day} className="flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm">
                  <Checkbox
                    checked={days.includes(day)}
                    onCheckedChange={(checked) => setDays(checked ? [...days, day].sort() : days.filter((item) => item !== day))}
                  />
                  {DAY_NAMES[day]}
                </label>
              ))}
            </div>
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" className="h-11" onClick={onClose}>
              Close
            </Button>
            <Button type="submit" className="h-11" disabled={!start || !end || days.length === 0 || resolve.isPending}>
              {resolve.isPending ? "Saving..." : "Submit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const ClassCard = ({ entry, onEdit }: { entry: ScheduleEntry; onEdit?: () => void }) => {
  const content = (
    <>
      <div className="flex items-start justify-between gap-2 border-b pb-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-neutral-900">
            {entry.subject ?? (entry.activity_id ? "Activity" : "Open slot")}
            <Minutes minutes={minutesBetween(entry.start_time, entry.end_time)} />
          </p>
          <p className="flex items-center gap-1 text-sm text-neutral-700">
            {formatTime(entry.start_time)}
            <MoveRight className="size-4" aria-label="to" />
            {formatTime(entry.end_time)}
          </p>
        </div>
        {entry.room && (
          <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-neutral-800">
            <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
            {entry.room}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 pt-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[#790D16]/10 text-branding">
          <UserRound className="size-4" />
        </span>
        <span className="text-sm text-neutral-800">{entry.teacher ?? (entry.activity_id ? "Whole section" : "No teacher yet")}</span>
      </div>
    </>
  );

  return onEdit ? (
    <button
      type="button"
      aria-label={`Edit ${entry.subject ?? "class"}, ${formatTime(entry.start_time)}`}
      onClick={onEdit}
      className="rounded-xl border bg-background p-4 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-[#790D16]"
    >
      {content}
    </button>
  ) : (
    <article className="rounded-xl border bg-background p-4 shadow-sm">{content}</article>
  );
};

const BreakCard = ({ slot, onDelete }: { slot: TimeSlot; onDelete?: () => void }) => (
  <article className="flex flex-col justify-between gap-3 rounded-xl border border-dashed bg-neutral-50 p-4">
    <div className="flex items-start justify-between gap-2">
      {onDelete ? (
        <Button type="button" variant="ghost" size="icon" className="size-11 text-destructive hover:bg-red-50" aria-label={`Delete ${slot.label ?? "break"}, ${formatTime(slot.start_time)}`} onClick={onDelete}>
          <Trash2 />
        </Button>
      ) : (
        <Coffee className="size-5 text-neutral-500" aria-hidden />
      )}
      <Minutes minutes={slot.minutes} />
    </div>
    <div>
      <p className="font-semibold text-neutral-900">{slot.label ?? "Break time"}</p>
      <p className="flex items-center gap-1 text-sm text-neutral-700">
        {formatTime(slot.start_time)}
        <MoveRight className="size-4" aria-label="to" />
        {formatTime(slot.end_time)}
      </p>
    </div>
  </article>
);

/** Deleting a break changes the bell schedule, so it asks first. The server refuses it when classes use that time. */
const DeleteBreakDialog = ({ slot, onClose }: { slot: TimeSlot; onClose: () => void }) => {
  const remove = useDeleteSlot(slot.id);

  return (
    <DeleteDialog
      name={`${slot.label ?? "the break"}, ${formatTime(slot.start_time)} – ${formatTime(slot.end_time)}`}
      isPending={remove.isPending}
      error={remove.error}
      onConfirm={() => remove.mutate(undefined, { onSuccess: onClose })}
      onClose={onClose}
    />
  );
};

type SectionDailyViewProp = {
  plotter: Plotter;
  term: Term;
  /** May place and change classes (an open draft the user plots). */
  canEdit: boolean;
  /** May add or delete breaks (the bell schedule of this department). */
  canManageBreaks: boolean;
};

/**
 * The section's week as cards, day by day: each class with its time, room and teacher, and the
 * breaks. Classes are added and changed with typed times; breaks come from the bell schedule.
 */
const SectionDailyView = ({ plotter, term, canEdit, canManageBreaks }: SectionDailyViewProp) => {
  const { section, patterns, entries } = plotter;
  const [search, setSearch] = React.useState<Record<number, string>>({});
  const [adding, setAdding] = React.useState<number | null>(null);
  const [editing, setEditing] = React.useState<ClassTarget | null>(null);
  const [isAddingBreak, setIsAddingBreak] = React.useState(false);
  const [deleting, setDeleting] = React.useState<TimeSlot | null>(null);
  const department = section.level === "SHS" ? "Senior High" : "Junior High";

  return (
    <div className="space-y-5">
      <SectionHeading title="Section's Daily Schedule" term={term}>
        Plan the week of this section: add subjects, choose their teachers and rooms, and set the time of each class.
      </SectionHeading>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-neutral-800">Manage breaks</span>
        {canManageBreaks && (
          <Button type="button" className="h-11" onClick={() => setIsAddingBreak(true)}>
            <Plus />
            Break Time
          </Button>
        )}
      </div>
      {patterns.length === 0 && canEdit && (
        <p className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
          There is no bell schedule for {department} yet. Add the first class with its time, and the bell schedule starts from it.
        </p>
      )}

      {WEEK_DAYS.map((day) => {
        const query = (search[day] ?? "").trim().toLowerCase();
        const classes = entries.filter((entry) => entry.day === day);
        const breaks = patterns.filter(({ days }) => days.includes(day)).flatMap(({ slots }) => slots.filter(({ is_break: isBreak }) => isBreak));
        const subjects = new Set(classes.map(({ section_subject_id: id, activity_id: activity }) => id ?? `a${activity}`)).size;
        const items = [
          ...classes
            .filter((entry) => `${entry.subject ?? ""} ${entry.teacher ?? ""} ${entry.room ?? ""}`.toLowerCase().includes(query))
            .map((entry) => ({ start: entry.start_time, key: `e${entry.id}`, node: (
              <ClassCard
                key={`e${entry.id}`}
                entry={entry}
                onEdit={
                  canEdit && !entry.activity_id
                    ? () => setEditing({ sectionId: section.id, day, start_time: entry.start_time, end_time: entry.end_time, section_subject_id: entry.section_subject_id, room_id: entry.room_id })
                    : undefined
                }
              />
            ) })),
          ...(query === "" ? breaks : []).map((slot) => ({ start: slot.start_time, key: `b${slot.id}`, node: (
            <BreakCard key={`b${slot.id}`} slot={slot} onDelete={canManageBreaks ? () => setDeleting(slot) : undefined} />
          ) })),
        ].sort((a, b) => a.start.localeCompare(b.start));

        return (
          <section key={day} aria-label={DAY_NAMES[day]} className="space-y-3">
            <DayHeader
              day={DAY_NAMES[day]}
              icon={GraduationCap}
              count={subjects}
              noun={subjects === 1 ? "Subject" : "Subjects"}
              search={search[day] ?? ""}
              onSearch={classes.length > 0 ? (value) => setSearch({ ...search, [day]: value }) : undefined}
              onAdd={canEdit ? () => setAdding(day) : undefined}
              addLabel={`Add a class on ${DAY_NAMES[day]}`}
            />
            {items.length === 0 ? (
              <p className="text-sm text-neutral-600">{classes.length === 0 ? "No classes yet." : "Nothing matches your search."}</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{items.map(({ node }) => node)}</div>
            )}
          </section>
        );
      })}

      {adding !== null && <ClassFormSheet termId={term.id} day={adding} sectionId={section.id} onClose={() => setAdding(null)} />}
      {editing && <ClassFormSheet termId={term.id} day={editing.day} sectionId={section.id} editing={editing} onClose={() => setEditing(null)} />}
      {isAddingBreak && <BreakDialog termId={term.id} sectionId={section.id} department={department} onClose={() => setIsAddingBreak(false)} />}
      {deleting && <DeleteBreakDialog key={deleting.id} slot={deleting} onClose={() => setDeleting(null)} />}
    </div>
  );
};

export default SectionDailyView;
