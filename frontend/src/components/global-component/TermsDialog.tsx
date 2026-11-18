import { TERMS } from "@/lib/terms";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type TermsDialogProp = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ticks the box for the reader who agrees after reading. */
  onAgree?: () => void;
};

const TermsDialog = ({ open, onOpenChange, onAgree }: TermsDialogProp) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
      <DialogHeader>
        <DialogTitle className="text-branding">Terms and Conditions</DialogTitle>
        <DialogDescription>ERCIHS Scheduling System. Please read these before creating your account.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4 text-sm text-neutral-800">
        {TERMS.map(({ title, points }) => (
          <section key={title} className="space-y-1">
            <h3 className="font-semibold text-neutral-900">{title}</h3>
            <ul className="list-disc space-y-1 pl-5">
              {points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" className="h-11" onClick={() => onOpenChange(false)}>
          Close
        </Button>
        {onAgree && (
          <Button
            type="button"
            className="h-11"
            onClick={() => {
              onAgree();
              onOpenChange(false);
            }}
          >
            I agree
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default TermsDialog;
