import { Link } from "react-router";
import { STATUS_LABELS } from "@/lib/schedule";
import type { AdminDashboard, ScheduleStatus } from "@/types/api";
import { Card, CardContent } from "@/components/ui/card";

const STAGES: ScheduleStatus[] = ["not_started", "draft", "pending", "approved", "rejected"];

type StatTileProp = {
  label: string;
  value: string | number;
  note: string;
  to: string;
};

export const StatTile = ({ label, value, note, to }: StatTileProp) => (
  <Link
    to={to}
    className="block rounded-xl focus-visible:outline-2 focus-visible:outline-[#790D16]"
  >
    <Card className="shadow shadow-[#790D16]/40 h-full hover:bg-[#790D16]/5 transition-colors">
      <CardContent className="space-y-1">
        <p className="text-xs text-neutral-700">{label}</p>
        <p className="text-lg sm:text-2xl font-bold text-teal-700 break-words">{value}</p>
        <p className="text-xs text-neutral-700">{note}</p>
      </CardContent>
    </Card>
  </Link>
);

export const ProgressSection = ({ rows }: { rows: AdminDashboard["progress"] }) => (
  <section className="space-y-3">
    <p className="font-medium text-teal-700">Schedules by grade level</p>

    {rows.length === 0 && (
      <p className="text-sm text-neutral-700">There are no sections in this school year yet.</p>
    )}

    {rows.length > 0 && (
      <>
        <div className="hidden md:block overflow-x-auto rounded-md border">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#790D16]/5 text-xs text-neutral-700">
              <tr>
                <th scope="col" className="p-3 font-medium">Grade</th>
                <th scope="col" className="p-3 font-medium">Sections</th>
                {STAGES.map((stage) => (
                  <th key={stage} scope="col" className="p-3 font-medium">
                    {STATUS_LABELS[stage]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.grade}>
                  <td className="p-3 font-medium text-teal-700">
                    Grade {row.grade} ({row.level})
                  </td>
                  <td className="p-3">{row.sections}</td>
                  {STAGES.map((stage) => (
                    <td key={stage} className="p-3">
                      {row[stage]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 gap-3 md:hidden">
          {rows.map((row) => (
            <Card key={row.grade} className="shadow shadow-[#790D16]/40">
              <CardContent className="space-y-2">
                <p className="font-medium text-teal-700">
                  Grade {row.grade} ({row.level}), {row.sections}{" "}
                  {row.sections === 1 ? "section" : "sections"}
                </p>
                <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 text-xs text-neutral-800">
                  {STAGES.map((stage) => (
                    <div key={stage} className="contents">
                      <dt className="text-neutral-600">{STATUS_LABELS[stage]}</dt>
                      <dd className="text-right font-medium">{row[stage]}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          ))}
        </div>
      </>
    )}
  </section>
);

export const OverloadedTeachers = ({ teachers }: { teachers: AdminDashboard["overloaded_teachers"] }) => (
  <section className="space-y-3">
    <p className="font-medium text-teal-700">Overloaded teachers</p>
    {teachers.length === 0 ? (
      <p className="text-sm text-neutral-700">No teacher is over their limit in this term.</p>
    ) : (
      <ul className="divide-y rounded-md border">
        {teachers.map(({ id, name, assigned, limit }) => (
          <li key={id} className="flex items-center justify-between gap-3 p-3 text-sm">
            <span className="font-medium text-neutral-900">{name}</span>
            <span className="shrink-0 text-xs text-neutral-700">
              {assigned} assigned, limit {limit}
            </span>
          </li>
        ))}
      </ul>
    )}
  </section>
);
