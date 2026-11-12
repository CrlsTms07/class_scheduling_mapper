import React from "react";
import { Link, useSearchParams } from "react-router";
import { Blocks, Eye, Pencil, Plus, Printer, SearchIcon, SlidersHorizontal, Trash2, UsersRound } from "lucide-react";
import { useManagedSections, useSectionOptions } from "@/api/sections";
import { useSelectedTerm } from "@/context/selectedTerm";
import { filterSections, missingAdviserCount } from "@/lib/sections";
import { SHIFT_LABELS } from "@/lib/timeSlots";
import type { ManagedSection } from "@/types/api";
import { Crumbs } from "@/components/global-component/ScheduleUi";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import SectionDeleteDialog from "./SectionDeleteDialog";
import SectionSheet from "./SectionSheet";

const HOW_IT_WORKS = [
  "Sections are encoded once per school year, since they change yearly.",
  "The adviser, room and class size can be added now or later. A section without an adviser gets a flag in its schedule.",
  "View opens the section's schedule: its classes day by day, and the timetable.",
  "Once a section has loading or schedules, its grade and shift lock and it can no longer be deleted.",
];

type SectionHandlers = {
  onEdit: (section: ManagedSection) => void;
  onDelete: (section: ManagedSection) => void;
};

/** The track and the room, the details that tell sections apart at a glance. */
const placeOf = (section: ManagedSection) =>
  [section.track, section.home_room].filter(Boolean).join(" · ") || (section.level === "SHS" ? "Senior High" : "Junior High");

/** View (the section's schedule), Edit and Delete. */
const Actions = ({ section, onEdit, onDelete }: SectionHandlers & { section: ManagedSection }) => (
  <div className="flex items-center gap-1">
    <Link to={`/schedule/sections/${section.id}`} aria-label={`View ${section.label}`} className={buttonVariants({ variant: "outline", className: "h-11" })}>
      <Eye />
      View
    </Link>
    <Button type="button" variant="ghost" size="icon" className="size-11 text-neutral-600 hover:text-branding" aria-label={`Edit ${section.label}`} title="Edit" onClick={() => onEdit(section)}>
      <Pencil />
    </Button>
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-11 text-neutral-600 hover:bg-red-50 hover:text-destructive"
      aria-label={`Delete ${section.label}`}
      title="Delete"
      onClick={() => onDelete(section)}
    >
      <Trash2 />
    </Button>
  </div>
);

const Students = ({ size }: { size: number | null }) => (
  <span className="inline-flex items-center gap-1.5 text-sm text-neutral-800">
    <UsersRound className="size-4 text-branding" aria-hidden />
    {size ?? <span className="text-neutral-500">–</span>}
  </span>
);

const SectionsTable = ({ sections, ...handlers }: SectionHandlers & { sections: ManagedSection[] }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-left text-sm">
      <thead className="border-b text-neutral-900">
        <tr>
          <th scope="col" className="p-3 font-medium">Section Name</th>
          <th scope="col" className="p-3 font-medium">Grade Level</th>
          <th scope="col" className="p-3 font-medium">Shift</th>
          <th scope="col" className="p-3 font-medium">Adviser</th>
          <th scope="col" className="p-3 font-medium">No. of Students</th>
          <th scope="col" className="p-3 font-medium">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {sections.map((section) => (
          <tr key={section.id} className="hover:bg-neutral-50">
            <td className="p-3">
              <p className="font-semibold text-teal-700">{section.label}</p>
              <p className="text-xs text-neutral-600">{placeOf(section)}</p>
            </td>
            <td className="p-3 text-neutral-900">Grade {section.grade}</td>
            <td className="p-3">
              <Badge variant="secondary">{SHIFT_LABELS[section.shift]}</Badge>
            </td>
            <td className="p-3">
              {section.adviser ?? <Badge className="bg-amber-100 text-amber-900">No adviser</Badge>}
              {section.co_adviser && <span className="block text-xs text-neutral-600">Co: {section.co_adviser}</span>}
            </td>
            <td className="p-3">
              <Students size={section.class_size} />
            </td>
            <td className="p-1">
              <Actions section={section} {...handlers} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const SectionCard = ({ section, ...handlers }: SectionHandlers & { section: ManagedSection }) => (
  <article className="space-y-3 rounded-xl border bg-background p-4">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="font-semibold text-teal-700">{section.label}</p>
        <p className="text-xs text-neutral-600">{placeOf(section)}</p>
      </div>
      <Badge variant="secondary">{SHIFT_LABELS[section.shift]}</Badge>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span className="text-neutral-700">Adviser: {section.adviser ?? "None yet"}</span>
      <Students size={section.class_size} />
    </div>
    <div className="border-t pt-2">
      <Actions section={section} {...handlers} />
    </div>
  </article>
);

const SectionsIndex = () => {
  const { term, isPending: isTermPending } = useSelectedTerm();
  const year = term?.school_year;
  const { data: sections, isPending, isError } = useManagedSections(year?.id);
  // Also loaded now, so the form has its choices the moment it opens.
  const { data: options } = useSectionOptions(year?.id);

  const [search, setSearch] = React.useState("");
  const [grade, setGrade] = React.useState("");
  const [areFiltersOpen, setAreFiltersOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<ManagedSection | null>(null);
  // undefined = closed, null = adding a new section
  // Opened from "Add section" elsewhere (?add=1), the form for a new section is already open.
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = React.useState<ManagedSection | null | undefined>(params.get("add") === "1" ? null : undefined);

  // Only the grade levels the user handles: Senior High for a Master Teacher, Junior High for a Chairperson.
  const grades = options?.grade_levels ?? [];
  const departments = [...new Set(grades.map(({ level }) => (level === "SHS" ? "Senior High" : "Junior High")))];
  const shown = filterSections(sections ?? [], search, grade);
  const missingAdvisers = missingAdviserCount(sections ?? []);

  if (!year) {
    return <p className="p-6 text-sm text-neutral-700">{isTermPending ? "Loading..." : "Start a school year first, on the School Years page."}</p>;
  }

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <Crumbs items={[{ label: "Home", to: "/dashboard" }, { label: "Sections" }]} />
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-branding">Section Directory</h1>
        <p className="text-sm text-neutral-700">
          View, search and manage every section in one place. SY {year.name}
          {departments.length === 1 ? `, ${departments[0]}` : ""}.
        </p>
      </div>

      {missingAdvisers > 0 && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {missingAdvisers} {missingAdvisers === 1 ? "section has" : "sections have"} no adviser yet.
        </p>
      )}

      <div className="space-y-4 rounded-2xl border bg-background p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <InputGroup className="h-11 sm:max-w-xs">
            <InputGroupInput aria-label="Search" className="h-11" placeholder="Search..." value={search} onChange={(event) => setSearch(event.target.value)} />
            <InputGroupAddon align="inline-start">
              <SearchIcon className="text-muted-foreground" />
            </InputGroupAddon>
          </InputGroup>
          <div className="flex items-center gap-2">
            <Button type="button" className="h-11 flex-1 sm:flex-none" aria-label="Add section" onClick={() => setEditing(null)}>
              <Plus />
              Section
            </Button>
            <Link
              to="/reports?tab=advisers"
              className={buttonVariants({ variant: "outline", className: "h-11 min-w-11" })}
              aria-label="Adviser summary"
              title="Adviser summary: rooms, advisers and co-advisers, ready to print"
            >
              <Printer />
              <span className="hidden sm:inline">Adviser summary</span>
            </Link>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-11"
              aria-label="Filters"
              aria-expanded={areFiltersOpen}
              title="Filters"
              onClick={() => setAreFiltersOpen(!areFiltersOpen)}
            >
              <SlidersHorizontal />
            </Button>
          </div>
        </div>

        {areFiltersOpen && (
          <div className="grid gap-3 rounded-lg bg-neutral-50 p-3 sm:grid-cols-[14rem_minmax(0,1fr)]">
            <div className="space-y-1">
              <label htmlFor="grade-filter" className="text-sm text-neutral-800">
                Grade level
              </label>
              <NativeSelect id="grade-filter" className="w-full [&_select]:h-11" value={grade} onChange={(event) => setGrade(event.target.value)}>
                <NativeSelectOption value="">All grades</NativeSelectOption>
                {grades.map((item) => (
                  <NativeSelectOption key={item.id} value={String(item.grade)}>
                    Grade {item.grade}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <ul className="list-disc space-y-1 self-center pl-5 text-xs text-neutral-700">
              {HOW_IT_WORKS.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}

        {isPending && <p className="text-sm text-neutral-600">Loading...</p>}
        {isError && <p className="text-sm text-destructive">Could not load the sections.</p>}
        {sections?.length === 0 && (
          <div className="space-y-2 py-8 text-center text-sm text-neutral-700">
            <Blocks className="mx-auto size-8 text-branding/60" />
            <p>There are no sections in this school year yet. Add the first one.</p>
          </div>
        )}
        {sections && sections.length > 0 && shown.length === 0 && <p className="py-6 text-center text-sm text-neutral-700">No section matches your search.</p>}

        {shown.length > 0 && (
          <>
            <div className="hidden md:block">
              <SectionsTable sections={shown} onEdit={setEditing} onDelete={setDeleting} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:hidden">
              {shown.map((section) => (
                <SectionCard key={section.id} section={section} onEdit={setEditing} onDelete={setDeleting} />
              ))}
            </div>
            <p className="text-center text-xs text-neutral-500">
              {shown.length === (sections?.length ?? 0) ? `All ${shown.length} sections.` : `${shown.length} of ${sections?.length ?? 0} sections.`}
            </p>
          </>
        )}
      </div>

      {deleting && <SectionDeleteDialog section={deleting} onClose={() => setDeleting(null)} />}
      {editing !== undefined && (
        <SectionSheet
          key={editing?.id ?? "new"}
          yearId={year.id}
          yearName={year.name}
          section={editing}
          onClose={() => {
            setEditing(undefined);
            if (params.has("add")) setParams({}, { replace: true });
          }}
        />
      )}
    </div>
  );
};

export default SectionsIndex;
