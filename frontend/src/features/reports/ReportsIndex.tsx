import React from "react";
import { FolderUser } from "lucide-react";
import { Link } from "react-router";
import { useReportGrid, useReportOptions, useRoomUsage } from "@/api/reports";
import { useSelectedTerm } from "@/context/selectedTerm";
import { weekFromReportGrid } from "@/lib/weekGrid";
import type { ReportGrid } from "@/types/api";
import DownloadButtons from "@/components/global-component/DownloadButtons";
import { WeekTable } from "@/components/global-component/WeekView";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import ValidationReport from "./ValidationReport";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

const TABS = [
  { key: "class", label: "Class Program" },
  { key: "teacher", label: "Teacher Program" },
  { key: "room", label: "Room Schedule" },
  { key: "usage", label: "Room Usage" },
  { key: "validation", label: "Validation" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const HOW_IT_WORKS = [
  "Choose a form, then what it is for, and download it as PDF or XLSX.",
  "Forms follow the term in the selector at the top. A form with entries not yet approved prints with a DRAFT mark.",
  "The school details, titles and signatories come from Report Settings.",
  "Validation lists everything that needs checking in the term, section by section.",
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
      <p className="text-sm text-neutral-700">Nothing is scheduled here in this term yet.</p>
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

const UsageReport = ({ termId }: { termId: number }) => {
  const { data, isPending, isError } = useRoomUsage(termId, true);

  return (
    <div className="space-y-4">
      <DownloadButtons basePath={`/terms/${termId}/reports/room-usage`} label="Room Usage" />
      {isPending && <p className="text-sm text-neutral-600">Loading...</p>}
      {isError && <p className="text-sm text-destructive">Could not load the room usage.</p>}
      {data?.buildings.length === 0 && (
        <p className="text-sm text-neutral-700">There are no rooms yet.</p>
      )}
      {data?.buildings.map((building) => (
        <section key={building.name} aria-label={building.name} className="space-y-2">
          <p className="font-medium text-teal-700">{building.name}</p>
          <ul className="divide-y rounded-md border">
            {building.rooms.map((room) => (
              <li key={room.id} className="flex items-start justify-between gap-3 p-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-neutral-900">
                    Room {room.room_number}
                    {room.room_name && ` – ${room.room_name}`}
                  </p>
                  {room.sections.length === 0 ? (
                    <p className="text-xs text-neutral-600">Not used in this term.</p>
                  ) : (
                    room.sections.map((section) => (
                      <p key={section.label} className="text-xs text-neutral-700">
                        {section.label}: {section.periods_per_week} periods
                      </p>
                    ))
                  )}
                </div>
                <span className="shrink-0 text-xs text-neutral-700">
                  {room.periods_per_week} a week
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};

const ReportsIndex = () => {
  const { term, isPending: isTermPending } = useSelectedTerm();
  const { data: options, isPending, isError } = useReportOptions(term?.id);

  const [tab, setTab] = React.useState<TabKey>("class");
  const [sectionId, setSectionId] = React.useState<number>();
  const [teacherId, setTeacherId] = React.useState<number>();
  const [roomId, setRoomId] = React.useState<number>();

  if (!term) {
    return (
      <p className="p-6 text-sm text-neutral-700">
        {isTermPending ? "Loading..." : "A school year has to be started first."}
      </p>
    );
  }

  const section = options?.sections.find(({ id }) => id === sectionId) ?? options?.sections[0];
  const teacher = options?.teachers.find(({ id }) => id === teacherId) ?? options?.teachers[0];
  const room = options?.rooms.find(({ id }) => id === roomId) ?? options?.rooms[0];

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-[#790D16]/20 rounded-sm">
          <FolderUser className="text-branding size-5" />
        </div>
        <div>
          <p className="text-branding text-xl font-medium">Reports</p>
          <p className="text-sm text-neutral-700">
            Official forms for {term.name}, SY {term.school_year.name}.
          </p>
        </div>
      </div>

      <details className="rounded-md border bg-background">
        <summary className="flex min-h-11 cursor-pointer items-center p-3 text-sm font-medium">
          How this works
        </summary>
        <ul className="list-disc space-y-1 px-3 pb-3 pl-8 text-sm text-neutral-700">
          {HOW_IT_WORKS.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>

      <div role="tablist" aria-label="Form" className="grid grid-cols-2 sm:grid-cols-5 gap-2 lg:max-w-4xl">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={key === tab}
            onClick={() => setTab(key)}
            className={`min-h-11 rounded-md border px-2 text-xs sm:text-sm font-medium ${
              key === tab
                ? "bg-[#790D16] text-white border-[#790D16]"
                : "bg-background text-neutral-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isPending && <p className="text-sm text-neutral-600">Loading...</p>}
      {isError && <p className="text-sm text-destructive">Could not load the choices.</p>}

      {options && tab === "class" && (
        <div className="space-y-4">
          <Picker
            id="report-section"
            label="Section"
            emptyText="There are no sections in your grade levels yet."
            options={options.sections}
            value={section?.id}
            onChange={setSectionId}
          />
          {section && (
            <>
              <DownloadButtons
                basePath={`/terms/${term.id}/sections/${section.id}/class-program`}
                label={`Class Program of ${section.label}`}
              />
              <Link
                to={`/schedule/sections/${section.id}`}
                className={buttonVariants({ variant: "link", className: "h-11 px-0" })}
              >
                See this schedule on screen
              </Link>
            </>
          )}
        </div>
      )}

      {options && tab === "teacher" && (
        <div className="space-y-4">
          <Picker
            id="report-teacher"
            label="Teacher"
            emptyText="No teacher has loading in your grade levels in this term yet."
            options={options.teachers}
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

      {options && tab === "room" && (
        <div className="space-y-4">
          <Picker
            id="report-room"
            label="Room"
            emptyText="There are no rooms yet."
            options={options.rooms}
            value={room?.id}
            onChange={setRoomId}
          />
          {room && (
            <GridReport
              key={room.id}
              termId={term.id}
              path={`rooms/${room.id}`}
              fileName="schedule"
              label={`Room Schedule of ${room.label}`}
            />
          )}
        </div>
      )}

      {tab === "usage" && <UsageReport termId={term.id} />}
      {tab === "validation" && <ValidationReport termId={term.id} />}
    </div>
  );
};

export default ReportsIndex;
