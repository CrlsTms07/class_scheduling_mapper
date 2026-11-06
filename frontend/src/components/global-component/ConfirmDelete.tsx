import React from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type ConfirmDeleteProp = {
  label: string;
  /** Why this cannot be deleted. The reason is shown in place of the button. */
  blockedReason?: string | null;
  isPending?: boolean;
  onConfirm: () => void;
};

/** A delete button that asks once more, or explains why deleting is not allowed. */
const ConfirmDelete = ({ label, blockedReason, isPending, onConfirm }: ConfirmDeleteProp) => {
  const [isAsking, setIsAsking] = React.useState(false);

  if (blockedReason) {
    return (
      <p className="rounded-md border p-3 text-xs text-neutral-700">
        Cannot be deleted. {blockedReason}
      </p>
    );
  }

  if (!isAsking) {
    return (
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full text-destructive"
        onClick={() => setIsAsking(true)}
      >
        <Trash2 />
        {label}
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-destructive/30 p-3">
      <p className="text-sm text-neutral-800">This cannot be undone. Are you sure?</p>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" className="h-11" onClick={() => setIsAsking(false)}>
          Keep it
        </Button>
        <Button
          type="button"
          variant="destructive"
          className="h-11"
          disabled={isPending}
          onClick={onConfirm}
        >
          {isPending ? "Deleting..." : "Yes, delete"}
        </Button>
      </div>
    </div>
  );
};

export default ConfirmDelete;
