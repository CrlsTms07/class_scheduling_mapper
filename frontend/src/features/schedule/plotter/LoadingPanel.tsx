import { subjectColor } from "@/lib/schedule";
import type { Loading } from "@/types/api";

type LoadingPanelProp = {
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

/** The subjects to place, with the minutes done so far. Tap one, then tap the time slots. */
const LoadingPanel = ({ loading, selectedId, onSelect }: LoadingPanelProp) => {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-neutral-800">Subjects</p>
      {onSelect && (
        <p className="text-xs text-neutral-600">
          Tap a subject, then tap the time slots where it belongs.
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
            </>
          );
          const classes = `block w-full min-h-11 min-w-40 lg:min-w-0 rounded-md border p-2 text-left ${subjectColor(item.id)}`;

          return (
            <li key={item.id} className="shrink-0 lg:shrink">
              {onSelect ? (
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onSelect(isSelected ? null : item.id)}
                  className={`${classes} cursor-pointer ${
                    isSelected ? "ring-2 ring-[#790D16] ring-offset-1" : ""
                  }`}
                >
                  {content}
                </button>
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
