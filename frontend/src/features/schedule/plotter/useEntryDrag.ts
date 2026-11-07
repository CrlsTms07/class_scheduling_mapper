import { useDraggable } from "@dnd-kit/core";
import { hasSubject, isLocked } from "@/lib/schedule";
import type { ScheduleEntry, TimeSlot } from "@/types/api";

/** Lets a class already on the schedule be dragged to another slot. */
export function useEntryDrag(
  entry: ScheduleEntry | undefined,
  slot: TimeSlot,
  day: number,
  canEdit: boolean,
  idPrefix = "placed",
) {
  const canDrag = canEdit && entry !== undefined && hasSubject(entry) && !isLocked(entry);

  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: `${idPrefix}-${slot.id}-${day}`,
    disabled: !canDrag,
    data: { loadingId: entry?.section_subject_id, from: { slot, day } },
  });

  return {
    dragRef: setNodeRef,
    dragListeners: canDrag ? listeners : undefined,
    dragClasses: `${canDrag ? "cursor-grab touch-manipulation" : ""} ${isDragging ? "opacity-50" : ""}`,
  };
}
