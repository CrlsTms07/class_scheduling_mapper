import { Lock, Plus } from "lucide-react";
import { isLocked, subjectColor } from "@/lib/schedule";
import type { ScheduleEntry } from "@/types/api";

type ScheduleCellProp = {
  entry: ScheduleEntry | undefined;
  label: string;
  /** Left out when the user can only view this schedule. */
  onSelect?: () => void;
};

const ScheduleCell = ({ entry, label, onSelect }: ScheduleCellProp) => {
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
    onSelect && <Plus className="size-4 mx-auto text-neutral-400" />
  );

  const classes = `block w-full h-full min-h-11 rounded-md border p-1.5 text-left ${
    entry ? subjectColor(entry.section_subject_id) : "border-dashed border-neutral-300"
  }`;

  if (!onSelect) {
    return <div className={classes}>{content}</div>;
  }

  return (
    <button
      type="button"
      aria-label={label}
      onClick={onSelect}
      className={`${classes} cursor-pointer hover:brightness-95 focus-visible:outline-2 focus-visible:outline-[#790D16]`}
    >
      {content}
    </button>
  );
};

export default ScheduleCell;
