import React from "react";
import { Check, Download } from "lucide-react";
import { Link } from "react-router";
import { useImportPrevious } from "@/api/dashboard";
import { apiErrorMessage } from "@/lib/forms";
import { termWord } from "@/lib/schedule";
import type { ImportResult, SchedulerStep, Term } from "@/types/api";
import FormAlert from "@/components/global-component/FormAlert";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const plural = (count: number, word: string, many = `${word}s`) => `${count} ${count === 1 ? word : many}`;

/** What each step is, where it is done, and how far along it is, in words. */
function describe(step: SchedulerStep): { title: string; detail: string; to: string; status: string } {
  switch (step.key) {
    case "subjects":
      return {
        title: "Subjects & Sections",
        detail: "Subjects and activities of your grade levels, and your sections.",
        to: "/subjects",
        status: `${plural(step.counts.subjects, "subject")} · ${plural(step.counts.activities, "activity", "activities")} · ${plural(step.counts.sections, "section")}`,
      };
    case "teachers":
      return {
        title: "Teachers",
        detail: "Teaching personnel, with their shift and how much they may carry.",
        to: "/teachers",
        status: plural(step.counts.teachers, "teacher"),
      };
    case "loading":
      return {
        title: "Load Distribution",
        detail: "Who teaches each subject of each section, and the hours a week of each teacher.",
        to: step.counts.loaded > 0 ? "/teacher-loading?view=teachers" : "/teacher-loading",
        status:
          `${step.counts.loaded} of ${step.counts.needed} subjects have a teacher` +
          (step.counts.over_hours > 0 ? ` · ${step.counts.over_hours} overloaded` : ""),
      };
    case "plot":
      return {
        title: "Plot",
        detail: "Place each section's subjects and activities on its weekly schedule, then submit.",
        to: "/schedule",
        status: `${step.counts.started} of ${step.counts.sections} started · ${step.counts.submitted} submitted`,
      };
  }
}

type SchedulerStepsProp = {
  steps: SchedulerStep[];
  term: Term;
  terms: Term[];
};

/** The four steps of making a schedule, with a quick start from an earlier term. */
const SchedulerSteps = ({ steps, term, terms }: SchedulerStepsProp) => {
  const [isImporting, setIsImporting] = React.useState(false);
  const earlier = terms
    .filter(({ id, start_date }) => id !== term.id && start_date < term.start_date)
    .sort((a, b) => b.start_date.localeCompare(a.start_date));
  const nextIndex = steps.findIndex(({ done }) => !done);

  return (
    <section aria-labelledby="steps-heading" className="space-y-3">
      <p id="steps-heading" className="font-medium text-teal-700">
        Making the schedule
      </p>
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4 items-start">
        <ol className="grid gap-3">
          {steps.map((step, index) => {
            const { title, detail, to, status } = describe(step);
            const isNext = index === nextIndex;

            return (
              <li key={step.key}>
                <Link
                  to={to}
                  className={`flex min-h-11 items-start gap-3 rounded-md border p-3 hover:bg-[#790D16]/5 ${
                    isNext ? "border-[#790D16] ring-1 ring-[#790D16]" : ""
                  }`}
                >
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      step.done ? "bg-emerald-600 text-white" : isNext ? "bg-[#790D16] text-white" : "bg-neutral-200 text-neutral-800"
                    }`}
                    aria-hidden="true"
                  >
                    {step.done ? <Check className="size-4" /> : index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-neutral-900">
                      {index + 1}. {title}
                      <span className="sr-only">{step.done ? ", done" : isNext ? ", next" : ""}</span>
                    </span>
                    <span className="block text-xs text-neutral-700">{detail}</span>
                    <span className={`mt-1 block text-xs font-medium ${step.done ? "text-emerald-800" : "text-branding"}`}>
                      {status}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>

        <div className="space-y-2 rounded-md border p-3">
          <p className="text-sm font-medium text-neutral-900">Quick start</p>
          <p className="text-xs text-neutral-700">
            Copy who teaches what from an earlier {termWord(term)}, then go straight to plotting. Plotted schedules are not
            copied: each section starts as a new draft.
          </p>
          <Button
            type="button"
            className="h-11 w-full"
            disabled={earlier.length === 0}
            onClick={() => setIsImporting(true)}
          >
            <Download />
            Import previous data
          </Button>
          {earlier.length === 0 && <p className="text-xs text-neutral-600">There is no earlier {termWord(term)} yet.</p>}
        </div>
      </div>

      {isImporting && <ImportSheet term={term} earlier={earlier} onClose={() => setIsImporting(false)} />}
    </section>
  );
};

const resultLines = (result: ImportResult): string[] =>
  [
    result.already_set > 0 && `${plural(result.already_set, "subject")} already had a teacher here, and stay as they are.`,
    result.not_offered > 0 && `${plural(result.not_offered, "subject")} are not offered in this part of the year.`,
    result.teacher_unavailable > 0 && `${plural(result.teacher_unavailable, "subject")} had a teacher who is no longer active.`,
    ...result.missing,
  ].filter((line): line is string => typeof line === "string");

type ImportSheetProp = { term: Term; earlier: Term[]; onClose: () => void };

const ImportSheet = ({ term, earlier, onClose }: ImportSheetProp) => {
  const [fromId, setFromId] = React.useState(earlier[0]?.id ?? 0);
  const [review, setReview] = React.useState<ImportResult | null>(null);
  const [done, setDone] = React.useState<ImportResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const importPrevious = useImportPrevious(term.id);

  const send = (preview: boolean) => {
    setError(null);
    importPrevious.mutate(
      { from_term_id: fromId, preview },
      {
        onSuccess: ({ data }) => (preview ? setReview(data) : setDone(data)),
        onError: (problem) => setError(apiErrorMessage(problem)),
      },
    );
  };

  const shown = done ?? review;

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="max-h-dvh overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-branding">Import previous data</SheetTitle>
          <SheetDescription>
            Into {term.name}, SY {term.school_year.name}. Only your grade levels.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-4">
          {error && <FormAlert>{error}</FormAlert>}

          <div className="space-y-1">
            <label htmlFor="import-from" className="text-sm text-neutral-800">
              Copy from
            </label>
            <NativeSelect
              id="import-from"
              className="w-full [&_select]:h-11"
              value={fromId}
              disabled={done !== null}
              onChange={(event) => {
                setFromId(Number(event.target.value));
                setReview(null);
              }}
            >
              {earlier.map((item) => (
                <NativeSelectOption key={item.id} value={item.id}>
                  SY {item.school_year.name} · {item.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          <ul className="space-y-1 text-sm text-neutral-800">
            <li>☑ Teacher loading: who teaches each subject of each section</li>
            <li className="text-neutral-600">☐ Plotted schedules: each section starts as a new draft</li>
          </ul>
          <p className="text-xs text-neutral-600">
            Subjects, activities, bell schedules and sections already belong to the school year. For a new school year, the
            Admin copies them with Start New School Year.
          </p>

          {shown && (
            <div className="space-y-2 rounded-md border bg-neutral-50 p-3 text-sm" role="status">
              <p className={`font-medium ${done ? "text-emerald-800" : "text-neutral-900"}`}>
                {done
                  ? `Imported: ${plural(done.copied, "subject")} with a teacher, in ${plural(done.sections, "section")}.`
                  : `${plural(shown.copied, "subject")} with a teacher will be copied, in ${plural(shown.sections, "section")}.`}
              </p>
              <ul className="list-disc space-y-0.5 pl-4 text-xs text-neutral-700">
                {resultLines(shown).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {done ? (
              <Link to="/teacher-loading?view=teachers" className="flex h-11 items-center justify-center rounded-md bg-[#790D16] text-sm font-medium text-white">
                See the Load Distribution
              </Link>
            ) : review ? (
              <Button type="button" className="h-11" disabled={importPrevious.isPending || review.copied === 0} onClick={() => send(false)}>
                {importPrevious.isPending ? "Importing..." : "Import"}
              </Button>
            ) : (
              <Button type="button" className="h-11" disabled={importPrevious.isPending || !fromId} onClick={() => send(true)}>
                {importPrevious.isPending ? "Checking..." : "Review"}
              </Button>
            )}
            <Button type="button" variant="outline" className="h-11" onClick={onClose}>
              {done ? "Done" : "Cancel"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SchedulerSteps;
