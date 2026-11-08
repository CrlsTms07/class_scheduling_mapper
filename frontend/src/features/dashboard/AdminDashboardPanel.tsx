import { Link } from "react-router";
import { ArrowRight, Check, CircleDashed } from "lucide-react";
import { useAdminDashboard } from "@/api/dashboard";
import { useSelectedTerm } from "@/context/selectedTerm";
import { termWord } from "@/lib/schedule";
import type { AdminDashboard, ChecklistKey } from "@/types/api";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { OverloadedTeachers, ProgressSection, StatTile } from "./DashboardParts";

const CHECKLIST_LINKS: Record<ChecklistKey, string> = {
  calendar: "/school-years",
  school_profile: "/report-settings",
  time_slots: "/time-slots",
  sections: "/sections",
  signatories: "/report-settings",
  schedulers: "/users",
};

const SetupChecklist = ({ items }: { items: AdminDashboard["checklist"] }) => {
  const doneCount = items.filter(({ done }) => done).length;
  const isComplete = doneCount === items.length;

  return (
    <details open={!isComplete} className="rounded-xl border bg-background">
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 p-4 text-sm">
        <span className="font-medium text-teal-700">Setup checklist</span>
        <span className="text-neutral-700">
          {doneCount} of {items.length} done
        </span>
      </summary>
      <ol className="divide-y border-t">
        {items.map(({ key, title, done, detail }) => (
          <li key={key} className="flex items-center gap-3 p-3 sm:px-4">
            {done ? (
              <Check className="size-5 shrink-0 text-emerald-700" />
            ) : (
              <CircleDashed className="size-5 shrink-0 text-amber-700" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-neutral-900">
                {title}
                <span className="sr-only">{done ? " (done)" : " (to do)"}</span>
              </p>
              <p className="text-xs text-neutral-700">{detail}</p>
            </div>
            <Link
              to={CHECKLIST_LINKS[key]}
              aria-label={`Open ${title}`}
              className={buttonVariants({ variant: "outline", className: "h-11 shrink-0" })}
            >
              {done ? "View" : "Set up"}
              <ArrowRight />
            </Link>
          </li>
        ))}
      </ol>
    </details>
  );
};

/** What the Admin needs to see first, for the term in the selector at the top. */
const AdminDashboardPanel = () => {
  const { terms, term, isPending: isTermPending } = useSelectedTerm();
  const { data, isPending, isError } = useAdminDashboard(term?.id);
  const activeTerm = terms.find(({ is_active }) => is_active);

  if (!term) {
    return isTermPending ? (
      <p className="text-sm text-neutral-600">Loading...</p>
    ) : (
      <Card className="shadow shadow-[#790D16]/40 max-w-md">
        <CardContent className="space-y-3">
          <p className="text-sm text-neutral-800">
            There is no school year yet. Start the first one to begin setting up the system.
          </p>
          <Link
            to="/school-years"
            className={buttonVariants({ className: "h-11 w-full" })}
          >
            Go to School Years
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return <p className="text-sm text-destructive">Could not load the dashboard.</p>;
  }

  if (isPending || !data) {
    return <p className="text-sm text-neutral-600">Loading...</p>;
  }

  const { flags } = data;

  return (
    <div className="space-y-5">
      <p className="text-sm text-neutral-700">
        Showing <span className="font-medium">{term.name}, SY {term.school_year.name}</span>.
      </p>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <StatTile
          label={`Active ${termWord(activeTerm ?? term)}`}
          value={activeTerm?.name ?? "None"}
          note={activeTerm ? `School Year ${activeTerm.school_year.name}` : "Set one in School Years"}
          to="/school-years"
        />
        <StatTile
          label="Waiting for approval"
          value={data.pending_sections}
          note={data.pending_sections === 1 ? "section" : "sections"}
          to="/approvals"
        />
        <StatTile
          label="Flags to check"
          value={flags.total}
          note={
            flags.total === 0
              ? "Nothing to check"
              : `In ${flags.sections} ${flags.sections === 1 ? "section" : "sections"}, ${flags.urgent} urgent`
          }
          to="/approvals"
        />
        <StatTile
          label="Accounts to activate"
          value={data.pending_accounts}
          note={data.pending_accounts === 1 ? "sign-up waiting" : "sign-ups waiting"}
          to="/users"
        />
      </div>

      <SetupChecklist items={data.checklist} />

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-5 items-start">
        <ProgressSection rows={data.progress} />
        <OverloadedTeachers teachers={data.overloaded_teachers} />
      </div>
    </div>
  );
};

export default AdminDashboardPanel;
