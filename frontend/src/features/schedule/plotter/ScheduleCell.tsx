import { Lock, Plus } from "lucide-react";
import { isLocked, subjectColor } from "@/lib/schedule";
import type { ScheduleEntry, TimeSlot } from "@/types/api";
import { useEntryDrag } from "./useEntryDrag";

type ScheduleCellProp = {
  entry: ScheduleEntry | undefined;
  slot: TimeSlot;
  day: number;
  label: string;
  /** The phone list only taps. It sits hidden beside the wide views, so it needs its own id. */
  isDraggable?: boolean;
  /** Left out when the user can only view this schedule. */
  onSelect?: () => void;
};

const ScheduleCell = ({ entry, slot, day, label, onSelect, isDraggable = true }: ScheduleCellProp) => {
  const { dragRef, dragListeners, dragClasses } = useEntryDrag(
    entry,
    slot,
    day,
    isDraggable && onSelect !== undefined,
    isDraggable ? "placed" : "list",
  );

  const content = entry ? (
    <>
      <span className="flex items-start justify-between gap-1">
        <span className="font-medium text-xs leading-tight">
          {entry.subject ?? "Open slot"}
        </span>
        {isLocked(entry) && <Lock className="size-3 shrink-0" aria-label={entry.status} />}
      </span>
      {entry.teacher && (
        <span className="block text-[11px] leading-tight mt-0.5">{entry.teacher}</span>
      )}
      {entry.room && (
        <span className="block text-[11px] leading-tight opacity-75">{entry.room}</span>
      )}
    </>
  ) : (
    onSelect &&
    (isDraggable ? (
      <Plus className="size-4 mx-auto text-neutral-400" />
    ) : (
      <span className="flex items-center justify-center gap-1 py-1 text-xs font-medium text-branding">
        <Plus className="size-3.5" />
        Add subject
      </span>
    ))
  );

  const classes = `block w-full h-full min-h-11 rounded-md border p-1.5 text-left ${
    entry ? subjectColor(entry.section_subject_id) : "border-dashed border-neutral-300"
  }`;

  if (!onSelect) {
    return <div className={classes}>{content}</div>;
  }

  return (
    <button
      ref={dragRef}
      type="button"
      aria-label={label}
      onClick={onSelect}
      {...dragListeners}
      className={`${classes} cursor-pointer hover:brightness-95 focus-visible:outline-2 focus-visible:outline-[#790D16] ${dragClasses}`}
    >
      {content}
    </button>
  );
};

export default ScheduleCell;
