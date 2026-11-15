import React from "react";
import { CalendarDays, DoorClosed, FolderUser, LayoutGrid, Scale, ShieldCheck, UserRound, UsersRound, type LucideIcon } from "lucide-react";
import { useSearchParams } from "react-router";
import { useReportGrid, useReportOptions } from "@/api/reports";
import { useSelectedTerm } from "@/context/selectedTerm";
import { weekFromReportGrid } from "@/lib/weekGrid";
import type { ReportGrid } from "@/types/api";
import DownloadButtons from "@/components/global-component/DownloadButtons";
import PageHeader from "@/components/global-component/PageHeader";
import { WeekTable } from "@/components/global-component/WeekView";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

import { RoomsReport, SchedulesReport } from "./ReportPanels";
import { AdviserSummaryReport, GradeTimetableReport, TeacherLoadReport } from "./SummaryReports";
import ValidationReport from "./ValidationReport";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

const TABS: { key: string; label: string; icon: LucideIcon; about: string }[] = [
  { key: "schedules", label: "Schedules", icon: CalendarDays, about: "Every section with its status. Each prints as the official Class Program." },
  { key: "rooms", label: "Rooms & Buildings", icon: DoorClosed, about: "Which sections use each room, and the Room Schedule of each room." },
  { key: "timetable", label: "Grade Timetable", icon: LayoutGrid, about: "Every section of a grade level side by side." },
  { key: "teacher", label: "Teacher Program", icon: UserRound, about: "One teacher's week, with the total teaching minutes." },
  { key: "load", label: "Teacher Load", icon: Scale, about: "Who carries what: subjects and hours a week against each limit." },
  { key: "advisers", label: "Advisers", icon: UsersRound, about: "Every section with its room, adviser and co-adviser, grade by grade." },
  { key: "validation", label: "Validation", icon: ShieldCheck, about: "Everything that needs checking, section by section." },
];

type TabKey = "schedules" | "rooms" | "timetable" | "teacher" | "load" | "advisers" | "validation";


const HOW_IT_WORKS = [
  "Choose a report, narrow it down with the filters, then print it as PDF or download it as XLSX or CSV.",
  "Schedules lists every section with its status. Rooms & Buildings shows which sections use each room.",
  "Forms follow the selector at the top. A form with entries not yet approved prints with a DRAFT mark.",
  "The school details, titles and signatories come from Report Settings.",
  "Validation lists everything that needs checking, section by section.",
  "Teacher Load shows who carries what. Grade Timetable shows every section of a grade side by side.",
];

type PickerProp = {
  id: string;
  label: string;
  emptyText: string;
  options: { id: number; label: string }[] | undefined;
  value: number | undefined;
  onChange: (id: number) => void;
};

const Picker = ({ id, label, emptyText, options, value, onChange }: PickerProp) => {
  if (options?.length === 0) {
    return <p className="text-sm text-neutral-700">{emptyText}</p>;
  }

  return (
    <div className="space-y-1 sm:w-80">
      <label htmlFor={id} className="text-sm text-neutral-800">
        {label}
      </label>
      <NativeSelect
        id={id}
        className="w-full [&_select]:h-11"
        value={value ?? ""}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {options?.map((option) => (
          <NativeSelectOption key={option.id} value={option.id}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
};

/** A preview that fits the screen. Phones get the download buttons instead. */
const GridPreview = ({ grid }: { grid: ReportGrid }) => (
  <div className="hidden md:block space-y-2">
    <div className="flex flex-wrap items-center gap-2">
      <p className="font-medium text-teal-700">{grid.heading}</p>
      {grid.isDraft && <Badge className="bg-amber-100 text-amber-900">Draft</Badge>}
    </div>
    {grid.details.length > 0 && (
      <p className="text-xs text-neutral-700">{grid.details.join(" · ")}</p>
    )}

    {grid.rows.length === 0 ? (
      <p className="text-sm text-neutral-700">Nothing is scheduled here yet.</p>
    ) : (
      <WeekTable week={weekFromReportGrid(grid)} />
    )}
    <p className="text-sm text-neutral-800">
      Total per week: <span className="font-medium">{grid.totals.week} minutes</span>
      {grid.totals.week > 0 && ` (${grid.totals.week_duration})`}
    </p>
  </div>
);

type GridReportProp = {
  termId: number;
  path: string;
  fileName: string;
  label: string;
};

const GridReport = ({ termId, path, fileName, label }: GridReportProp) => {
  const { data, isPending, isError } = useReportGrid(termId, path);

  return (
    <div className="space-y-4">
      {isPending && <p className="hidden md:block text-sm text-neutral-600">Loading the preview...</p>}
      {isError && <p className="text-sm text-destructive">Could not load the preview.</p>}
      {data && <GridPreview grid={data} />}
      <DownloadButtons basePath={`/terms/${termId}/reports/${path}/${fileName}`} label={label} />
    </div>
  );
};

const ReportsIndex = () => {
  const { term, isPending: isTermPending } = useSelectedTerm();
  const { data: options, isPending, isError } = useReportOptions(term?.id);

  // Opened from elsewhere with ?tab=advisers, that report is already showing.
  const [params] = useSearchParams();
  const [tab, setTab] = React.useState<TabKey>(() =>
    TABS.some(({ key }) => key === params.get("tab")) ? (params.get("tab") as TabKey) : "schedules",
  );
  const [teacherId, setTeacherId] = React.useState<number>();
  const [teacherSearch, setTeacherSearch] = React.useState("");
  const [timetableLevel, setTimetableLevel] = React.useState<"" | "JHS" | "SHS">("");
  const [gradeChoice, setGradeChoice] = React.useState<number>();

  if (!term) {
    return (
      <p className="p-6 text-sm text-neutral-700">
        {isTermPending ? "Loading..." : "A school year has to be started first."}
      </p>
    );
  }

  const teacherQuery = teacherSearch.trim().toLowerCase();
  const teachers = options?.teachers.filter(({ label }) => label.toLowerCase().includes(teacherQuery));
  const teacher = teachers?.find(({ id }) => id === teacherId) ?? teachers?.[0];
  const timetableGrades = options?.grades.filter((item) => !timetableLevel || (item <= 10 ? "JHS" : "SHS") === timetableLevel);
  const grade = timetableGrades?.find((item) => item === gradeChoice) ?? timetableGrades?.[0];

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <PageHeader
        icon={FolderUser}
        title="Reports"
        description={`Official forms for ${term.name}, SY ${term.school_year.name}. PDF, XLSX or CSV.`}
      />

      <details className="rounded-xl border bg-background shadow-sm">
        <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-medium text-neutral-800">
          How this works
        </summary>
        <ul className="list-disc space-y-1 px-3 pb-3 pl-8 text-sm text-neutral-700">
          {HOW_IT_WORKS.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>

      <div className="space-y-2">
        <div role="tablist" aria-label="Report" className="grid grid-cols-2 gap-1 rounded-xl border bg-neutral-50 p-1 sm:grid-cols-4 xl:grid-cols-7">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={key === tab}
              onClick={() => setTab(key as TabKey)}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-lg px-2 text-xs font-medium transition-colors sm:text-sm ${
                key === tab ? "bg-[#790D16] text-white shadow-sm" : "text-neutral-700 hover:bg-background"
              }`}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </button>
          ))}
        </div>
        <p className="px-1 text-sm text-neutral-700">{TABS.find(({ key }) => key === tab)?.about}</p>
      </div>

      {isPending && <p className="text-sm text-neutral-600">Loading...</p>}
      {isError && <p className="text-sm text-destructive">Could not load the choices.</p>}

      {tab === "schedules" && <SchedulesReport termId={term.id} />}
      {tab === "rooms" && <RoomsReport termId={term.id} />}

      {options && tab === "teacher" && (
        <div className="space-y-4">
          <div className="space-y-1 sm:w-80">
            <label htmlFor="report-teacher-search" className="text-sm text-neutral-800">
              Find a teacher
            </label>
            <Input
              id="report-teacher-search"
              type="search"
              className="h-11"
              placeholder="Type a name"
              value={teacherSearch}
              onChange={(event) => setTeacherSearch(event.target.value)}
            />
          </div>
          <Picker
            id="report-teacher"
            label="Teacher"
            emptyText="No teacher has loading in your grade levels yet."
            options={teachers}
            value={teacher?.id}
            onChange={setTeacherId}
          />
          {teacher && (
            <GridReport
              key={teacher.id}
              termId={term.id}
              path={`teachers/${teacher.id}`}
              fileName="program"
              label={`Teacher Program of ${teacher.label}`}
            />
          )}
        </div>
      )}

      {tab === "validation" && <ValidationReport termId={term.id} />}
      {tab === "load" && <TeacherLoadReport termId={term.id} />}
      {tab === "advisers" && <AdviserSummaryReport termId={term.id} />}

      {options && tab === "timetable" && (
        <div className="space-y-4">
          <div className="space-y-1 sm:w-80">
            <label htmlFor="report-timetable-level" className="text-sm text-neutral-800">
              Department
            </label>
            <NativeSelect
              id="report-timetable-level"
              className="w-full [&_select]:h-11"
              value={timetableLevel}
              onChange={(event) => setTimetableLevel(event.target.value as "" | "JHS" | "SHS")}
            >
              <NativeSelectOption value="">All departments</NativeSelectOption>
              <NativeSelectOption value="JHS">Junior High School</NativeSelectOption>
              <NativeSelectOption value="SHS">Senior High School</NativeSelectOption>
            </NativeSelect>
          </div>
          <Picker
            id="report-grade"
            label="Grade level"
            emptyText="No grade level here is assigned to you."
            options={timetableGrades?.map((item) => ({ id: item, label: `Grade ${item}` }))}
            value={grade}
            onChange={setGradeChoice}
          />
          {grade !== undefined && <GradeTimetableReport key={grade} termId={term.id} grade={grade} />}
        </div>
      )}
    </div>
  );
};

export default ReportsIndex;
