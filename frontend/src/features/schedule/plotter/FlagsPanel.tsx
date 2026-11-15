import { TriangleAlert } from "lucide-react";
import { Link } from "react-router";
import type { ScheduleFlag } from "@/types/api";

/** How to fix each kind of flag, and where, when it is not on this page. */
export const FLAG_FIXES: Record<string, { text: string; to?: string; label?: string }> = {
  minutes_under: { text: "Place this subject in one more free period." },
  minutes_over: { text: "Remove a period of this subject, or check its minutes per week.", to: "/subjects", label: "Subjects" },
  no_adviser: { text: "Choose an adviser for this section.", to: "/sections", label: "Sections" },
  open_slots: { text: "Choose a subject for each open slot, or clear the slot." },
  no_room: { text: "Give the section its home room; its classes take it.", to: "/sections", label: "Sections" },
  overlaps_break: { text: "Move the class out of the break, to a period of the bell schedule." },
  outside_shift: { text: "Move the class to a period inside the section's shift." },
  teacher_shift: { text: "Move the class inside the teacher's shift, or choose another teacher." },
  teacher_overloaded: {
    text: "Give one of the teacher's subjects to someone else, or raise the limit.",
    to: "/teacher-loading?view=teachers",
    label: "Load Distribution",
  },
};

const FlagFix = ({ type }: { type: string }) => {
  const fix = FLAG_FIXES[type];
  if (!fix) return null;

  return (
    <span className="mt-0.5 block text-[11px] text-neutral-700">
      How to fix: {fix.text}
      {fix.to && (
        <>
          {" "}
          <Link to={fix.to} className="inline-flex min-h-11 items-center font-medium text-branding underline underline-offset-2 md:min-h-0">
            Open {fix.label}
          </Link>
        </>
      )}
    </span>
  );
};

const FlagsPanel = ({ flags }: { flags: ScheduleFlag[] }) => {
  if (flags.length === 0) {
    return (
      <p className="rounded-md border border-emerald-300 bg-emerald-50 p-2 text-xs text-emerald-900">
        No flags. This schedule follows the rules so far.
      </p>
    );
  }

  const redCount = flags.filter(({ severity }) => severity === "red").length;

  return (
    <details className="rounded-md border bg-background">
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 p-2 text-sm">
        <TriangleAlert className="size-4 shrink-0 text-amber-600" />
        <span className="font-medium">
          {flags.length} {flags.length === 1 ? "flag" : "flags"} to check
        </span>
        {redCount > 0 && (
          <span className="rounded-full bg-red-100 px-2 text-xs text-red-800">
            {redCount} urgent
          </span>
        )}
      </summary>
      <ul className="space-y-1 p-2 pt-0">
        {flags.map((flag) => (
          <li
            key={flag.key}
            className={`rounded px-2 py-1 text-xs ${
              flag.severity === "red"
                ? "bg-red-50 text-red-900"
                : "bg-amber-50 text-amber-900"
            }`}
          >
            {flag.message}
            {flag.acknowledged && " (acknowledged)"}
            <FlagFix type={flag.type} />
          </li>
        ))}
      </ul>
    </details>
  );
};

export default FlagsPanel;
