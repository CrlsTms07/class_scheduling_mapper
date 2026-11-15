import React from "react";
import { LogOut } from "lucide-react";
import { useAcceptTerms, useLogout, useMe } from "@/api/auth";
import { usePublicSchool } from "@/api/guest";
import { apiErrorMessage } from "@/lib/forms";
import { privacyNotice } from "@/lib/privacy";
import { TERMS } from "@/lib/terms";
import FormAlert from "@/components/global-component/FormAlert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

const DocumentSections = ({ sections }: { sections: { title: string; points: string[] }[] }) => (
  <>
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
  </>
);

/**
 * Shown after signing in, before the dashboard, to an account that has not yet agreed to the Terms
 * and Conditions or the Data Privacy Notice (RA 10173). Each has its own box, and only what is still
 * missing is asked. Nothing else opens until Continue is pressed.
 */
const TermsGate = () => {
  const { data: user } = useMe();
  const { data: school } = usePublicSchool();
  const accept = useAcceptTerms();
  const logout = useLogout();
  const needsTerms = user?.terms_accepted_at === null;
  const needsPrivacy = user?.privacy_accepted_at === null;
  const [termsChecked, setTermsChecked] = React.useState(false);
  const [privacyChecked, setPrivacyChecked] = React.useState(false);
  const isReady = (!needsTerms || termsChecked) && (!needsPrivacy || privacyChecked);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-neutral-50 p-4">
      <section aria-labelledby="terms-title" className="w-full max-w-2xl space-y-5 rounded-2xl border bg-background p-5 shadow-sm sm:p-8">
        <div className="flex items-center gap-3">
          <img src="/ercihs-logo.png" alt="" className="size-12 shrink-0" />
          <div>
            <h1 id="terms-title" className="text-xl font-semibold text-branding">
              {needsTerms && needsPrivacy ? "Terms and Data Privacy" : needsTerms ? "Terms and Conditions" : "Data Privacy Notice"}
            </h1>
            <p className="text-sm text-neutral-700">
              Welcome{user ? `, ${user.first_name}` : ""}. Please read and accept these before using the ERCIHS Scheduling System.
            </p>
          </div>
        </div>

        <div className="max-h-[45dvh] space-y-5 overflow-y-auto rounded-xl border bg-neutral-50 p-4 text-sm text-neutral-800">
          {needsTerms && (
            <div className="space-y-3">
              <h2 className="text-base font-semibold text-branding">Terms and Conditions</h2>
              <DocumentSections sections={TERMS} />
            </div>
          )}
          {needsPrivacy && (
            <div className="space-y-3">
              <h2 className="text-base font-semibold text-branding">Data Privacy Notice (RA 10173)</h2>
              <DocumentSections sections={privacyNotice(school?.email)} />
            </div>
          )}
        </div>

        {accept.isError && <FormAlert>{apiErrorMessage(accept.error)}</FormAlert>}

        <div className="space-y-2">
          {needsTerms && (
            <label htmlFor="accept-terms-gate" className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm text-neutral-800">
              <Checkbox id="accept-terms-gate" checked={termsChecked} onCheckedChange={(checked) => setTermsChecked(checked === true)} className="mt-0.5 size-5" />
              I have read and agree to the Terms and Conditions.
            </label>
          )}
          {needsPrivacy && (
            <label htmlFor="accept-privacy-gate" className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm text-neutral-800">
              <Checkbox id="accept-privacy-gate" checked={privacyChecked} onCheckedChange={(checked) => setPrivacyChecked(checked === true)} className="mt-0.5 size-5" />
              I have read the Data Privacy Notice and agree to the processing of my personal information under the Data Privacy Act of 2012 (RA 10173).
            </label>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="ghost" className="h-11" disabled={logout.isPending} onClick={() => logout.mutate()}>
            <LogOut />
            Sign out
          </Button>
          <Button type="button" className="h-11" disabled={!isReady || accept.isPending} onClick={() => accept.mutate()}>
            {accept.isPending ? "Saving..." : "Continue"}
          </Button>
        </div>
      </section>
    </div>
  );
};

export default TermsGate;
