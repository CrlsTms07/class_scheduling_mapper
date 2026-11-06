import { TriangleAlert } from "lucide-react";
import type { ScheduleFlag } from "@/types/api";

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
          </li>
        ))}
      </ul>
    </details>
  );
};

export default FlagsPanel;
