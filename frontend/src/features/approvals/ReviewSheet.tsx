import React from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { ReviewAction } from "@/types/api";
import FormAlert from "@/components/global-component/FormAlert";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

type ReviewSheetProp = {
  action: ReviewAction;
  scopeLabel: string;
  sectionCount: number;
  entryCount: number;
  flaggedLabels: string[];
  isSaving: boolean;
  error: string | null;
  onConfirm: (remarks: string) => void;
  onClose: () => void;
};

const TEXT: Record<ReviewAction, { title: string; button: string; remarks: string }> = {
  approve: { title: "Approve schedules", button: "Confirm approval", remarks: "Remarks (optional)" },
  reject: { title: "Reject schedules", button: "Confirm rejection", remarks: "Reason for rejecting" },
  reopen: { title: "Reopen schedules", button: "Confirm reopening", remarks: "Reason for reopening" },
};

/** The summary the Admin sees before the action is carried out. */
const ReviewSheet = ({
  action,
  scopeLabel,
  sectionCount,
  entryCount,
  flaggedLabels,
  isSaving,
  error,
  onConfirm,
  onClose,
}: ReviewSheetProp) => {
  const isPhonePortrait = useMediaQuery("(orientation: portrait) and (max-width: 767px)");
  const [remarks, setRemarks] = React.useState("");
  const text = TEXT[action];
  const needsRemarks = action !== "approve";

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={isPhonePortrait ? "bottom" : "right"}
        className="max-h-[90dvh] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="text-branding">{text.title}</SheetTitle>
          <SheetDescription>
            {scopeLabel}: {sectionCount} {sectionCount === 1 ? "section" : "sections"},{" "}
            {entryCount} entries.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-4">
          {error && <FormAlert>{error}</FormAlert>}

          {flaggedLabels.length > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-medium">These sections have flags:</p>
              <p>{flaggedLabels.join(", ")}</p>
            </div>
          )}

          <div className="space-y-1">
            <label htmlFor="review-remarks" className="text-sm text-neutral-800">
              {text.remarks}
            </label>
            <Textarea
              id="review-remarks"
              rows={3}
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button
              type="button"
              className="h-11"
              variant={action === "reject" ? "destructive" : "default"}
              disabled={isSaving || (needsRemarks && remarks.trim() === "")}
              onClick={() => onConfirm(remarks.trim())}
            >
              {isSaving ? "Saving..." : text.button}
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

export default ReviewSheet;
