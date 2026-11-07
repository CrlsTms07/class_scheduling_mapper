import React from "react";
import { CircleUserRound, Filter, Pencil, Plus, SearchIcon } from "lucide-react";
import { usePersonnelOptions, useTeachers } from "@/api/teachers";
import { useSelectedTerm } from "@/context/selectedTerm";
import { filterTeachers, isOverLimit, PERSONNEL_TYPE_LABELS } from "@/lib/teachers";
import { SHIFT_LABELS } from "@/lib/timeSlots";
import type { ManagedTeacher } from "@/types/api";
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
import TeacherSheet from "./TeacherSheet";

const HOW_IT_WORKS = [
  "Add everyone here, with or without a login account. These records are reused every school year.",
  "Only active teaching personnel can be advisers or be given subjects.",
  "The load shown is for the term in the selector at the top.",
  "Someone with an advisory or loading cannot be deleted. Mark them as inactive instead, so old schedules stay correct.",
];

const LoadText = ({ teacher }: { teacher: ManagedTeacher }) => (
  <span className={isOverLimit(teacher) ? "font-medium text-red-800" : ""}>
    {teacher.assigned} of {teacher.max_subjects}
    {isOverLimit(teacher) && " (over the limit)"}
  </span>
);

const StatusBadge = ({ teacher }: { teacher: ManagedTeacher }) => (
  <Badge className={teacher.is_active ? "bg-emerald-100 text-emerald-900" : "bg-neutral-200 text-neutral-800"}>
    {teacher.is_active ? "Active" : "Inactive"}
  </Badge>
);

type RowProp = {
  teacher: ManagedTeacher;
  onOpen: (teacher: ManagedTeacher) => void;
  className?: string;
};

const OpenButton = ({ teacher, onOpen, className = "size-11" }: RowProp) => (
  <Button
    type="button"
    variant="outline"
    size="icon"
    className={`shrink-0 ${className}`}
    aria-label={`Edit ${teacher.printed_name}`}
    onClick={() => onOpen(teacher)}
  >
    <Pencil />
  </Button>
);

const TeacherCard = (prop: RowProp) => {
  const { teacher } = prop;

  return (
    <Card className="shadow shadow-[#790D16]/40">
      <CardContent className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-teal-700 font-bold text-base">{teacher.printed_name}</p>
            <div className="flex flex-wrap gap-1">
              <StatusBadge teacher={teacher} />
              <Badge variant="secondary">{PERSONNEL_TYPE_LABELS[teacher.personnel_type]}</Badge>
            </div>
          </div>
          <OpenButton {...prop} />
        </div>
        <dl className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-2 text-xs text-neutral-800">
          <dt className="text-neutral-600">Department</dt>
          <dd>{teacher.department ?? "None yet"}</dd>
          <dt className="text-neutral-600">Designation</dt>
          <dd>{teacher.designation ?? "None yet"}</dd>
          <dt className="text-neutral-600">Shift</dt>
          <dd>{SHIFT_LABELS[teacher.shift]}</dd>
          <dt className="text-neutral-600">Load</dt>
          <dd><LoadText teacher={teacher} /></dd>
          {teacher.advisory && (
            <>
              <dt className="text-neutral-600">Advisory</dt>
              <dd>{teacher.advisory}</dd>
            </>
          )}
        </dl>
      </CardContent>
    </Card>
  );
};

const TeachersTable = ({
  teachers,
  onOpen,
}: {
  teachers: ManagedTeacher[];
  onOpen: (teacher: ManagedTeacher) => void;
}) => (
  <div className="overflow-x-auto rounded-md border">
    <table className="w-full text-left text-sm">
      <thead className="bg-[#790D16]/5 text-xs text-neutral-700">
        <tr>
          <th scope="col" className="p-3 font-medium">Name</th>
          <th scope="col" className="p-3 font-medium">Department</th>
          <th scope="col" className="p-3 font-medium">Designation</th>
          <th scope="col" className="p-3 font-medium">Shift</th>
          <th scope="col" className="p-3 font-medium">Load</th>
          <th scope="col" className="p-3 font-medium">Status</th>
          <th scope="col" className="p-3"><span className="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {teachers.map((teacher) => (
          <tr key={teacher.id}>
            <td className="p-3">
              <p className="font-medium text-teal-700">{teacher.printed_name}</p>
              <p className="text-xs text-neutral-700">
                {PERSONNEL_TYPE_LABELS[teacher.personnel_type]}
                {teacher.advisory && `, adviser of ${teacher.advisory}`}
              </p>
            </td>
            <td className="p-3">{teacher.department ?? "–"}</td>
            <td className="p-3">{teacher.designation ?? "–"}</td>
            <td className="p-3">{SHIFT_LABELS[teacher.shift]}</td>
            <td className="p-3"><LoadText teacher={teacher} /></td>
            <td className="p-3"><StatusBadge teacher={teacher} /></td>
            <td className="p-1 text-right">
              <OpenButton teacher={teacher} onOpen={onOpen} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const TeachersIndex = () => {
  const { term, isPending: isTermPending } = useSelectedTerm();
  const { data: teachers, isPending, isError } = useTeachers(term?.id);
  usePersonnelOptions(); // Loaded now, so the form has its choices the moment it opens.

  const [search, setSearch] = React.useState("");
  const [type, setType] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [areFiltersOpen, setAreFiltersOpen] = React.useState(false);
  // undefined = closed, null = adding a new record
  const [selected, setSelected] = React.useState<ManagedTeacher | null | undefined>(undefined);

  const shown = filterTeachers(teachers ?? [], search, type, status);

  if (!term) {
    return (
      <p className="p-6 text-sm text-neutral-700">
        {isTermPending ? "Loading..." : "A school year has to be started first."}
      </p>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-[#790D16]/20 rounded-sm">
            <CircleUserRound className="text-branding size-5" />
          </div>
          <div>
            <p className="text-branding text-xl font-medium">Teachers and Personnel</p>
            <p className="text-sm text-neutral-700">
              Load shown for {term.name}, SY {term.school_year.name}.
            </p>
          </div>
        </div>
        <Button type="button" className="h-11 shrink-0" onClick={() => setSelected(null)}>
          <Plus />
          Add personnel
        </Button>
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
          <label htmlFor="teacher-search" className="text-sm text-neutral-800">
            Search
          </label>
          <InputGroup className="h-11">
            <InputGroupInput
              id="teacher-search"
              className="h-11"
              placeholder="Name or department"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <InputGroupAddon align="inline-start">
              <SearchIcon className="text-muted-foreground" />
            </InputGroupAddon>
          </InputGroup>
        </div>
        <div className="space-y-1 sm:w-48">
          <label htmlFor="type-filter" className="text-sm text-neutral-800">
            Type
          </label>
          <NativeSelect
            id="type-filter"
            className="w-full [&_select]:h-11"
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <NativeSelectOption value="">All types</NativeSelectOption>
            {Object.entries(PERSONNEL_TYPE_LABELS).map(([value, label]) => (
              <NativeSelectOption key={value} value={value}>
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1 sm:w-48">
          <label htmlFor="active-filter" className="text-sm text-neutral-800">
            Status
          </label>
          <NativeSelect
            id="active-filter"
            className="w-full [&_select]:h-11"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <NativeSelectOption value="">All statuses</NativeSelectOption>
            <NativeSelectOption value="active">Active</NativeSelectOption>
            <NativeSelectOption value="inactive">Inactive</NativeSelectOption>
          </NativeSelect>
        </div>
      </div>

      {isPending && <p className="text-sm text-neutral-600">Loading...</p>}
      {isError && <p className="text-sm text-destructive">Could not load the records.</p>}
      {teachers?.length === 0 && (
        <p className="text-sm text-neutral-700">There are no records yet.</p>
      )}
      {teachers && teachers.length > 0 && shown.length === 0 && (
        <p className="text-sm text-neutral-700">No one matches your search.</p>
      )}

      {shown.length > 0 && (
        <>
          <div className="hidden md:block">
            <TeachersTable teachers={shown} onOpen={setSelected} />
          </div>
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {shown.map((teacher) => (
              <TeacherCard key={teacher.id} teacher={teacher} onOpen={setSelected} />
            ))}
          </div>
        </>
      )}

      {selected !== undefined && (
        <TeacherSheet
          key={selected?.id ?? "new"}
          term={term}
          teacher={selected}
          onClose={() => setSelected(undefined)}
        />
      )}
    </div>
  );
};

export default TeachersIndex;
