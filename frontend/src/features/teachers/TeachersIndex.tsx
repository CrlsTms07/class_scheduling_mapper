import React from "react";
import { Link } from "react-router";
import { Eye, Pencil, Plus, SearchIcon, SlidersHorizontal, Trash2, UsersRound } from "lucide-react";
import { usePersonnelOptions, useTeachers } from "@/api/teachers";
import { useSelectedTerm } from "@/context/selectedTerm";
import { filterTeachers, isOverLimit, PERSONNEL_TYPE_LABELS } from "@/lib/teachers";
import { SHIFT_LABELS } from "@/lib/timeSlots";
import type { ManagedTeacher } from "@/types/api";
import { Crumbs } from "@/components/global-component/ScheduleUi";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import TeacherDeleteDialog from "./TeacherDeleteDialog";
import TeacherSheet from "./TeacherSheet";

const HOW_IT_WORKS = [
  "Add everyone here, with or without a login account. These records are reused every school year.",
  "Only active teaching personnel can be advisers or be given subjects.",
  "Availability is how much of the subject limit is still free in the selected term.",
  "Someone with an advisory or loading cannot be deleted. Mark them as inactive instead, so old schedules stay correct.",
  "A teacher who teaches only in the other department can be viewed here. Once they teach in your department, you can edit them too.",
];

/** How much of the subject limit is still free, as a number and a bar. */
const Availability = ({ teacher }: { teacher: ManagedTeacher }) => {
  const isOver = isOverLimit(teacher);
  const used = teacher.max_subjects > 0 ? Math.min(100, Math.round((teacher.assigned / teacher.max_subjects) * 100)) : 100;
  const free = 100 - used;

  return (
    <div className="min-w-36 space-y-1" title={`${teacher.assigned} of ${teacher.max_subjects} subjects`}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className={isOver ? "font-medium text-red-800" : "font-medium text-emerald-700"}>{isOver ? "Over the limit" : "Availability"}</span>
        <span className="text-neutral-800">{isOver ? `${teacher.assigned} of ${teacher.max_subjects}` : `${free}%`}</span>
      </div>
      <div className="h-1.5 rounded-full bg-neutral-200" aria-hidden>
        <div className={`h-full rounded-full ${isOver ? "bg-red-600" : "bg-neutral-900"}`} style={{ width: `${used}%` }} />
      </div>
    </div>
  );
};

const StatusBadge = ({ teacher }: { teacher: ManagedTeacher }) => (
  <Badge className={teacher.is_active ? "bg-neutral-900 text-white" : "bg-neutral-200 text-neutral-800"}>{teacher.is_active ? "Active" : "Inactive"}</Badge>
);

type TeacherHandlers = {
  onEdit: (teacher: ManagedTeacher) => void;
  onDelete: (teacher: ManagedTeacher) => void;
};

/** View (the teacher's page), and Edit and Delete unless the record belongs to the other department only. */
const Actions = ({ teacher, onEdit, onDelete }: TeacherHandlers & { teacher: ManagedTeacher }) => {
  const canEdit = teacher.can_edit !== false;

  return (
    <div className="flex items-center gap-1">
      <Link to={`/teachers/${teacher.id}`} aria-label={`View ${teacher.printed_name}`} className={buttonVariants({ variant: "outline", className: "h-11" })}>
        <Eye />
        View
      </Link>
      {canEdit ? (
        <>
          <Button type="button" variant="ghost" size="icon" className="size-11 text-neutral-600 hover:text-branding" aria-label={`Edit ${teacher.printed_name}`} title="Edit" onClick={() => onEdit(teacher)}>
            <Pencil />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 text-neutral-600 hover:bg-red-50 hover:text-destructive"
            aria-label={`Delete ${teacher.printed_name}`}
            title="Delete"
            onClick={() => onDelete(teacher)}
          >
            <Trash2 />
          </Button>
        </>
      ) : (
        <Badge variant="outline" className="ml-1 text-neutral-600">
          View only
        </Badge>
      )}
    </div>
  );
};

const TeachersTable = ({ teachers, ...handlers }: TeacherHandlers & { teachers: ManagedTeacher[] }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-left text-sm">
      <thead className="border-b text-neutral-900">
        <tr>
          <th scope="col" className="p-3 font-medium">Full Name</th>
          <th scope="col" className="p-3 font-medium">Shift</th>
          <th scope="col" className="p-3 font-medium">Load</th>
          <th scope="col" className="p-3 font-medium">Status</th>
          <th scope="col" className="p-3 font-medium">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {teachers.map((teacher) => (
          <tr key={teacher.id} className="hover:bg-neutral-50">
            <td className="p-3">
              <p className="font-semibold text-neutral-900">{teacher.printed_name}</p>
              <p className="text-xs text-neutral-600">
                {teacher.department ?? teacher.designation ?? PERSONNEL_TYPE_LABELS[teacher.personnel_type]}
                {teacher.advisory && `, adviser of ${teacher.advisory}`}
              </p>
            </td>
            <td className="p-3 font-medium text-neutral-900">{SHIFT_LABELS[teacher.shift]}</td>
            <td className="p-3">
              <Availability teacher={teacher} />
            </td>
            <td className="p-3">
              <StatusBadge teacher={teacher} />
            </td>
            <td className="p-1">
              <Actions teacher={teacher} {...handlers} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const TeacherCard = ({ teacher, ...handlers }: TeacherHandlers & { teacher: ManagedTeacher }) => (
  <article className="space-y-3 rounded-xl border bg-background p-4">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="font-semibold text-neutral-900">{teacher.printed_name}</p>
        <p className="text-xs text-neutral-600">{teacher.department ?? teacher.designation ?? PERSONNEL_TYPE_LABELS[teacher.personnel_type]}</p>
      </div>
      <StatusBadge teacher={teacher} />
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <span className="text-neutral-700">{SHIFT_LABELS[teacher.shift]}</span>
      <Availability teacher={teacher} />
    </div>
    <div className="border-t pt-2">
      <Actions teacher={teacher} {...handlers} />
    </div>
  </article>
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
  const [deleting, setDeleting] = React.useState<ManagedTeacher | null>(null);

  const shown = filterTeachers(teachers ?? [], search, type, status);

  if (!term) {
    return <p className="p-6 text-sm text-neutral-700">{isTermPending ? "Loading..." : "A school year has to be started first."}</p>;
  }

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <Crumbs items={[{ label: "Home", to: "/dashboard" }, { label: "Teachers" }]} />
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-branding">Teachers Directory</h1>
        <p className="text-sm text-neutral-700">
          View, search and manage every teacher in one place. Load shown for {term.name}, SY {term.school_year.name}.
        </p>
      </div>

      <div className="space-y-4 rounded-2xl border bg-background p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <InputGroup className="h-11 sm:max-w-xs">
            <InputGroupInput aria-label="Search" className="h-11" placeholder="Search..." value={search} onChange={(event) => setSearch(event.target.value)} />
            <InputGroupAddon align="inline-start">
              <SearchIcon className="text-muted-foreground" />
            </InputGroupAddon>
          </InputGroup>
          <div className="flex items-center gap-2">
            <Button type="button" className="h-11 flex-1 sm:flex-none" aria-label="Add personnel" onClick={() => setSelected(null)}>
              <Plus />
              Teacher
            </Button>
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
          <div className="grid gap-3 rounded-lg bg-neutral-50 p-3 sm:grid-cols-[12rem_12rem_minmax(0,1fr)]">
            <div className="space-y-1">
              <label htmlFor="type-filter" className="text-sm text-neutral-800">
                Type
              </label>
              <NativeSelect id="type-filter" className="w-full [&_select]:h-11" value={type} onChange={(event) => setType(event.target.value)}>
                <NativeSelectOption value="">All types</NativeSelectOption>
                {Object.entries(PERSONNEL_TYPE_LABELS).map(([value, label]) => (
                  <NativeSelectOption key={value} value={value}>
                    {label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1">
              <label htmlFor="active-filter" className="text-sm text-neutral-800">
                Status
              </label>
              <NativeSelect id="active-filter" className="w-full [&_select]:h-11" value={status} onChange={(event) => setStatus(event.target.value)}>
                <NativeSelectOption value="">All statuses</NativeSelectOption>
                <NativeSelectOption value="active">Active</NativeSelectOption>
                <NativeSelectOption value="inactive">Inactive</NativeSelectOption>
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
        {isError && <p className="text-sm text-destructive">Could not load the records.</p>}
        {teachers?.length === 0 && (
          <div className="space-y-2 py-8 text-center text-sm text-neutral-700">
            <UsersRound className="mx-auto size-8 text-branding/60" />
            <p>There are no records yet.</p>
          </div>
        )}
        {teachers && teachers.length > 0 && shown.length === 0 && <p className="py-6 text-center text-sm text-neutral-700">No one matches your search.</p>}

        {shown.length > 0 && (
          <>
            <div className="hidden md:block">
              <TeachersTable teachers={shown} onEdit={setSelected} onDelete={setDeleting} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:hidden">
              {shown.map((teacher) => (
                <TeacherCard key={teacher.id} teacher={teacher} onEdit={setSelected} onDelete={setDeleting} />
              ))}
            </div>
            <p className="text-center text-xs text-neutral-500">
              {shown.length === (teachers?.length ?? 0) ? `All ${shown.length} teachers and personnel.` : `${shown.length} of ${teachers?.length ?? 0} records.`}
            </p>
          </>
        )}
      </div>

      {selected !== undefined && <TeacherSheet key={selected?.id ?? "new"} term={term} teacher={selected} onClose={() => setSelected(undefined)} />}
      {deleting && <TeacherDeleteDialog teacher={deleting} onClose={() => setDeleting(null)} />}
    </div>
  );
};

export default TeachersIndex;
