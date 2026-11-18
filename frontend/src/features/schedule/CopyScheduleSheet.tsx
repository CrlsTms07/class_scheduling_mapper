import React from "react";
import { useCopySchedule, useSections } from "@/api/schedule";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { apiErrorMessage } from "@/lib/forms";
import { termWord } from "@/lib/schedule";
import { copyScopes, copySummaryLines, scopeToInput } from "@/lib/scheduleCopy";
import type { CopyScheduleResult, Term } from "@/types/api";
import FormAlert from "@/components/global-component/FormAlert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type CopyScheduleSheetProp = {
  term: Term;
  otherTerms: Term[];
  onClose: () => void;
};

/** Starts a term's schedules from another term. Choose, review what would happen, then confirm. */
const CopyScheduleSheet = ({ term, otherTerms, onClose }: CopyScheduleSheetProp) => {
  const isPhonePortrait = useMediaQuery("(orientation: portrait) and (max-width: 767px)");
  const { data: sections = [] } = useSections(term.id);
  const copy = useCopySchedule(term.id);

  const [fromTermId, setFromTermId] = React.useState(otherTerms[0].id);
  const [scope, setScope] = React.useState("all");
  const [fillSubjects, setFillSubjects] = React.useState(true);
  const [review, setReview] = React.useState<CopyScheduleResult | null>(null);
  const [done, setDone] = React.useState<CopyScheduleResult | null>(null);

  const send = (preview: boolean) =>
    copy.mutate(
      { from_term_id: fromTermId, ...scopeToInput(scope), fill_subjects: fillSubjects, preview },
      {
        onSuccess: ({ data }) => {
          if (preview) {
            setReview(data);
          } else {
            setReview(null);
            setDone(data);
          }
        },
      },
    );

  /** A change of choice makes the review out of date. */
  const change = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setReview(null);
    copy.reset();
  };

  const shown = done ?? review;
  const summary = shown ? copySummaryLines(shown) : [];

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side={isPhonePortrait ? "bottom" : "right"} className="max-h-[90dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-branding">Copy from another {termWord(term)}</SheetTitle>
          <SheetDescription>
            Starts {term.name} with the same days, times and rooms. Sections that already have a schedule in{" "}
            {term.name} are left as they are.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-4">
          {copy.isError && <FormAlert>{apiErrorMessage(copy.error)}</FormAlert>}

          {done ? (
            <div role="status" className="space-y-1 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
              <p className="font-medium">
                {done.entries > 0 ? "Copied. Open each section to finish it." : "Nothing was copied."}
              </p>
              {summary.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <label htmlFor="copy-schedule-from" className="text-sm text-neutral-800">
                  Copy from
                </label>
                <NativeSelect
                  id="copy-schedule-from"
                  className="w-full [&_select]:h-11"
                  value={fromTermId}
                  onChange={(event) => change(setFromTermId)(Number(event.target.value))}
                >
                  {otherTerms.map(({ id, name }) => (
                    <NativeSelectOption key={id} value={id}>
                      {name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>

              <div className="space-y-1">
                <label htmlFor="copy-schedule-scope" className="text-sm text-neutral-800">
                  Which sections
                </label>
                <NativeSelect
                  id="copy-schedule-scope"
                  className="w-full [&_select]:h-11"
                  value={scope}
                  onChange={(event) => change(setScope)(event.target.value)}
                >
                  {copyScopes(sections).map(({ value, label }) => (
                    <NativeSelectOption key={value} value={value}>
                      {label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>

              <label className="flex min-h-11 items-start gap-3 rounded-md border p-3 text-sm text-neutral-800">
                <Checkbox
                  className="mt-0.5"
                  checked={fillSubjects}
                  onCheckedChange={(checked) => change(setFillSubjects)(checked === true)}
                />
                <span>
                  Also copy the teachers, and fill in subjects that continue to {term.name}. Otherwise every period
                  becomes an open slot.
                </span>
              </label>

              {review && (
                <div className="space-y-1 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="font-medium">
                    {review.entries > 0 ? "This is what will happen:" : "There is nothing to copy."}
                  </p>
                  {summary.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              )}

              {review === null ? (
                <Button type="button" className="h-11 w-full" disabled={copy.isPending} onClick={() => send(true)}>
                  {copy.isPending ? "Checking..." : "Review"}
                </Button>
              ) : (
                review.entries > 0 && (
                  <Button type="button" className="h-11 w-full" disabled={copy.isPending} onClick={() => send(false)}>
                    {copy.isPending ? "Copying..." : "Confirm copy"}
                  </Button>
                )
              )}
            </>
          )}

          <Button type="button" variant="outline" className="h-11 w-full" onClick={onClose}>
            {done ? "Done" : "Close"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default CopyScheduleSheet;
