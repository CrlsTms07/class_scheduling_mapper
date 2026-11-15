import React from "react";
import { Link } from "react-router";
import { ArrowRight, CircleAlert, CircleCheck, Download, FileUp, Sparkles } from "lucide-react";
import { useImportSchedule } from "@/api/schedule";
import { apiErrorMessage } from "@/lib/forms";
import type { ImportMissingKind, ScheduleImportResult, Term } from "@/types/api";
import FormAlert from "@/components/global-component/FormAlert";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type ImportScheduleSheetProp = { term: Term; onClose: () => void };

const MISSING_LABELS: Record<ImportMissingKind, [string, string]> = {
  sections: ["section", "sections"],
  bell_schedules: ["bell schedule", "bell schedules"],
  subjects: ["subject", "subjects"],
  teachers: ["teacher", "teachers"],
  rooms: ["room", "rooms"],
};

const missingKinds = (result: ScheduleImportResult) =>
  (Object.keys(MISSING_LABELS) as ImportMissingKind[]).filter((kind) => (result.missing?.[kind].count ?? 0) > 0);

const plural = (count: number, [one, many]: [string, string]) => `${count} ${count === 1 ? one : many}`;

/** The rows left out, as a CSV the user can open in Excel and fix. */
function downloadLeftOut(result: ScheduleImportResult) {
  const cell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  const lines = [
    ["Row", "Section", "Day", "Time", "Subject", "Teacher", "Room", "Why it was left out"].map(cell).join(","),
    ...result.rows
      .filter(({ status }) => status === "error")
      .map((row) => [row.row, row.section, row.day, row.time, row.subject, row.teacher, row.room, row.message ?? ""].map(cell).join(",")),
  ];
  const url = URL.createObjectURL(new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: "rows-left-out.csv" });
  link.click();
  URL.revokeObjectURL(url);
}

/** What to do after an import, in order, each with a link to where it is done. */
const NextSteps = ({ result, onClose }: { result: ScheduleImportResult; onClose: () => void }) => {
  const noRoom = new Set(result.rows.filter(({ status, message }) => status === "ok" && message?.includes("No room yet")).map(({ section }) => section));
  const steps: { text: string; to: string; label: string }[] = [];

  if (noRoom.size > 0) {
    steps.push({
      text: `${noRoom.size} ${noRoom.size === 1 ? "section has" : "sections have"} classes without a room. Give each section its home room; its classes take it.`,
      to: "/sections",
      label: "Set home rooms",
    });
  }
  if (result.set_up && (result.missing?.subjects.count ?? 0) > 0) {
    steps.push({ text: "Check the minutes per week of the new subjects.", to: "/subjects", label: "Check subjects" });
  }
  if (result.set_up && (result.missing?.teachers.count ?? 0) > 0) {
    steps.push({ text: "Complete the new teachers' details, like their full names and shift.", to: "/teachers", label: "Check teachers" });
  }
  steps.push({ text: "See if any teacher carries too much.", to: "/teacher-loading?view=teachers", label: "Check the teachers' loads" });

  return (
    <div className="space-y-2 rounded-xl border p-3">
      <p className="text-sm font-medium text-neutral-900">Next steps</p>
      <ol className="space-y-2">
        {steps.map((step, index) => (
          <li key={step.to} className="flex flex-wrap items-center justify-between gap-2 text-sm text-neutral-800">
            <span className="min-w-0 flex-1">
              {index + 1}. {step.text}
            </span>
            <Link
              to={step.to}
              onClick={onClose}
              className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 font-medium text-branding hover:bg-[#790D16]/5"
            >
              {step.label}
              <ArrowRight className="size-4" />
            </Link>
          </li>
        ))}
      </ol>
      {result.errors > 0 && (
        <Button type="button" variant="outline" className="h-11 w-full" onClick={() => downloadLeftOut(result)}>
          <Download />
          {result.errors === 1 ? "Download the row left out (CSV)" : `Download the ${result.errors} rows left out (CSV)`}
        </Button>
      )}
    </div>
  );
};

/** What the file names but the system does not have yet, a few names each. */
const MissingList = ({ result }: { result: ScheduleImportResult }) => (
  <ul className="space-y-2 text-sm">
    {missingKinds(result).map((kind) => {
      const { count, names } = result.missing![kind];

      return (
        <li key={kind}>
          <p className="font-medium text-neutral-900">{plural(count, MISSING_LABELS[kind])}</p>
          <p className="text-xs text-neutral-700">
            {names.join(", ")}
            {count > names.length && `, and ${count - names.length} more`}
          </p>
        </li>
      );
    })}
  </ul>
);

/** Only the rows with problems, unless the user asks for all of them. */
const ResultRows = ({ result }: { result: ScheduleImportResult }) => {
  const [showAll, setShowAll] = React.useState(false);
  const rows = showAll ? result.rows : result.rows.filter(({ status }) => status === "error");

  return (
    <div className="space-y-2">
      {result.errors > 0 && (
        <button type="button" className="min-h-11 text-sm font-medium text-branding underline-offset-2 hover:underline" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Show only the rows with problems" : `Show all ${result.total} rows`}
        </button>
      )}
      <ul className="max-h-[45dvh] divide-y overflow-y-auto rounded-md border text-sm">
        {(result.errors === 0 ? result.rows : rows).map((row) => (
          <li key={row.row} className={`flex gap-2 p-2 ${row.status === "error" ? "bg-red-50" : ""}`}>
            {row.status === "ok" ? (
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-label="Ready" />
            ) : (
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-red-700" aria-label="Problem" />
            )}
            <div className="min-w-0">
              <p className="font-medium text-neutral-900">
                Row {row.row}: {row.section}, {row.day} {row.time}
              </p>
              <p className="text-xs text-neutral-700">
                {[row.subject, row.teacher, row.room && `Room ${row.room}`].filter(Boolean).join(" · ")}
              </p>
              {row.message && <p className={`text-xs ${row.status === "error" ? "text-red-800" : "text-neutral-600"}`}>{row.message}</p>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

/**
 * Import a schedule from a file: the school's class program workbook or the template. Every row
 * is reviewed first. What the file names but the system lacks can be set up from the file, and
 * the user then decides to use the schedule or not. Used classes become drafts to edit in the plotter.
 */
const ImportScheduleSheet = ({ term, onClose }: ImportScheduleSheetProp) => {
  const importSchedule = useImportSchedule(term.id);
  const fileInput = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [review, setReview] = React.useState<ScheduleImportResult | null>(null);
  const [done, setDone] = React.useState<ScheduleImportResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const send = (preview: boolean, setUp: boolean) => {
    if (!file) return;
    setError(null);
    importSchedule.mutate(
      { file, preview, setUp },
      {
        onSuccess: ({ data }) => (preview ? setReview(data) : setDone(data)),
        onError: (problem) => setError(apiErrorMessage(problem)),
      },
    );
  };

  const isSetUp = !!review?.set_up;
  const canSetUp = !!review && !isSetUp && missingKinds(review).length > 0;

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="max-h-dvh overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="text-branding">Import from a file</SheetTitle>
          <SheetDescription>
            Into {term.name}, SY {term.school_year.name}. Classes come in as drafts, for your sections only.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-4">
          {error && <FormAlert>{error}</FormAlert>}

          {!done && (
            <>
              <section className="space-y-2">
                <p className="text-sm font-medium text-neutral-900">1. Choose the school's Excel schedule</p>
                <p className="text-xs text-neutral-700">
                  Any file name works. The system finds the schedules inside: class programs per section (JHS or SHS), the
                  Teachers Program, or rows of Grade, Section, Day, Start, End, Subject, Teacher and Room. Each schedule needs its
                  TIME column with the days beside it.
                </p>
                <input
                  ref={fileInput}
                  type="file"
                  accept=".xlsx,.xls,.pdf"
                  aria-label="Schedule file"
                  className="hidden"
                  onChange={(event) => {
                    setFile(event.target.files?.[0] ?? null);
                    setReview(null);
                    setError(null);
                    event.target.value = "";
                  }}
                />
                <Button type="button" variant="outline" className="h-11 w-full" onClick={() => fileInput.current?.click()}>
                  <FileUp />
                  <span className="truncate">{file ? file.name : "Choose an Excel (.xlsx) or PDF file"}</span>
                </Button>
              </section>
            </>
          )}

          {review && !done && (
            <section className="space-y-3" aria-live="polite">
              <p className="text-sm font-medium text-neutral-900">2. Review</p>
              {review.source === "class_program" && (
                <p className="rounded-md bg-sky-50 p-2 text-xs text-sky-900">
                  Read from the school&apos;s schedule: {review.sections_found?.length ?? 0} sections.
                </p>
              )}

              {canSetUp && (
                <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-3">
                  <p className="text-sm font-medium text-amber-950">Not in the system yet</p>
                  <MissingList result={review} />
                  <p className="text-xs text-amber-900">
                    These can be set up from the file: new teachers get their name only, to be completed later in Teachers.
                    Nothing is saved until you choose to use the schedule.
                  </p>
                  <Button type="button" className="h-11 w-full" disabled={importSchedule.isPending} onClick={() => send(true, true)}>
                    <Sparkles />
                    {importSchedule.isPending ? "Checking..." : "Set these up from the file"}
                  </Button>
                </div>
              )}

              {isSetUp && missingKinds(review).length > 0 && (
                <div className="space-y-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3">
                  <p className="text-sm font-medium text-emerald-950">Will be set up from the file</p>
                  <MissingList result={review} />
                </div>
              )}

              <p className="text-sm text-neutral-800">
                {review.ok} of {review.total} rows are ready
                {review.errors > 0 && `, ${review.errors} have problems and will be left out`}
                {review.new_loadings > 0 && `. ${review.new_loadings} subjects get teacher loading`}.
              </p>
              <ResultRows result={review} />
            </section>
          )}

          {done && (
            <section className="space-y-3" role="status">
              <div className="space-y-1 rounded-xl border border-emerald-300 bg-emerald-50 p-3">
                <p className="text-sm font-medium text-emerald-900">
                  Imported {done.ok} {done.ok === 1 ? "class" : "classes"} as drafts.
                  {done.errors > 0 && ` ${done.errors} rows were left out.`}
                </p>
                {done.set_up && missingKinds(done).length > 0 && (
                  <p className="text-xs text-emerald-900">
                    Also set up: {missingKinds(done).map((kind) => plural(done.missing![kind].count, MISSING_LABELS[kind])).join(", ")}.
                  </p>
                )}
              </div>
              <p className="text-xs text-neutral-700">
                The classes are now in the schedule. Open a section to edit or change any class, then submit it for approval.
              </p>
              <NextSteps result={done} onClose={onClose} />
              {done.errors > 0 && <ResultRows result={done} />}
            </section>
          )}

          <div className="flex flex-col gap-2">
            {done ? (
              <Button type="button" className="h-11" onClick={onClose}>
                Go to the schedules
              </Button>
            ) : review ? (
              <>
                <Button type="button" className="h-11" disabled={importSchedule.isPending || review.ok === 0} onClick={() => send(false, isSetUp)}>
                  {importSchedule.isPending
                    ? "Saving..."
                    : `Use this schedule (${review.ok} ${review.ok === 1 ? "class" : "classes"})`}
                </Button>
                <Button type="button" variant="outline" className="h-11" onClick={onClose}>
                  Don&apos;t use it
                </Button>
              </>
            ) : (
              <>
                <Button type="button" className="h-11" disabled={!file || importSchedule.isPending} onClick={() => send(true, false)}>
                  {importSchedule.isPending ? "Checking..." : "Review"}
                </Button>
                <Button type="button" variant="outline" className="h-11" onClick={onClose}>
                  Cancel
                </Button>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ImportScheduleSheet;
