import React from "react";
import { useSubmitSchedule } from "@/api/schedule";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { apiErrorMessage } from "@/lib/forms";
import type { Plotter } from "@/types/api";
import FormAlert from "@/components/global-component/FormAlert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

type SubmitSheetProp = {
  plotter: Plotter;
  termId: number;
  onClose: () => void;
};

/** Each flag must be fixed or acknowledged before the schedule goes to the Admin. */
const SubmitSheet = ({ plotter, termId, onClose }: SubmitSheetProp) => {
  const isPhonePortrait = useMediaQuery("(orientation: portrait) and (max-width: 767px)");
  const submit = useSubmitSchedule(termId, plotter.section.id);
  const [checked, setChecked] = React.useState<string[]>([]);
  const [note, setNote] = React.useState("");

  const blocking = plotter.flags.filter(({ blocking }) => blocking);
  const toAcknowledge = plotter.flags.filter(
    ({ blocking, acknowledged }) => !blocking && !acknowledged,
  );
  const allChecked = toAcknowledge.every(({ key }) => checked.includes(key));
  const canSubmit = blocking.length === 0 && allChecked && !submit.isPending;

  const toggle = (key: string) =>
    setChecked((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={isPhonePortrait ? "bottom" : "right"}
        className="max-h-[90dvh] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="text-branding">Submit for approval</SheetTitle>
          <SheetDescription>
            {plotter.section.label}. The schedule is locked until the Admin reviews it.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-4">
          {submit.isError && <FormAlert>{apiErrorMessage(submit.error)}</FormAlert>}

          {blocking.map(({ key, message }) => (
            <FormAlert key={key}>{message} Fill them before submitting.</FormAlert>
          ))}

          {toAcknowledge.length > 0 ? (
            <div className="space-y-1">
              <p className="text-sm text-neutral-800">
                Fix these in the plotter, or check each one to submit anyway:
              </p>
              <ul className="space-y-1">
                {toAcknowledge.map(({ key, message, severity }) => (
                  <li key={key}>
                    <label
                      className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-md p-2 text-xs ${
                        severity === "red" ? "bg-red-50 text-red-900" : "bg-amber-50 text-amber-900"
                      }`}
                    >
                      <Checkbox
                        className="size-5 shrink-0"
                        checked={checked.includes(key)}
                        onCheckedChange={() => toggle(key)}
                      />
                      {message}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            blocking.length === 0 && (
              <p className="text-sm text-neutral-700">
                No flags left to check. This schedule is ready to submit.
              </p>
            )
          )}

          {toAcknowledge.length > 0 && (
            <div className="space-y-1">
              <label htmlFor="submit-note" className="text-sm text-neutral-800">
                Note for the Admin (optional)
              </label>
              <Textarea
                id="submit-note"
                rows={2}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <Button
              type="button"
              className="h-11"
              disabled={!canSubmit}
              onClick={() =>
                submit.mutate(
                  { acknowledged_flags: checked, note: note.trim() || undefined },
                  { onSuccess: onClose },
                )
              }
            >
              {submit.isPending ? "Submitting..." : "Submit for approval"}
            </Button>
            <Button type="button" variant="outline" className="h-11" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SubmitSheet;
