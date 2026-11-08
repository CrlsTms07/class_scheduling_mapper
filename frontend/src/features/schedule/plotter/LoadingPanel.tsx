import type { ReactNode } from "react";
import { useDraggable } from "@dnd-kit/core";
import { remainingHint, subjectColor, type PlotContext } from "@/lib/schedule";
import type { Loading } from "@/types/api";

type LoadingPanelProp = PlotContext & {
  loading: Loading[];
  selectedId: number | null;
  /** Left out when the user can only view this schedule. */
  onSelect?: (loadingId: number | null) => void;
};

function minutesColor({ scheduled_minutes, required_minutes }: Loading): string {
  if (scheduled_minutes > required_minutes) return "text-red-700 font-bold";
  if (scheduled_minutes === required_minutes) return "text-emerald-700 font-bold";
  return "text-neutral-600";
}

type SubjectButtonProp = {
  item: Loading;
  isSelected: boolean;
  className: string;
  onClick: () => void;
  children: ReactNode;
};

/** Tap to pick it, or drag it onto a time slot. Both end up saving the same way. */
const SubjectButton = ({ item, isSelected, className, onClick, children }: SubjectButtonProp) => {
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: `loading-${item.id}`,
    data: { loadingId: item.id },
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      aria-pressed={isSelected}
      onClick={onClick}
      {...listeners}
      className={`${className} cursor-grab touch-manipulation ${isDragging ? "opacity-50" : ""} ${
        isSelected ? "ring-2 ring-[#790D16] ring-offset-1" : ""
      }`}
    >
      {children}
    </button>
  );
};

/** The subjects to place, with the minutes done so far. */
const LoadingPanel = ({ loading, selectedId, onSelect, ...context }: LoadingPanelProp) => {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-neutral-800">Subjects</p>
      {onSelect && (
        <p className="text-xs text-neutral-600">
          Tap a subject, then tap the time slots where it belongs. You can also drag it onto a slot, or drag a placed class to move it.
        </p>
      )}
      <ul className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible pb-1">
        {loading.map((item) => {
          const isSelected = item.id === selectedId;
          const content = (
            <>
              <span className="block text-xs font-medium">{item.subject}</span>
              <span className="block text-[11px] opacity-80">{item.teacher}</span>
              <span className={`block text-[11px] ${minutesColor(item)}`}>
                {item.scheduled_minutes} / {item.required_minutes} mins
              </span>
              {onSelect && <span className="block text-[11px] opacity-90">{remainingHint(item, context)}</span>}
            </>
          );
          const classes = `block w-full min-h-11 min-w-40 lg:min-w-0 rounded-md border p-2 text-left ${subjectColor(item.id)}`;

          return (
            <li key={item.id} className="shrink-0 lg:shrink">
              {onSelect ? (
                <SubjectButton
                  item={item}
                  isSelected={isSelected}
                  className={classes}
                  onClick={() => onSelect(isSelected ? null : item.id)}
                >
                  {content}
                </SubjectButton>
              ) : (
                <div className={classes}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default LoadingPanel;
