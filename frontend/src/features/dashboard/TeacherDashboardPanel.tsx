import { Link } from "react-router";
import { useMyProfile, useMySchedule } from "@/api/myRecords";
import { useSelectedTerm } from "@/context/selectedTerm";
import { classesOn, nextClass } from "@/lib/myRecords";
import { DAY_NAMES, formatTime } from "@/lib/schedule";
import FormAlert from "@/components/global-component/FormAlert";
import { StatTile } from "./DashboardParts";

const pad = (value: number) => String(value).padStart(2, "0");

/** What a teacher needs at a glance: today's classes, the next one, and the week's load. */
const TeacherDashboardPanel = () => {
  const { term } = useSelectedTerm();
  const { data: schedule, isPending } = useMySchedule(term?.id);
  const { data: profile } = useMyProfile(term?.id);

  if (!term) return <p className="text-sm text-neutral-700">There is no school year yet.</p>;
  if (isPending) return <p className="text-sm text-neutral-600">Loading...</p>;

  const date = new Date();
  const today = date.getDay();
  const now = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const isSchoolDay = today >= 1 && today <= 5;
  const classes = schedule && isSchoolDay ? classesOn(schedule, today) : [];
  const next = nextClass(classes, now);
  const classCount = schedule ? schedule.rows.reduce((sum, row) => sum + Object.values(row.cells).flat().length, 0) : 0;

  return (
    <div className="space-y-5">
      <p className="text-sm text-neutral-700">
        Showing <span className="font-medium">{term.name}, SY {term.school_year.name}</span>.
      </p>

      {schedule && schedule.not_final_count > 0 && (
        <FormAlert>
          {schedule.not_final_count} of your classes are still being prepared. They show here once the Admin approves them.
        </FormAlert>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <StatTile
          label="Next class"
          value={next ? formatTime(next.start) : "None"}
          note={next ? next.lines.filter(Boolean).slice(0, 2).join(" · ") : isSchoolDay ? "No more classes today" : "No classes today"}
          to="/my-schedule"
        />
        <StatTile label="Classes today" value={classes.length} note={isSchoolDay ? DAY_NAMES[today] : "Weekend"} to="/my-schedule" />
        <StatTile
          label="Teaching time a week"
          value={schedule?.totals.week_duration ?? "–"}
          note={`${classCount} ${classCount === 1 ? "class" : "classes"} a week`}
          to="/my-schedule"
        />
        <StatTile label="Advisory" value={profile?.advisory ?? "None"} note="This school year" to="/my-profile" />
      </div>

      <section className="space-y-3">
        <p className="font-medium text-teal-700">Today</p>
        {!schedule && <p className="text-sm text-neutral-700">You have no approved classes yet.</p>}
        {schedule && classes.length === 0 && (
          <p className="text-sm text-neutral-700">{isSchoolDay ? "No classes today." : "No classes on weekends."}</p>
        )}
        <ol className="space-y-2">
          {classes.map((item) => {
            const isNext = item === next;

            return (
              <li
                key={`${item.start}-${item.lines.join()}`}
                className={`flex flex-col gap-1 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between ${
                  isNext ? "border-[#790D16] ring-1 ring-[#790D16]" : ""
                } ${item.end <= now ? "opacity-60" : ""}`}
              >
                <span className="text-sm font-medium text-neutral-900">
                  {formatTime(item.start)} – {formatTime(item.end)}
                  {isNext && <span className="ml-2 text-xs font-bold text-branding">Next</span>}
                </span>
                <span className="text-sm text-neutral-700">{item.lines.filter(Boolean).join(" · ")}</span>
              </li>
            );
          })}
        </ol>
        <Link to="/my-schedule" className="inline-flex min-h-11 items-center text-sm font-medium text-branding underline-offset-2 hover:underline">
          See the whole week
        </Link>
      </section>
    </div>
  );
};

export default TeacherDashboardPanel;
