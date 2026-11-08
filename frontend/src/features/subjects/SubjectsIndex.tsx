import React from "react";
import { CirclePile, Eye, Filter, Pencil, Plus, SearchIcon } from "lucide-react";
import { useMe } from "@/api/auth";
import { useSubjectOptions, useSubjects } from "@/api/subjects";
import { useSelectedTerm } from "@/context/selectedTerm";
import { ROLES } from "@/lib/navigation";
import { filterSubjects, SUBJECT_TYPE_LABELS, termLabel } from "@/lib/subjects";
import type { ManagedSubject, SubjectOptions } from "@/types/api";
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
import SubjectSheet from "./SubjectSheet";

const HOW_IT_WORKS = [
  "Subjects belong to one school year, so changing the curriculum never alters past records. The Start New School Year wizard can copy them.",
  "Set the minutes per week. The plotter flags a section whose schedule does not match, like Homeroom Guidance going over its limit.",
  "Junior High subjects are usually for the whole year. Senior High subjects can be set for only part of the year, and per track.",
  "Once a subject has teacher loading, its grade, track and time of the year lock, and it cannot be deleted.",
];

type RowProp = {
  subject: ManagedSubject;
  terms: SubjectOptions["terms"] | undefined;
  canManage: boolean;
  onOpen: (subject: ManagedSubject) => void;
};

const SubjectBadges = ({ subject }: { subject: ManagedSubject }) => (
  <>
    {subject.is_priority && <Badge className="bg-sky-100 text-sky-900">Priority</Badge>}
    {!subject.is_active && <Badge className="bg-neutral-200 text-neutral-800">Not offered</Badge>}
  </>
);

const OpenButton = ({ subject, canManage, onOpen }: Omit<RowProp, "terms">) => (
  <Button
    type="button"
    variant="outline"
    size="icon"
    className="size-11 shrink-0"
    aria-label={`${canManage ? "Edit" : "View"} ${subject.name}, Grade ${subject.grade}`}
    onClick={() => onOpen(subject)}
  >
    {canManage ? <Pencil /> : <Eye />}
  </Button>
);

const SubjectCard = ({ subject, terms, canManage, onOpen }: RowProp) => (
  <Card className="shadow shadow-[#790D16]/40">
    <CardContent className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-teal-700 font-bold text-base">{subject.name}</p>
          <div className="flex flex-wrap gap-1">
            <Badge variant="secondary">Grade {subject.grade}</Badge>
            <SubjectBadges subject={subject} />
          </div>
        </div>
        <OpenButton subject={subject} canManage={canManage} onOpen={onOpen} />
      </div>
      <dl className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-2 text-xs text-neutral-800">
        <dt className="text-neutral-600">When</dt>
        <dd>{termLabel(subject.term_no, terms)}</dd>
        {subject.track && (
          <>
            <dt className="text-neutral-600">Track</dt>
            <dd>{subject.track}</dd>
          </>
        )}
        <dt className="text-neutral-600">Type</dt>
        <dd>{SUBJECT_TYPE_LABELS[subject.subject_type]}</dd>
        <dt className="text-neutral-600">Per week</dt>
        <dd>{subject.minutes_per_week} mins</dd>
      </dl>
    </CardContent>
  </Card>
);

const SubjectsTable = ({
  subjects,
  terms,
  canManage,
  onOpen,
}: Omit<RowProp, "subject"> & { subjects: ManagedSubject[] }) => (
  <div className="overflow-x-auto rounded-md border">
    <table className="w-full text-left text-sm">
      <thead className="bg-[#790D16]/5 text-xs text-neutral-700">
        <tr>
          <th scope="col" className="p-3 font-medium">Subject</th>
          <th scope="col" className="p-3 font-medium">Grade</th>
          <th scope="col" className="p-3 font-medium">When</th>
          <th scope="col" className="p-3 font-medium">Track</th>
          <th scope="col" className="p-3 font-medium">Type</th>
          <th scope="col" className="p-3 font-medium">Per week</th>
          <th scope="col" className="p-3"><span className="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {subjects.map((subject) => (
          <tr key={subject.id}>
            <td className="p-3">
              <p className="font-medium text-teal-700">{subject.name}</p>
              <div className="flex flex-wrap items-center gap-1 text-xs text-neutral-700">
                {subject.code}
                <SubjectBadges subject={subject} />
              </div>
            </td>
            <td className="p-3">{subject.grade}</td>
            <td className="p-3">{termLabel(subject.term_no, terms)}</td>
            <td className="p-3">{subject.track ?? "–"}</td>
            <td className="p-3">{SUBJECT_TYPE_LABELS[subject.subject_type]}</td>
            <td className="p-3 whitespace-nowrap">{subject.minutes_per_week} mins</td>
            <td className="p-1 text-right">
              <OpenButton subject={subject} canManage={canManage} onOpen={onOpen} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const SubjectsIndex = () => {
  const { data: me } = useMe();
  const { term, isPending: isTermPending } = useSelectedTerm();
  const year = term?.school_year;
  const { data: subjects, isPending, isError } = useSubjects(year?.id);
  const { data: options } = useSubjectOptions(year?.id);
  const canManage = !!me?.role && ROLES.SCHEDULERS.includes(me.role);

  const [search, setSearch] = React.useState("");
  const [grade, setGrade] = React.useState("");
  const [termNo, setTermNo] = React.useState("");
  const [areFiltersOpen, setAreFiltersOpen] = React.useState(false);
  // undefined = closed, null = adding a new subject
  const [selected, setSelected] = React.useState<ManagedSubject | null | undefined>(undefined);

  const shown = filterSubjects(subjects ?? [], search, grade, termNo);

  if (!year) {
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
            <CirclePile className="text-branding size-5" />
          </div>
          <div>
            <p className="text-branding text-xl font-medium">Subjects</p>
            <p className="text-sm text-neutral-700">
              {canManage
                ? `Curriculum of SY ${year.name}, for your grade levels.`
                : `Curriculum of SY ${year.name}. View only: the Chairperson or Master Teacher keeps these up to date.`}
            </p>
          </div>
        </div>
        {canManage && (
          <Button type="button" className="h-11 shrink-0" onClick={() => setSelected(null)}>
            <Plus />
            Add subject
          </Button>
        )}
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
          <label htmlFor="subject-search" className="text-sm text-neutral-800">
            Search
          </label>
          <InputGroup className="h-11">
            <InputGroupInput
              id="subject-search"
              className="h-11"
              placeholder="Name, code or track"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <InputGroupAddon align="inline-start">
              <SearchIcon className="text-muted-foreground" />
            </InputGroupAddon>
          </InputGroup>
        </div>
        <div className="space-y-1 sm:w-48">
          <label htmlFor="subject-grade-filter" className="text-sm text-neutral-800">
            Grade level
          </label>
          <NativeSelect
            id="subject-grade-filter"
            className="w-full [&_select]:h-11"
            value={grade}
            onChange={(event) => setGrade(event.target.value)}
          >
            <NativeSelectOption value="">All grades</NativeSelectOption>
            {options?.grade_levels.map((item) => (
              <NativeSelectOption key={item.id} value={String(item.grade)}>
                Grade {item.grade}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1 sm:w-48">
          <label htmlFor="subject-term-filter" className="text-sm text-neutral-800">
            When
          </label>
          <NativeSelect
            id="subject-term-filter"
            className="w-full [&_select]:h-11"
            value={termNo}
            onChange={(event) => setTermNo(event.target.value)}
          >
            <NativeSelectOption value="">Any time</NativeSelectOption>
            <NativeSelectOption value="whole">Whole year</NativeSelectOption>
            {options?.terms.map((item) => (
              <NativeSelectOption key={item.term_no} value={String(item.term_no)}>
                {item.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>

      {isPending && <p className="text-sm text-neutral-600">Loading...</p>}
      {isError && <p className="text-sm text-destructive">Could not load the subjects.</p>}
      {subjects?.length === 0 && (
        <p className="text-sm text-neutral-700">There are no subjects in this school year yet.</p>
      )}
      {subjects && subjects.length > 0 && shown.length === 0 && (
        <p className="text-sm text-neutral-700">No subject matches your search.</p>
      )}

      {shown.length > 0 && (
        <>
          <div className="hidden md:block">
            <SubjectsTable
              subjects={shown}
              terms={options?.terms}
              canManage={canManage}
              onOpen={setSelected}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {shown.map((subject) => (
              <SubjectCard
                key={subject.id}
                subject={subject}
                terms={options?.terms}
                canManage={canManage}
                onOpen={setSelected}
              />
            ))}
          </div>
        </>
      )}

      {selected !== undefined && (
        <SubjectSheet
          key={selected?.id ?? "new"}
          yearId={year.id}
          yearName={year.name}
          subject={selected}
          readOnly={!canManage}
          onClose={() => setSelected(undefined)}
        />
      )}
    </div>
  );
};

export default SubjectsIndex;
