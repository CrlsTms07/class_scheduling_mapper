import { useGradeTimetable, useTeacherLoadReport } from "@/api/reports";
import DownloadButtons from "@/components/global-component/DownloadButtons";
import { Badge } from "@/components/ui/badge";

/** Everyone teaching in the user's grade levels, with their whole load. */
export const TeacherLoadReport = ({ termId }: { termId: number }) => {
  const { data, isPending, isError } = useTeacherLoadReport(termId);

  return (
    <div className="space-y-4">
      <DownloadButtons basePath={`/terms/${termId}/reports/teacher-load`} label="Teacher Load Report" />
      {isPending && <p className="text-sm text-neutral-600">Loading...</p>}
      {isError && <p className="text-sm text-destructive">Could not load the report.</p>}

      {data && (
        <>
          <p className="text-sm text-neutral-800">
            {data.summary.teachers} {data.summary.teachers === 1 ? "teacher" : "teachers"},{" "}
            {data.summary.overloaded} over their limit.
          </p>
          {data.teachers.length === 0 && (
            <p className="text-sm text-neutral-700">No teacher has loading yet.</p>
          )}
          <ul className="divide-y rounded-md border">
            {data.teachers.map((teacher) => (
              <li key={teacher.id} className="space-y-1 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-neutral-900">{teacher.name}</p>
                  {teacher.is_overloaded && <Badge className="bg-red-100 text-red-900">Overloaded</Badge>}
                </div>
                <p className="text-xs text-neutral-700">
                  {teacher.assigned} of {teacher.limit} assigned · {teacher.minutes} minutes a week
                  {teacher.department && ` · ${teacher.department}`}
                </p>
                {teacher.classes.length > 0 && (
                  <p className="text-xs text-neutral-700">{teacher.classes.join(", ")}</p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

/** What every section of a grade has, period by period. Phones get the download. */
export const GradeTimetableReport = ({ termId, grade }: { termId: number; grade: number }) => {
  const { data, isPending, isError } = useGradeTimetable(termId, grade);

  return (
    <div className="space-y-4">
      <DownloadButtons
        basePath={`/terms/${termId}/reports/grades/${grade}/timetable`}
        label={`Grade ${grade} Timetable`}
      />
      {isPending && <p className="text-sm text-neutral-600">Loading...</p>}
      {isError && <p className="text-sm text-destructive">Could not load the timetable.</p>}
      {data?.tables.length === 0 && (
        <p className="text-sm text-neutral-700">This grade has no sections with a bell schedule yet.</p>
      )}

      {data && data.tables.length > 0 && (
        <div className="hidden space-y-4 md:block">
          {data.isDraft && <Badge className="bg-amber-100 text-amber-900">Draft</Badge>}
          {data.tables.map((table, index) => (
            <section key={index} aria-label={table.name} className="space-y-1">
              <p className="text-sm font-medium text-teal-700">{table.name}</p>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#790D16]/5 text-neutral-700">
                    <tr>
                      <th scope="col" className="p-2 font-medium whitespace-nowrap">Time</th>
                      {table.sections.map(({ id, label }) => (
                        <th key={id} scope="col" className="p-2 font-medium">{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {table.rows.map((row) => (
                      <tr key={row.key}>
                        <td className="p-2 whitespace-nowrap">{row.time}</td>
                        {row.break !== null ? (
                          <td colSpan={table.sections.length} className="bg-neutral-200 p-2 text-center font-medium">
                            {row.break}
                          </td>
                        ) : (
                          table.sections.map(({ id }) => (
                            <td key={id} className="min-w-28 p-2 align-top">
                              {row.cells[id].map((group, position) => (
                                <div key={position}>
                                  <p className="font-medium">
                                    {group.subject}
                                    {group.days && ` (${group.days})`}
                                  </p>
                                  {group.teacher && <p className="text-neutral-700">{group.teacher}</p>}
                                  {group.room && <p className="text-neutral-700">{group.room}</p>}
                                </div>
                              ))}
                            </td>
                          ))
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
