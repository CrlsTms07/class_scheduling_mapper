import { CalendarCheck, Clock, Info } from "lucide-react";
import { useMySchedule } from "@/api/myRecords";
import { useSelectedTerm } from "@/context/selectedTerm";
import { weekFromReportGrid } from "@/lib/weekGrid";
import DownloadButtons from "@/components/global-component/DownloadButtons";
import FormAlert from "@/components/global-component/FormAlert";
import { Chip, Crumbs, SectionHeading, TermTabs } from "@/components/global-component/ScheduleUi";
import WeekView from "@/components/global-component/WeekView";

/** A teacher's own classes in the selected term. Only approved schedules show here. */
const MySchedulePage = () => {
  const { term, isPending: isTermPending } = useSelectedTerm();
  const { data, isPending, isError } = useMySchedule(term?.id);

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <Crumbs items={[{ label: "Home", to: "/dashboard" }, { label: "My Schedule" }]} />

      <section aria-label="My Schedule" className="space-y-4 rounded-2xl border bg-background p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[#790D16]/10 text-branding">
              <CalendarCheck className="size-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-teal-700">My Schedule</h1>
              <p className="text-sm text-neutral-700">{data?.heading ?? (term ? `${term.name}, SY ${term.school_year.name}` : "")}</p>
            </div>
          </div>
          {term && data && data.rows.length > 0 && (
            <DownloadButtons basePath={`/terms/${term.id}/my-schedule/program`} label="My Schedule" />
          )}
        </div>
        {data && data.details.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t pt-3">
            {data.details.map((detail) => (
              <Chip key={detail}>{detail}</Chip>
            ))}
          </div>
        )}
        {data && data.rows.length > 0 && (
          <div className="grid grid-cols-1 gap-3 border-t pt-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-lg bg-neutral-50 p-3">
              <Clock className="size-5 text-branding" aria-hidden />
              <div>
                <p className="text-sm text-neutral-600">Teaching time a week</p>
                <p className="font-semibold text-neutral-900">
                  {data.totals.week} minutes <span className="font-normal text-neutral-600">({data.totals.week_duration})</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-neutral-50 p-3">
              <Info className="size-5 text-branding" aria-hidden />
              <p className="text-sm text-neutral-700">Only approved classes show here. Tap a class to see its room.</p>
            </div>
          </div>
        )}
      </section>

      {!term && <p className="text-sm text-neutral-700">{isTermPending ? "Loading..." : "There is no school year yet."}</p>}

      <TermTabs />

      {term && isPending && <p className="text-sm text-neutral-600">Loading...</p>}
      {isError && <FormAlert>Your schedule could not be loaded.</FormAlert>}
      {data === null && <FormAlert>Your account is not linked to a personnel record yet. Please ask the Admin to link it.</FormAlert>}

      {term && data && (
        <>
          {data.not_final_count > 0 && (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              {data.not_final_count === 1 ? "1 more class is" : `${data.not_final_count} more classes are`} still being prepared.{" "}
              {data.not_final_count === 1 ? "It shows" : "They show"} here once approved.
            </p>
          )}

          <SectionHeading title="My Daily Schedule" term={term}>
            Your classes this {term.school_year.term_label.toLowerCase()}, day by day: time, section, subject and room.
          </SectionHeading>

          {data.rows.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-neutral-700">You have no approved classes yet.</p>
          ) : (
            <div className="rounded-2xl border bg-background p-3 shadow-sm sm:p-4">
              <WeekView week={weekFromReportGrid(data)} />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MySchedulePage;
