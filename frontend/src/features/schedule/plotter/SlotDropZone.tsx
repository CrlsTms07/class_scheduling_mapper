import type { ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import type { TimeSlot } from "@/types/api";

type SlotDropZoneProp = {
  slot: TimeSlot;
  day: number;
  /** A slot with a subject, or a schedule the user can only view, takes nothing. */
  isDisabled: boolean;
  children: ReactNode;
};

/** Lets a dragged subject land on a time slot, and shows which slot it would land on. */
const SlotDropZone = ({ slot, day, isDisabled, children }: SlotDropZoneProp) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `slot-${slot.id}-day-${day}`,
    data: { slot, day },
    disabled: isDisabled,
  });

  return (
    <div
      ref={setNodeRef}
      className={`h-full rounded-lg ${isOver ? "ring-2 ring-[#790D16] ring-offset-1" : ""}`}
    >
      {children}
    </div>
  );
};

export default SlotDropZone;
