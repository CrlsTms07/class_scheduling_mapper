import { usePublicSchool } from "@/api/guest";
import { privacyNotice } from "@/lib/privacy";
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
  /** The Terms and Conditions (default) or the Data Privacy Notice. */
  document?: "terms" | "privacy";
};

type Section = { title: string; points: string[] };

const Sections = ({ sections }: { sections: Section[] }) => (
  <div className="space-y-4 text-sm text-neutral-800">
    {sections.map(({ title, points }) => (
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
);

/** The privacy notice names the school's contact email, asked for only once the notice is open. */
const PrivacySections = () => {
  const { data: school } = usePublicSchool();

  return <Sections sections={privacyNotice(school?.email)} />;
};

const TermsDialog = ({ open, onOpenChange, onAgree, document = "terms" }: TermsDialogProp) => {
  const isPrivacy = document === "privacy";

  return (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
      <DialogHeader>
        <DialogTitle className="text-branding">{isPrivacy ? "Data Privacy Notice" : "Terms and Conditions"}</DialogTitle>
        <DialogDescription>
          {isPrivacy
            ? "Republic Act No. 10173 (Data Privacy Act of 2012). How the ERCIHS Scheduling System handles your personal information."
            : "ERCIHS Scheduling System. Please read these before creating your account."}
        </DialogDescription>
      </DialogHeader>
      {isPrivacy ? <PrivacySections /> : <Sections sections={TERMS} />}
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
};

export default TermsDialog;
