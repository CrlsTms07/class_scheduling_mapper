import { Link } from "react-router";
import { useTeacherLoadReport } from "@/api/reports";
import type { TeacherLoadData } from "@/types/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type TeacherRow = TeacherLoadData["teachers"][number];

/** A bar of hours against the teacher's own limit. Red once it goes over. */
const HoursBar = ({ teacher }: { teacher: TeacherRow }) => {
  const percent = Math.min(100, (teacher.hours_per_week / teacher.max_hours) * 100);

  return (
    <div className="space-y-1">
      <div
        className="h-2 w-full rounded-full bg-neutral-200"
        role="meter"
        aria-label={`${teacher.name}: ${teacher.hours_per_week} of ${teacher.max_hours} hours a week`}
        aria-valuenow={teacher.hours_per_week}
        aria-valuemin={0}
        aria-valuemax={teacher.max_hours}
      >
        <div
          className={`h-2 rounded-full ${teacher.is_over_hours ? "bg-red-600" : "bg-teal-600"}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className={`text-xs ${teacher.is_over_hours ? "font-bold text-red-700" : "text-neutral-700"}`}>
        {teacher.hours_per_week} / {teacher.max_hours} hrs a week
      </p>
    </div>
  );
};

const Status = ({ teacher }: { teacher: TeacherRow }) => (
  <div className="flex flex-wrap gap-1">
    {teacher.is_over_hours && <Badge className="bg-red-100 text-red-900">Overload</Badge>}
    {teacher.is_overloaded && (
      <Badge className="bg-amber-100 text-amber-900">
        {teacher.assigned} of {teacher.limit} subjects
      </Badge>
    )}
    {!teacher.is_over_hours && !teacher.is_overloaded && <Badge className="bg-emerald-100 text-emerald-900">OK</Badge>}
  </div>
);

const Loads = ({ teacher }: { teacher: TeacherRow }) => (
  <ul className="space-y-0.5 text-xs text-neutral-800">
    {teacher.loads.map((load) => (
      <li key={`${load.section_id}-${load.subject}`}>
        <Link
          to={`/teacher-loading?section=${load.section_id}`}
          className="inline-flex min-h-11 items-center text-branding underline underline-offset-2 md:min-h-0 md:no-underline md:hover:underline"
        >
          {load.section}
        </Link>
        : {load.subject} ({load.hours_per_week} hrs)
      </li>
    ))}
  </ul>
);

/**
 * Load Distribution: every teacher in the user's grade levels, with the hours a week their
 * loading asks for (plotted or not) against their own limit, set on the Teachers page.
 */
const LoadDistribution = ({ termId }: { termId: number }) => {
  const { data, isPending, isError } = useTeacherLoadReport(termId);

  if (isPending) return <p className="text-sm text-neutral-600">Loading...</p>;
  if (isError || !data) return <p className="text-sm text-destructive">Could not load the teachers.</p>;

  const teachers = [...data.teachers].sort((a, b) => b.hours_per_week - a.hours_per_week || a.name.localeCompare(b.name));

  if (teachers.length === 0) {
    return <p className="text-sm text-neutral-700">No teacher has loading in your grade levels yet.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-700" aria-live="polite">
        {data.summary.teachers} {data.summary.teachers === 1 ? "teacher" : "teachers"}
        {data.summary.over_hours > 0 ? `, ${data.summary.over_hours} over their hours a week` : ", none over their hours a week"}.
        The limit of each teacher is set on the Teachers page.
      </p>

      <div className="hidden md:block overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-700">
            <tr>
              <th className="p-3 font-medium">Teacher</th>
              <th className="p-3 font-medium">Subjects and sections</th>
              <th className="p-3 font-medium w-56">Load</th>
              <th className="p-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((teacher) => (
              <tr key={teacher.id} className={`border-t align-top ${teacher.is_over_hours ? "bg-red-50" : ""}`}>
                <td className="p-3">
                  <p className="font-medium text-neutral-900">{teacher.name}</p>
                  {teacher.department && <p className="text-xs text-neutral-600">{teacher.department}</p>}
                </td>
                <td className="p-3">
                  <Loads teacher={teacher} />
                </td>
                <td className="p-3">
                  <HoursBar teacher={teacher} />
                </td>
                <td className="p-3">
                  <Status teacher={teacher} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-3 md:hidden">
        {teachers.map((teacher) => (
          <Card key={teacher.id} className={`shadow shadow-[#790D16]/40 ${teacher.is_over_hours ? "border-red-300" : ""}`}>
            <CardContent className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-teal-700">{teacher.name}</p>
                  {teacher.department && <p className="text-xs text-neutral-600">{teacher.department}</p>}
                </div>
                <Status teacher={teacher} />
              </div>
              <HoursBar teacher={teacher} />
              <Loads teacher={teacher} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default LoadDistribution;
