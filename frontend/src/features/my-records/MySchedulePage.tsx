import { CalendarCheck } from "lucide-react";
import { useMySchedule } from "@/api/myRecords";
import { useSelectedTerm } from "@/context/selectedTerm";
import { weekFromReportGrid } from "@/lib/weekGrid";
import DownloadButtons from "@/components/global-component/DownloadButtons";
import FormAlert from "@/components/global-component/FormAlert";
import WeekView from "@/components/global-component/WeekView";

/** A teacher's own classes in the selected term. Only approved schedules show here. */
const MySchedulePage = () => {
  const { term, isPending: isTermPending } = useSelectedTerm();
  const { data, isPending, isError } = useMySchedule(term?.id);

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-[#790D16]/20 rounded-sm">
          <CalendarCheck className="text-branding size-5" />
        </div>
        <div>
          <p className="text-branding text-xl font-medium">My Schedule</p>
          {term && (
            <p className="text-sm text-neutral-700">
              {term.name}, SY {term.school_year.name}
            </p>
          )}
        </div>
      </div>

      {!term && (
        <p className="text-sm text-neutral-700">
          {isTermPending ? "Loading..." : "There is no school year yet."}
        </p>
      )}
      {term && isPending && <p className="text-sm text-neutral-600">Loading...</p>}
      {isError && <FormAlert>Your schedule could not be loaded.</FormAlert>}

      {data === null && (
        <FormAlert>
          Your account is not linked to a personnel record yet. Please ask the Admin to link it.
        </FormAlert>
      )}

      {term && data && (
        <>
          <div>
            <p className="font-medium text-teal-700">{data.heading}</p>
            {data.details.length > 0 && (
              <p className="text-xs text-neutral-700">{data.details.join(" · ")}</p>
            )}
          </div>

          {data.not_final_count > 0 && (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              {data.not_final_count === 1 ? "1 more class is" : `${data.not_final_count} more classes are`} still being
              prepared. {data.not_final_count === 1 ? "It shows" : "They show"} here once approved.
            </p>
          )}

          {data.rows.length === 0 ? (
            <p className="text-sm text-neutral-700">You have no approved classes in this term yet.</p>
          ) : (
            <>
              <WeekView week={weekFromReportGrid(data)} />
              <p className="text-sm text-neutral-800">
                Total per week: <span className="font-medium">{data.totals.week} minutes</span> ({data.totals.week_duration})
              </p>
              <DownloadButtons basePath={`/terms/${term.id}/my-schedule/program`} label="My Schedule" />
            </>
          )}
        </>
      )}
    </div>
  );
};

export default MySchedulePage;
