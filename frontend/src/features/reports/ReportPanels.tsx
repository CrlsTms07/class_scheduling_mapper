import React from "react";
import { Link } from "react-router";
import { Search } from "lucide-react";
import { useRoomUsage } from "@/api/reports";
import { useSections } from "@/api/schedule";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/schedule";
import type { ScheduleStatus } from "@/types/api";
import DownloadButtons from "@/components/global-component/DownloadButtons";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

const SELECT = "w-full [&_select]:h-11";

const SearchBox = ({ id, label, placeholder, value, onChange }: { id: string; label: string; placeholder: string; value: string; onChange: (value: string) => void }) => (
  <div className="space-y-1">
    <label htmlFor={id} className="text-sm text-neutral-800">
      {label}
    </label>
    <div className="relative">
      <Search className="absolute left-3 top-3.5 size-4 text-neutral-500" />
      <Input id={id} type="search" className="h-11 pl-9" placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  </div>
);

const STATUSES: ScheduleStatus[] = ["not_started", "draft", "pending", "approved", "rejected"];

/**
 * Schedules: every section's schedule at a glance, with its status, filtered by department,
 * grade, status or name. Each prints as the official Class Program, or downloads as data.
 */
export const SchedulesReport = ({ termId }: { termId: number }) => {
  const { data: sections, isPending, isError } = useSections(termId);
  const [level, setLevel] = React.useState("");
  const [grade, setGrade] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [search, setSearch] = React.useState("");

  if (isPending) return <p className="text-sm text-neutral-600">Loading...</p>;
  if (isError || !sections) return <p className="text-sm text-destructive">Could not load the sections.</p>;

  const grades = [...new Set(sections.filter((s) => !level || s.level === level).map((s) => s.grade))].sort((a, b) => a - b);
  // A Chairperson or Master Teacher sees one department only, so the filter would offer nothing.
  const hasBothDepartments = new Set(sections.map((s) => s.level)).size > 1;

  if (sections.length === 0) {
    return (
      <div className="space-y-3 rounded-xl border border-dashed p-6 text-center text-sm text-neutral-700">
        <p className="font-medium text-neutral-900">No sections in your grade levels yet</p>
        <p>Add the sections first. Their schedules show up here, ready to print.</p>
        <Link to="/sections?add=1" className={buttonVariants({ className: "h-11" })}>
          Add a section
        </Link>
      </div>
    );
  }
  const query = search.trim().toLowerCase();
  const filtered = sections.filter(
    (s) =>
      (!level || s.level === level) &&
      (!grade || s.grade === Number(grade)) &&
      (query === "" || `grade ${s.grade} ${s.name} ${s.adviser ?? ""}`.toLowerCase().includes(query)),
  );
  const shown = filtered.filter((s) => !status || s.status === status);
  const counts = STATUSES.map((key) => [key, filtered.filter((s) => s.status === key).length] as const).filter(([, count]) => count > 0);

  return (
    <div className="space-y-4">
      <div className={`grid gap-3 rounded-xl border bg-background p-3 shadow-sm sm:grid-cols-2 ${hasBothDepartments ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}>
        <div className={hasBothDepartments ? "space-y-1" : "hidden"}>
          <label htmlFor="schedules-level" className="text-sm text-neutral-800">
            Department
          </label>
          <NativeSelect id="schedules-level" className={SELECT} value={level} onChange={(event) => { setLevel(event.target.value); setGrade(""); }}>
            <NativeSelectOption value="">All departments</NativeSelectOption>
            <NativeSelectOption value="JHS">Junior High School</NativeSelectOption>
            <NativeSelectOption value="SHS">Senior High School</NativeSelectOption>
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <label htmlFor="schedules-grade" className="text-sm text-neutral-800">
            Grade level
          </label>
          <NativeSelect id="schedules-grade" className={SELECT} value={grade} onChange={(event) => setGrade(event.target.value)}>
            <NativeSelectOption value="">All grades</NativeSelectOption>
            {grades.map((item) => (
              <NativeSelectOption key={item} value={item}>
                Grade {item}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <label htmlFor="schedules-status" className="text-sm text-neutral-800">
            Status
          </label>
          <NativeSelect id="schedules-status" className={SELECT} value={status} onChange={(event) => setStatus(event.target.value)}>
            <NativeSelectOption value="">Any status</NativeSelectOption>
            {STATUSES.map((key) => (
              <NativeSelectOption key={key} value={key}>
                {STATUS_LABELS[key]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <SearchBox id="schedules-search" label="Search" placeholder="Section or adviser" value={search} onChange={setSearch} />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-700" aria-live="polite">
        <span>
          {shown.length} of {sections.length} {sections.length === 1 ? "section" : "sections"}
        </span>
        {counts.map(([key, count]) => (
          <Badge key={key} className={STATUS_COLORS[key]}>
            {STATUS_LABELS[key]}: {count}
          </Badge>
        ))}
      </div>

      {shown.length === 0 && <p className="text-sm text-neutral-700">No section matches what is chosen above.</p>}

      <ul className="grid gap-3 lg:grid-cols-2">
        {shown.map((section) => {
          const label = `Grade ${section.grade} – ${section.name}`;

          return (
            <li key={section.id}>
              <Card className="h-full border shadow-sm">
                <CardContent className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-neutral-900">{label}</p>
                      <p className="text-xs text-neutral-700">
                        {section.level} · Adviser: {section.adviser ?? "None yet"}
                      </p>
                    </div>
                    <Badge className={STATUS_COLORS[section.status]}>{STATUS_LABELS[section.status]}</Badge>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                    <Link to={`/schedule/sections/${section.id}`} className={buttonVariants({ variant: "outline", className: "h-11" })}>
                      View
                    </Link>
                    <DownloadButtons basePath={`/terms/${termId}/sections/${section.id}/class-program`} label={`Class Program of ${label}`} />
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

/**
 * Rooms and buildings: each building, its rooms, and the sections that use each room,
 * filtered by building, by use, or by a room or section name.
 */
export const RoomsReport = ({ termId }: { termId: number }) => {
  const { data, isPending, isError } = useRoomUsage(termId, true);
  const [building, setBuilding] = React.useState("");
  const [use, setUse] = React.useState<"" | "used" | "unused">("");
  const [search, setSearch] = React.useState("");

  if (isPending) return <p className="text-sm text-neutral-600">Loading...</p>;
  if (isError || !data) return <p className="text-sm text-destructive">Could not load the room usage.</p>;

  const query = search.trim().toLowerCase();
  const buildings = data.buildings
    .filter((item) => !building || item.name === building)
    .map((item) => ({
      ...item,
      rooms: item.rooms.filter(
        (room) =>
          (use === "" || (use === "used") === room.sections.length > 0) &&
          (query === "" ||
            `room ${room.room_number} ${room.room_name ?? ""}`.toLowerCase().includes(query) ||
            room.sections.some(({ label }) => label.toLowerCase().includes(query))),
      ),
    }))
    .filter((item) => item.rooms.length > 0);
  const roomCount = buildings.reduce((sum, item) => sum + item.rooms.length, 0);

  return (
    <div className="space-y-4">
      <DownloadButtons basePath={`/terms/${termId}/reports/room-usage`} label="Room Usage" />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <label htmlFor="rooms-building" className="text-sm text-neutral-800">
            Building
          </label>
          <NativeSelect id="rooms-building" className={SELECT} value={building} onChange={(event) => setBuilding(event.target.value)}>
            <NativeSelectOption value="">All buildings</NativeSelectOption>
            {data.buildings.map(({ name }) => (
              <NativeSelectOption key={name} value={name}>
                {name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <label htmlFor="rooms-use" className="text-sm text-neutral-800">
            Rooms
          </label>
          <NativeSelect id="rooms-use" className={SELECT} value={use} onChange={(event) => setUse(event.target.value as "" | "used" | "unused")}>
            <NativeSelectOption value="">All rooms</NativeSelectOption>
            <NativeSelectOption value="used">In use</NativeSelectOption>
            <NativeSelectOption value="unused">Not used yet</NativeSelectOption>
          </NativeSelect>
        </div>
        <SearchBox id="rooms-search" label="Search" placeholder="Room or section" value={search} onChange={setSearch} />
      </div>

      <p className="text-xs text-neutral-700" aria-live="polite">
        {roomCount} {roomCount === 1 ? "room" : "rooms"} in {buildings.length} {buildings.length === 1 ? "building" : "buildings"}
      </p>
      {data.buildings.length === 0 && <p className="text-sm text-neutral-700">There are no rooms yet.</p>}
      {data.buildings.length > 0 && buildings.length === 0 && <p className="text-sm text-neutral-700">No room matches what is chosen above.</p>}

      {buildings.map((item) => (
        <section key={item.name} aria-label={item.name} className="space-y-2">
          <p className="font-medium text-teal-700">
            {item.name} <span className="text-xs font-normal text-neutral-600">({item.rooms.length} {item.rooms.length === 1 ? "room" : "rooms"})</span>
          </p>
          <ul className="divide-y rounded-md border">
            {item.rooms.map((room) => (
              <li key={room.id} className="flex flex-col gap-3 p-3 text-sm lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-neutral-900">
                    Room {room.room_number}
                    {room.room_name && ` – ${room.room_name}`}
                    <span className="ml-2 text-xs font-normal text-neutral-600">{room.periods_per_week} periods a week</span>
                  </p>
                  {room.sections.length === 0 ? (
                    <p className="text-xs text-neutral-600">Not used yet.</p>
                  ) : (
                    <ul className="mt-1 flex flex-wrap gap-1">
                      {room.sections.map((section) => (
                        <li key={section.label}>
                          <Badge variant="secondary">
                            {section.label}: {section.periods_per_week}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-start">
                  <Link to={`/schedule/rooms/${room.id}`} className={buttonVariants({ variant: "outline", className: "h-11" })}>
                    View
                  </Link>
                  <DownloadButtons basePath={`/terms/${termId}/reports/rooms/${room.id}/schedule`} label={`Room Schedule of Room ${room.room_number}`} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};
