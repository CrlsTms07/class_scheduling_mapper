import { apiErrorMessage } from "@/lib/forms";
import FormAlert from "@/components/global-component/FormAlert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type DeleteDialogProp = {
  /** What is deleted, as the user knows it ("Grade 7 – Honesty"). */
  name: string;
  /** Why it cannot be deleted. Shown in place of the Delete button. */
  blockedReason?: string | null;
  isPending: boolean;
  error: unknown;
  onConfirm: () => void;
  onClose: () => void;
};

/** Asks once before deleting from a list, or says why it is not allowed. */
const DeleteDialog = ({ name, blockedReason, isPending, error, onConfirm, onClose }: DeleteDialogProp) => (
  <Dialog open onOpenChange={(open) => !open && onClose()}>
    <DialogContent showCloseButton={false}>
      <DialogHeader>
        <DialogTitle className="text-branding">{blockedReason ? `${name} cannot be deleted` : `Delete ${name}?`}</DialogTitle>
        <DialogDescription>
          {blockedReason ?? "This cannot be undone. Are you sure?"}
        </DialogDescription>
      </DialogHeader>
      {!!error && <FormAlert>{apiErrorMessage(error)}</FormAlert>}
      <DialogFooter>
        <Button type="button" variant="outline" className="h-11" onClick={onClose}>
          {blockedReason ? "Close" : "Keep it"}
        </Button>
        {!blockedReason && (
          <Button type="button" variant="destructive" className="h-11" disabled={isPending} onClick={onConfirm}>
            {isPending ? "Deleting..." : "Yes, delete"}
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default DeleteDialog;
