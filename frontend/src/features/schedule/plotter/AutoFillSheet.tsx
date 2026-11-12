import React from "react";
import { useAutoFill } from "@/api/schedule";
import { apiErrorMessage } from "@/lib/forms";
import type { ActivityScope, AutoFillPlan, Plotter } from "@/types/api";
import FormAlert from "@/components/global-component/FormAlert";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type AutoFillSheetProp = {
  plotter: Plotter;
  termId: number;
  onClose: () => void;
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "es"}`;

/**
 * Auto-fill: the system places the minutes still missing into free periods. A preview comes
 * first; nothing is saved until Confirm. Classes already placed stay where they are, and
 * everything placed can still be moved or removed by hand, or undone at once.
 */
const AutoFillSheet = ({ plotter, termId, onClose }: AutoFillSheetProp) => {
  const { section, apply_counts: counts } = plotter;
  const { preview, confirm } = useAutoFill(termId, section.id);
  const [scope, setScope] = React.useState<ActivityScope>("section");
  const [plan, setPlan] = React.useState<AutoFillPlan | null>(null);
  const [done, setDone] = React.useState<AutoFillPlan | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const scopes: { value: ActivityScope; label: string }[] = [
    { value: "section", label: "This section only" },
    { value: "grade", label: `All Grade ${section.grade} sections (${counts.grade})` },
    { value: "all", label: `All my sections (${counts.all})` },
  ];

  const runPreview = (next: ActivityScope) => {
    setScope(next);
    setPlan(null);
    setError(null);
    preview.mutate(next, { onSuccess: setPlan, onError: (problem) => setError(apiErrorMessage(problem)) });
  };

  const runConfirm = () => {
    if (!plan) return;
    setError(null);
    confirm.mutate(
      { scope, plan_hash: plan.plan_hash },
      {
        onSuccess: ({ summary }) => setDone(summary),
        onError: (problem) => {
          setError(apiErrorMessage(problem));
          setPlan(null);
        },
      },
    );
  };

  const shown = done ?? plan;

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="max-h-dvh overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="text-branding">Auto-fill</SheetTitle>
          <SheetDescription>Let the system place the subjects for you, instead of one by one.</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-4">
          {!done && (
            <div className="rounded-xl border bg-neutral-50 p-3 text-sm text-neutral-800">
              <p className="font-medium text-neutral-900">What it does</p>
              <ol className="mt-1 list-decimal space-y-1 pl-5">
                <li>Takes the subjects in the teacher loading that are not placed yet.</li>
                <li>
                  Puts each one in free periods until its minutes a week are met, priority subjects such as PE and
                  Homeroom first. It never uses a period when the teacher, the room or the section is busy.
                </li>
                <li>Shows a preview first. Nothing is saved until you confirm, and Undo takes it all back.</li>
              </ol>
              <p className="mt-2 text-xs text-neutral-600">Classes already placed stay where they are. You can still move or change any class afterwards.</p>
            </div>
          )}
          {error && <FormAlert>{error}</FormAlert>}

          {!done && (
            <fieldset className="space-y-1">
              <legend className="text-sm text-neutral-800">Fill</legend>
              <div className="grid gap-2">
                {scopes.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={scope === value && plan !== null}
                    disabled={preview.isPending || confirm.isPending}
                    onClick={() => runPreview(value)}
                    className={`min-h-11 rounded-md border px-3 text-left text-xs font-medium disabled:opacity-50 ${
                      scope === value && plan ? "bg-[#790D16] text-white border-[#790D16]" : "bg-background text-neutral-700"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {!plan && !preview.isPending && <p className="text-xs text-neutral-600">Choose one to see a preview first.</p>}
              {preview.isPending && <p className="text-xs text-neutral-600">Working it out...</p>}
            </fieldset>
          )}

          {shown && (
            <div className="space-y-3" aria-live="polite">
              <p className={`text-sm font-medium ${done ? "text-emerald-800" : "text-neutral-900"}`}>
                {done
                  ? `Done: ${plural(done.placed, "class")} placed as drafts.`
                  : `${plural(shown.placed, "class")} will be placed. ${shown.unplaced_count} ${
                      shown.unplaced_count === 1 ? "subject does" : "subjects do"
                    } not fully fit.`}
              </p>

              <ul className="divide-y rounded-md border text-sm">
                {shown.sections.map((item) => (
                  <li key={item.id} className="flex justify-between gap-2 px-3 py-2">
                    <span>{item.label}</span>
                    <span className="text-right text-xs text-neutral-700">
                      {plural(item.placed, "class")}
                      {item.unplaced > 0 ? `, ${item.unplaced} unplaced` : ""}
                    </span>
                  </li>
                ))}
              </ul>

              {shown.skipped.length > 0 && (
                <ul className="space-y-1 text-xs text-neutral-700">
                  {shown.skipped.map(({ section: label, reason }) => (
                    <li key={label}>
                      Left out: {label}. {reason}
                    </li>
                  ))}
                </ul>
              )}

              {shown.unplaced.length > 0 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                  <p className="font-medium">Unplaced, to place by hand:</p>
                  <ul className="mt-1 space-y-1">
                    {shown.unplaced.map((item) => (
                      <li key={`${item.section}-${item.subject}`}>
                        <span className="font-medium">
                          {item.section}: {item.subject}
                        </span>{" "}
                        ({item.teacher}, {item.minutes_left} mins left). {item.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            {done ? (
              <Button type="button" className="h-11" onClick={onClose}>
                Done
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  className="h-11"
                  disabled={!plan || plan.placed === 0 || confirm.isPending}
                  onClick={runConfirm}
                >
                  {confirm.isPending ? "Placing..." : "Confirm"}
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

export default AutoFillSheet;
