import { Link } from "react-router";
import { useSchedulerDashboard } from "@/api/dashboard";
import { useSelectedTerm } from "@/context/selectedTerm";
import type { NextStepKey } from "@/types/api";
import FormAlert from "@/components/global-component/FormAlert";
import { OverloadedTeachers, ProgressSection, StatTile } from "./DashboardParts";

/** What each step asks of the user, and where each section goes to do it. */
const STEPS: Record<NextStepKey, { title: string; detail: string; pathOf?: (sectionId: number) => string }> = {
  revise: {
    title: "Revise what the Admin rejected",
    detail: "Read the remarks, fix the schedule, then submit it again.",
    pathOf: (id) => `/schedule/sections/${id}`,
  },
  no_bell_schedule: {
    title: "Waiting for a bell schedule",
    detail: "The Admin sets these up in Time Slots. Nothing can be plotted until then.",
  },
  add_loading: {
    title: "Add teacher loading",
    detail: "Choose who teaches each subject of these sections.",
    pathOf: (id) => `/teacher-loading?section=${id}`,
  },
  plot: {
    title: "Start plotting",
    detail: "The loading is ready, so subjects can now be placed on the schedule.",
    pathOf: (id) => `/schedule/sections/${id}`,
  },
  submit: {
    title: "Finish and submit",
    detail: "Fill the remaining slots, check the flags, then submit for approval.",
    pathOf: (id) => `/schedule/sections/${id}`,
  },
};

/** What a Chairperson or Master Teacher should do next, for their own grade levels. */
const SchedulerDashboardPanel = () => {
  const { terms, term, isPending: isTermPending } = useSelectedTerm();
  const { data, isPending, isError } = useSchedulerDashboard(term?.id);
  const activeTerm = terms.find(({ is_active }) => is_active);

  if (!term) {
    return (
      <p className="text-sm text-neutral-700">
        {isTermPending ? "Loading..." : "There is no school year yet. Please ask the Admin to start one."}
      </p>
    );
  }

  if (isError) {
    return <p className="text-sm text-destructive">Could not load the dashboard.</p>;
  }

  if (isPending || !data) {
    return <p className="text-sm text-neutral-600">Loading...</p>;
  }

  if (!data.has_scope) {
    return <FormAlert>No grade level is assigned to you yet. Please ask the Admin to assign one.</FormAlert>;
  }

  const { flags } = data;

  return (
    <div className="space-y-5">
      <p className="text-sm text-neutral-700">
        Showing <span className="font-medium">{term.name}, SY {term.school_year.name}</span>.
      </p>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <StatTile
          label="Active term"
          value={activeTerm?.name ?? "None"}
          note={activeTerm ? `School Year ${activeTerm.school_year.name}` : "Not set yet"}
          to="/schedule"
        />
        <StatTile
          label="Waiting for approval"
          value={data.pending_sections}
          note={`of ${data.sections} ${data.sections === 1 ? "section" : "sections"}`}
          to="/schedule"
        />
        <StatTile
          label="Approved"
          value={data.approved_sections}
          note={`of ${data.sections} ${data.sections === 1 ? "section" : "sections"}`}
          to="/reports"
        />
        <StatTile
          label="Flags to check"
          value={flags.total}
          note={
            flags.total === 0
              ? "Nothing to check"
              : `In ${flags.sections} ${flags.sections === 1 ? "section" : "sections"}, ${flags.urgent} urgent`
          }
          to="/schedule"
        />
      </div>

      <section className="space-y-3">
        <p className="font-medium text-teal-700">What to do next</p>

        {data.sections === 0 && (
          <p className="text-sm text-neutral-700">
            Your grade levels have no sections in this school year yet. The Admin encodes them.
          </p>
        )}
        {data.sections > 0 && data.next_steps.length === 0 && (
          <p className="text-sm text-neutral-700">
            Nothing for now. Every section is either waiting for approval or already approved.
          </p>
        )}

        <ol className="space-y-3">
          {data.next_steps.map(({ key, sections }) => {
            const { title, detail, pathOf } = STEPS[key];

            return (
              <li key={key} className="space-y-2 rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium text-neutral-900">
                    {title} ({sections.length})
                  </p>
                  <p className="text-xs text-neutral-700">{detail}</p>
                </div>
                <ul className="flex flex-wrap gap-2">
                  {sections.map(({ id, label }) => (
                    <li key={id}>
                      {pathOf ? (
                        <Link
                          to={pathOf(id)}
                          className="flex min-h-11 items-center rounded-md border bg-background px-3 text-sm font-medium text-branding hover:bg-[#790D16]/5"
                        >
                          {label}
                        </Link>
                      ) : (
                        <span className="flex min-h-11 items-center rounded-md border bg-neutral-100 px-3 text-sm text-neutral-800">
                          {label}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-5 items-start">
        <ProgressSection rows={data.progress} />
        <OverloadedTeachers teachers={data.overloaded_teachers} />
      </div>
    </div>
  );
};

export default SchedulerDashboardPanel;
