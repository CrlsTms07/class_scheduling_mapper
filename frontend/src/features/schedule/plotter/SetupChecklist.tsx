import { Link } from "react-router";
import { ArrowRight, Check, CircleDashed } from "lucide-react";
import { SHIFT_LABELS } from "@/lib/timeSlots";
import type { Shift } from "@/types/api";
import { buttonVariants } from "@/components/ui/button";

type SetupChecklistProp = {
  sectionId: number;
  level: "JHS" | "SHS";
  shift: Shift;
  hasBellSchedule: boolean;
  hasLoading: boolean;
  /** Whether the user may fix these (the plotter is open to them). */
  canFix: boolean;
};

/**
 * Shown in place of the timetable until a section can be plotted: what is still missing,
 * and a button to each place where it is set up.
 */
const SetupChecklist = ({ sectionId, level, shift, hasBellSchedule, hasLoading, canFix }: SetupChecklistProp) => {
  const department = level === "SHS" ? "Senior High" : "Junior High";
  const items = [
    {
      done: hasBellSchedule,
      title: "Bell schedule",
      detail: hasBellSchedule
        ? `${department}, ${SHIFT_LABELS[shift].toLowerCase()} shift has its periods.`
        : `Add the periods and breaks of ${department}, ${SHIFT_LABELS[shift].toLowerCase()} shift.`,
      action: { label: "Set up in Time Slots", to: "/time-slots" },
    },
    {
      done: hasLoading,
      title: "Teacher loading",
      detail: hasLoading
        ? "The subjects of this section have their teachers."
        : "Choose the subjects of this section and who teaches each one.",
      action: { label: "Go to Teacher Loading", to: `/teacher-loading?section=${sectionId}` },
    },
  ];
  const left = items.filter(({ done }) => !done).length;

  return (
    <section aria-label="Before you can plot" className="overflow-hidden rounded-xl border bg-background shadow-sm">
      <div className="border-b bg-amber-50 px-4 py-3">
        <h2 className="font-semibold text-amber-950">Before you can plot</h2>
        <p className="text-sm text-amber-900">
          {left === 1 ? "One thing is" : `${left} things are`} still needed. The timetable shows up here once {left === 1 ? "it is" : "they are"} done.
        </p>
      </div>
      <ol className="divide-y">
        {items.map(({ done, title, detail, action }, index) => (
          <li key={title} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <span
              className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                done ? "bg-emerald-600 text-white" : "border-2 border-[#790D16] text-branding"
              }`}
              aria-hidden
            >
              {done ? <Check className="size-4" /> : index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 font-medium text-neutral-900">
                {title}
                <span className={`rounded-full px-2 text-xs ${done ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>
                  {done ? "Done" : "Needed"}
                </span>
              </p>
              <p className="text-sm text-neutral-700">{detail}</p>
            </div>
            {!done && canFix && (
              <Link to={action.to} className={buttonVariants({ className: "h-11 shrink-0" })}>
                {action.label}
                <ArrowRight />
              </Link>
            )}
            {!done && !canFix && <CircleDashed className="size-5 shrink-0 text-neutral-400" aria-hidden />}
          </li>
        ))}
      </ol>
    </section>
  );
};

export default SetupChecklist;
