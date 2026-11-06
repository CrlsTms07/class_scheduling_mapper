import React from "react";
import { Blocks, Filter, Pencil, Plus, SearchIcon } from "lucide-react";
import { useManagedSections, useSectionOptions } from "@/api/sections";
import { useSelectedTerm } from "@/context/selectedTerm";
import { filterSections, missingAdviserCount } from "@/lib/sections";
import { SHIFT_LABELS } from "@/lib/timeSlots";
import type { ManagedSection } from "@/types/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import SectionSheet from "./SectionSheet";

const GRADES = [7, 8, 9, 10, 11, 12];

const HOW_IT_WORKS = [
  "Sections are encoded once per school year, since they change yearly.",
  "The adviser, room and class size can be added now or later. A section without an adviser gets a flag in its schedule.",
  "After this, the Chairperson or Master Teacher loads teachers and plots the section's schedule.",
  "Once a section has loading or schedules, its grade and shift lock and it can no longer be deleted.",
];

const EmptyValue = ({ value }: { value: string | number | null }) =>
  value === null ? <span className="text-neutral-500">None yet</span> : <>{value}</>;

type SectionRowProp = {
  section: ManagedSection;
  onEdit: (section: ManagedSection) => void;
};

const SectionCard = ({ section, onEdit }: SectionRowProp) => (
  <Card className="shadow shadow-[#790D16]/40">
    <CardContent className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-teal-700 font-bold text-base">{section.label}</p>
          <div className="flex flex-wrap gap-1">
            <Badge variant="secondary">{SHIFT_LABELS[section.shift]}</Badge>
            {section.track && <Badge variant="secondary">{section.track}</Badge>}
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11 shrink-0"
          aria-label={`Edit ${section.label}`}
          onClick={() => onEdit(section)}
        >
          <Pencil />
        </Button>
      </div>
      <dl className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-2 text-xs text-neutral-800">
        <dt className="text-neutral-600">Adviser</dt>
        <dd><EmptyValue value={section.adviser} /></dd>
        {section.level === "JHS" && (
          <>
            <dt className="text-neutral-600">Home room</dt>
            <dd><EmptyValue value={section.home_room} /></dd>
          </>
        )}
        <dt className="text-neutral-600">Class size</dt>
        <dd><EmptyValue value={section.class_size} /></dd>
      </dl>
    </CardContent>
  </Card>
);

const SectionsTable = ({
  sections,
  onEdit,
}: {
  sections: ManagedSection[];
  onEdit: (section: ManagedSection) => void;
}) => (
  <div className="overflow-x-auto rounded-md border">
    <table className="w-full text-left text-sm">
      <thead className="bg-[#790D16]/5 text-xs text-neutral-700">
        <tr>
          <th scope="col" className="p-3 font-medium">Section</th>
          <th scope="col" className="p-3 font-medium">Track</th>
          <th scope="col" className="p-3 font-medium">Shift</th>
          <th scope="col" className="p-3 font-medium">Adviser</th>
          <th scope="col" className="p-3 font-medium">Home room</th>
          <th scope="col" className="p-3 font-medium">Size</th>
          <th scope="col" className="p-3"><span className="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {sections.map((section) => (
          <tr key={section.id}>
            <td className="p-3 font-medium text-teal-700">{section.label}</td>
            <td className="p-3">{section.track ?? "–"}</td>
            <td className="p-3">{SHIFT_LABELS[section.shift]}</td>
            <td className="p-3"><EmptyValue value={section.adviser} /></td>
            <td className="p-3">
              {section.level === "SHS" ? "–" : <EmptyValue value={section.home_room} />}
            </td>
            <td className="p-3"><EmptyValue value={section.class_size} /></td>
            <td className="p-1 text-right">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11"
                aria-label={`Edit ${section.label}`}
                onClick={() => onEdit(section)}
              >
                <Pencil />
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const SectionsIndex = () => {
  const { term, isPending: isTermPending } = useSelectedTerm();
  const year = term?.school_year;
  const { data: sections, isPending, isError } = useManagedSections(year?.id);
  useSectionOptions(year?.id); // Loaded now, so the form has its choices the moment it opens.

  const [search, setSearch] = React.useState("");
  const [grade, setGrade] = React.useState("");
  const [areFiltersOpen, setAreFiltersOpen] = React.useState(false);
  // undefined = closed, null = adding a new section
  const [editing, setEditing] = React.useState<ManagedSection | null | undefined>(undefined);

  const shown = filterSections(sections ?? [], search, grade);
  const missingAdvisers = missingAdviserCount(sections ?? []);

  if (!year) {
    return (
      <p className="p-6 text-sm text-neutral-700">
        {isTermPending ? "Loading..." : "Start a school year first, on the School Years page."}
      </p>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-[#790D16]/20 rounded-sm">
            <Blocks className="text-branding size-5" />
          </div>
          <div>
            <p className="text-branding text-xl font-medium">Sections</p>
            <p className="text-sm text-neutral-700">
              {sections ? `${sections.length} in SY ${year.name}` : `SY ${year.name}`}
            </p>
          </div>
        </div>
        <Button type="button" className="h-11 shrink-0" onClick={() => setEditing(null)}>
          <Plus />
          Add section
        </Button>
      </div>

      <details className="rounded-md border bg-background">
        <summary className="flex min-h-11 cursor-pointer items-center p-3 text-sm font-medium">
          How this works
        </summary>
        <ol className="list-decimal space-y-1 px-3 pb-3 pl-8 text-sm text-neutral-700">
          {HOW_IT_WORKS.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      </details>

      {/* On phones the filters stay folded until they are needed. */}
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full md:hidden"
        aria-expanded={areFiltersOpen}
        onClick={() => setAreFiltersOpen(!areFiltersOpen)}
      >
        <Filter />
        Search and filter
      </Button>
      <div
        className={`flex-col sm:flex-row gap-3 sm:items-end md:flex ${
          areFiltersOpen ? "flex" : "hidden"
        }`}
      >
        <div className="space-y-1 sm:w-72">
          <label htmlFor="section-search" className="text-sm text-neutral-800">
            Search
          </label>
          <InputGroup className="h-11">
            <InputGroupInput
              id="section-search"
              className="h-11"
              placeholder="Section, adviser or room"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <InputGroupAddon align="inline-start">
              <SearchIcon className="text-muted-foreground" />
            </InputGroupAddon>
          </InputGroup>
        </div>
        <div className="space-y-1 sm:w-48">
          <label htmlFor="grade-filter" className="text-sm text-neutral-800">
            Grade level
          </label>
          <NativeSelect
            id="grade-filter"
            className="w-full [&_select]:h-11"
            value={grade}
            onChange={(event) => setGrade(event.target.value)}
          >
            <NativeSelectOption value="">All grades</NativeSelectOption>
            {GRADES.map((item) => (
              <NativeSelectOption key={item} value={String(item)}>
                Grade {item}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>

      {isPending && <p className="text-sm text-neutral-600">Loading...</p>}
      {isError && <p className="text-sm text-destructive">Could not load the sections.</p>}

      {missingAdvisers > 0 && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {missingAdvisers} {missingAdvisers === 1 ? "section has" : "sections have"} no adviser yet.
        </p>
      )}

      {sections?.length === 0 && (
        <p className="text-sm text-neutral-700">
          There are no sections in this school year yet. Add the first one.
        </p>
      )}
      {sections && sections.length > 0 && shown.length === 0 && (
        <p className="text-sm text-neutral-700">No section matches your search.</p>
      )}

      {shown.length > 0 && (
        <>
          <div className="hidden md:block">
            <SectionsTable sections={shown} onEdit={setEditing} />
          </div>
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {shown.map((section) => (
              <SectionCard key={section.id} section={section} onEdit={setEditing} />
            ))}
          </div>
        </>
      )}

      {editing !== undefined && (
        <SectionSheet
          key={editing?.id ?? "new"}
          yearId={year.id}
          yearName={year.name}
          section={editing}
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
  );
};

export default SectionsIndex;
