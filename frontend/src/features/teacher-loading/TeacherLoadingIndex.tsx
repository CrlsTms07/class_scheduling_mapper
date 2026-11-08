import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowUpRight, ClipboardList, Copy, Lock } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useSearchParams } from "react-router";
import { useSections } from "@/api/schedule";
import {
  useAssignLoading,
  useCopyLoading,
  useQuickAddTeacher,
  useRemoveLoading,
  useSectionLoading,
} from "@/api/teacherLoading";
import { useSelectedTerm } from "@/context/selectedTerm";
import { termWord } from "@/lib/schedule";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { apiErrorMessage } from "@/lib/forms";
import {
  copyResultLines,
  isOverLoad,
  loadedCount,
  QuickAddSchema,
  shiftWarning,
  teacherOptionLabel,
  teachersForRow,
} from "@/lib/teacherLoading";
import type { LoadingRow, SectionLoading, Term } from "@/types/api";
import FormAlert from "@/components/global-component/FormAlert";
import FormTextField from "@/components/global-component/FormTextField";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const ADD_NEW = "new";

const HOW_IT_WORKS = [
  "Pick a section, then choose a teacher for each subject. Each choice saves right away.",
  "Teacher loading is set separately for each part of the year. The subjects listed are those of the section's grade, term and track.",
  "The numbers beside a name show how many subjects that teacher already has out of their limit.",
  "Choose \"+ Add new teacher\" if someone is not on the list. Complete their details later on the Teachers page.",
  "After loading, open the plotter to place the subjects in the timetable.",
];

type QuickAddSheetProp = {
  subject: string;
  onAdded: (teacherId: number) => void;
  onClose: () => void;
};

const QuickAddSheet = ({ subject, onAdded, onClose }: QuickAddSheetProp) => {
  const isPhonePortrait = useMediaQuery("(orientation: portrait) and (max-width: 767px)");
  const add = useQuickAddTeacher();
  const form = useForm<{ first_name: string; last_name: string }>({
    resolver: zodResolver(QuickAddSchema),
    defaultValues: { first_name: "", last_name: "" },
  });

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={isPhonePortrait ? "bottom" : "right"}
        className="max-h-[90dvh] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="text-branding">Add new teacher</SheetTitle>
          <SheetDescription>
            They will be given {subject}. Complete their details later on the Teachers page.
          </SheetDescription>
        </SheetHeader>
        <form
          noValidate
          className="space-y-4 px-4 pb-4"
          onSubmit={form.handleSubmit((values) =>
            add.mutate(values, { onSuccess: ({ data }) => onAdded(data.id) }),
          )}
        >
          {add.isError && <FormAlert>{apiErrorMessage(add.error)}</FormAlert>}
          <FormTextField control={form.control} name="first_name" label="First name" />
          <FormTextField control={form.control} name="last_name" label="Last name" />
          <div className="flex flex-col gap-2 pt-2">
            <Button type="submit" className="h-11" disabled={add.isPending}>
              {add.isPending ? "Saving..." : "Add and assign"}
            </Button>
            <Button type="button" variant="outline" className="h-11" onClick={onClose}>
              Close
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
};

type LoadingRowProp = {
  termId: number;
  loading: SectionLoading;
  row: LoadingRow;
};

const LoadingRowCard = ({ termId, loading, row }: LoadingRowProp) => {
  const sectionId = loading.section.id;
  const assign = useAssignLoading(termId, sectionId, row.subject_id);
  const remove = useRemoveLoading(termId, sectionId, row.subject_id);
  const [isAdding, setIsAdding] = React.useState(false);

  const isSaving = assign.isPending || remove.isPending;
  const error = assign.error ?? remove.error;
  const selectId = `teacher-for-${row.subject_id}`;
  const current = loading.teachers.find(({ id }) => id === row.teacher_id);
  const warning = current ? shiftWarning(current.shift, loading.section.shift) : null;

  const handleChange = (value: string) => {
    assign.reset();
    remove.reset();

    if (value === ADD_NEW) setIsAdding(true);
    else if (value === "") remove.mutate(undefined);
    else assign.mutate(Number(value));
  };

  return (
    <li>
      <Card className="shadow shadow-[#790D16]/40">
        <CardContent className="space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 md:items-center">
            <div className="min-w-0">
              <p className="font-medium text-teal-700">{row.subject}</p>
              <div className="flex flex-wrap items-center gap-1 text-xs text-neutral-700">
                {row.minutes_per_week} mins a week
                {row.is_priority && <Badge className="bg-sky-100 text-sky-900">Priority</Badge>}
                {!row.is_active && (
                  <Badge className="bg-neutral-200 text-neutral-800">Not offered</Badge>
                )}
                {row.placed_entries > 0 && (
                  <Badge variant="secondary">On the schedule</Badge>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor={selectId} className="text-sm text-neutral-800">
                Teacher of {row.subject}
              </label>
              {/* The key resets the shown choice when a save fails or a sheet is closed. */}
              <NativeSelect
                key={`${row.teacher_id}-${isAdding}-${error ? "failed" : "ok"}`}
                id={selectId}
                className="w-full [&_select]:h-11"
                defaultValue={row.teacher_id ?? ""}
                disabled={isSaving || !!row.locked_reason}
                onChange={(event) => handleChange(event.target.value)}
              >
                <NativeSelectOption value="">No teacher yet</NativeSelectOption>
                {teachersForRow(loading.teachers, row).map((teacher) => (
                  <NativeSelectOption key={teacher.id} value={teacher.id}>
                    {teacherOptionLabel(teacher)}
                  </NativeSelectOption>
                ))}
                <NativeSelectOption value={ADD_NEW}>+ Add new teacher</NativeSelectOption>
              </NativeSelect>
            </div>
          </div>

          {isSaving && <p className="text-xs text-neutral-600">Saving...</p>}
          {error && <FormAlert>{apiErrorMessage(error)}</FormAlert>}
          {row.locked_reason && (
            <p className="flex items-start gap-2 text-xs text-amber-900">
              <Lock className="size-4 shrink-0" />
              {row.locked_reason}
            </p>
          )}
          {current && isOverLoad(current) && (
            <p className="text-xs text-amber-900">
              {current.name} is over their limit: {current.assigned} of {current.limit}. This shows
              as a flag on the schedule.
            </p>
          )}
          {warning && <p className="text-xs text-amber-900">{warning}</p>}
        </CardContent>
      </Card>

      {isAdding && (
        <QuickAddSheet
          subject={row.subject}
          onAdded={(teacherId) => {
            setIsAdding(false);
            assign.mutate(teacherId);
          }}
          onClose={() => setIsAdding(false)}
        />
      )}
    </li>
  );
};

type CopySheetProp = {
  termId: number;
  termName: string;
  word: string;
  otherTerms: Term[];
  section: { id: number; grade: number; name: string };
  onClose: () => void;
};

const CopySheet = ({ termId, termName, word, otherTerms, section, onClose }: CopySheetProp) => {
  const isPhonePortrait = useMediaQuery("(orientation: portrait) and (max-width: 767px)");
  const copy = useCopyLoading(termId);
  const [fromTermId, setFromTermId] = React.useState(otherTerms[0].id);
  const [isWholeScope, setIsWholeScope] = React.useState(false);

  const scopes = [
    { value: false, text: `Only Grade ${section.grade} – ${section.name}` },
    { value: true, text: "All sections of my grade levels" },
  ];

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={isPhonePortrait ? "bottom" : "right"}
        className="max-h-[90dvh] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="text-branding">Copy from another {word}</SheetTitle>
          <SheetDescription>
            Fills {termName} with the same teachers, for subjects taught in both. Subjects
            that already have a teacher stay as they are.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-4">
          {copy.isError && <FormAlert>{apiErrorMessage(copy.error)}</FormAlert>}

          {copy.isSuccess ? (
            <FormAlert variant="success">{copyResultLines(copy.data.data).join(" ")}</FormAlert>
          ) : (
            <>
              <div className="space-y-1">
                <label htmlFor="copy-from-term" className="text-sm text-neutral-800">
                  Copy from
                </label>
                <NativeSelect
                  id="copy-from-term"
                  className="w-full [&_select]:h-11"
                  value={fromTermId}
                  onChange={(event) => setFromTermId(Number(event.target.value))}
                >
                  {otherTerms.map(({ id, name }) => (
                    <NativeSelectOption key={id} value={id}>
                      {name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>

              <div role="group" aria-label="Which sections" className="grid grid-cols-1 gap-2">
                {scopes.map(({ value, text }) => {
                  const isOn = value === isWholeScope;
                  return (
                    <button
                      key={text}
                      type="button"
                      aria-pressed={isOn}
                      onClick={() => setIsWholeScope(value)}
                      className={`min-h-11 rounded-md border px-3 text-left text-sm font-medium ${
                        isOn
                          ? "bg-[#790D16] text-white border-[#790D16]"
                          : "bg-background text-neutral-700"
                      }`}
                    >
                      {text}
                    </button>
                  );
                })}
              </div>

              <Button
                type="button"
                className="h-11 w-full"
                disabled={copy.isPending}
                onClick={() =>
                  copy.mutate({
                    from_term_id: fromTermId,
                    section_id: isWholeScope ? null : section.id,
                  })
                }
              >
                {copy.isPending ? "Copying..." : "Copy the teachers"}
              </Button>
            </>
          )}

          <Button type="button" variant="outline" className="h-11 w-full" onClick={onClose}>
            {copy.isSuccess ? "Done" : "Close"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

const TeacherLoadingIndex = () => {
  const { term, terms, isPending: isTermPending } = useSelectedTerm();
  const [isCopying, setIsCopying] = React.useState(false);
  const { data: sections, isPending: isSectionsPending } = useSections(term?.id);
  const [params, setParams] = useSearchParams();

  const requestedId = Number(params.get("section"));
  const section = sections?.find(({ id }) => id === requestedId) ?? sections?.[0];

  const { data: loading, isPending, isError } = useSectionLoading(term?.id, section?.id);

  if (!term) {
    return (
      <p className="p-6 text-sm text-neutral-700">
        {isTermPending ? "Loading..." : "A school year has to be started first."}
      </p>
    );
  }

  const done = loading ? loadedCount(loading.rows) : 0;
  const otherTerms = terms.filter(
    (item) => item.school_year.id === term.school_year.id && item.id !== term.id,
  );

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-[#790D16]/20 rounded-sm">
          <ClipboardList className="text-branding size-5" />
        </div>
        <div>
          <p className="text-branding text-xl font-medium">Teacher Loading</p>
          <p className="text-sm text-neutral-700">
            Who teaches what in {term.name}, SY {term.school_year.name}.
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

      {isSectionsPending && <p className="text-sm text-neutral-600">Loading...</p>}

      {sections?.length === 0 && (
        <p className="text-sm text-neutral-700">
          There are no sections in your grade levels for this school year yet. The Admin encodes
          them in Sections.
        </p>
      )}

      {section && (
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end sm:justify-between">
          <div className="space-y-1 sm:w-80">
            <label htmlFor="loading-section" className="text-sm text-neutral-800">
              Section
            </label>
            <NativeSelect
              id="loading-section"
              className="w-full [&_select]:h-11"
              value={section.id}
              onChange={(event) => setParams({ section: event.target.value })}
            >
              {sections?.map(({ id, grade, name }) => (
                <NativeSelectOption key={id} value={id}>
                  Grade {grade} – {name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            {otherTerms.length > 0 && (
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => setIsCopying(true)}
              >
                <Copy />
                Copy from another {termWord(term)}
              </Button>
            )}
            <Link
              to={`/schedule/sections/${section.id}`}
              className={buttonVariants({ variant: "outline", className: "h-11" })}
            >
              Open the plotter
              <ArrowUpRight />
            </Link>
          </div>
        </div>
      )}

      {isCopying && section && (
        <CopySheet
          termId={term.id}
          termName={term.name}
          word={termWord(term)}
          otherTerms={otherTerms}
          section={section}
          onClose={() => setIsCopying(false)}
        />
      )}

      {section && isPending && <p className="text-sm text-neutral-600">Loading...</p>}
      {isError && <p className="text-sm text-destructive">Could not load the subjects.</p>}

      {loading && loading.rows.length === 0 && (
        <p className="text-sm text-neutral-700">
          No subjects are offered to this section yet. Add them on the Subjects page.
        </p>
      )}

      {loading && loading.rows.length > 0 && (
        <>
          <p className="text-sm text-neutral-700" aria-live="polite">
            {done} of {loading.rows.length} subjects have a teacher.
          </p>
          <ol className="space-y-3">
            {loading.rows.map((row) => (
              <LoadingRowCard key={row.subject_id} termId={term.id} loading={loading} row={row} />
            ))}
          </ol>
        </>
      )}
    </div>
  );
};

export default TeacherLoadingIndex;
