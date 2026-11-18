import React from "react";
import { LogOut } from "lucide-react";
import { useAcceptTerms, useLogout, useMe } from "@/api/auth";
import { apiErrorMessage } from "@/lib/forms";
import { TERMS } from "@/lib/terms";
import FormAlert from "@/components/global-component/FormAlert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * Shown after signing in, before the dashboard, to an account that has not accepted the Terms
 * and Conditions yet. Nothing else opens until the box is ticked and Continue is pressed.
 */
const TermsGate = () => {
  const { data: user } = useMe();
  const accept = useAcceptTerms();
  const logout = useLogout();
  const [isChecked, setIsChecked] = React.useState(false);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-neutral-50 p-4">
      <section aria-labelledby="terms-title" className="w-full max-w-2xl space-y-5 rounded-2xl border bg-background p-5 shadow-sm sm:p-8">
        <div className="flex items-center gap-3">
          <img src="/ercihs-logo.png" alt="" className="size-12 shrink-0" />
          <div>
            <h1 id="terms-title" className="text-xl font-semibold text-branding">
              Terms and Conditions
            </h1>
            <p className="text-sm text-neutral-700">
              Welcome{user ? `, ${user.first_name}` : ""}. Please read and accept these before using the ERCIHS Scheduling System.
            </p>
          </div>
        </div>

        <div className="max-h-[45dvh] space-y-4 overflow-y-auto rounded-xl border bg-neutral-50 p-4 text-sm text-neutral-800">
          {TERMS.map(({ title, points }) => (
            <section key={title} className="space-y-1">
              <h2 className="font-semibold text-neutral-900">{title}</h2>
              <ul className="list-disc space-y-1 pl-5">
                {points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {accept.isError && <FormAlert>{apiErrorMessage(accept.error)}</FormAlert>}

        <label htmlFor="accept-terms-gate" className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm text-neutral-800">
          <Checkbox id="accept-terms-gate" checked={isChecked} onCheckedChange={(checked) => setIsChecked(checked === true)} className="mt-0.5 size-5" />
          I have read and agree to the Terms and Conditions, including how my information is used under the Data Privacy Act.
        </label>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="ghost" className="h-11" disabled={logout.isPending} onClick={() => logout.mutate()}>
            <LogOut />
            Sign out
          </Button>
          <Button type="button" className="h-11" disabled={!isChecked || accept.isPending} onClick={() => accept.mutate()}>
            {accept.isPending ? "Saving..." : "Continue"}
          </Button>
        </div>
      </section>
    </div>
  );
};

export default TermsGate;
