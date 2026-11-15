import React from "react";
import { ArrowLeft, MailCheck } from "lucide-react";
import { useResendLoginCode, useVerifyLoginCode, type CodeRequired } from "@/api/auth";
import { apiErrorMessage } from "@/lib/forms";
import type { User } from "@/types/api";
import FormAlert from "@/components/global-component/FormAlert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

const RESEND_WAIT = 60;

type LoginCodeStepProp = {
  sent: CodeRequired;
  onBack: () => void;
  onSignedIn: (user: User) => void;
};

/**
 * The second step of signing in: the 6-digit code sent to the DepEd email. The device can be
 * remembered for 30 days, and a new code can be sent once a minute.
 */
const LoginCodeStep = ({ sent, onBack, onSignedIn }: LoginCodeStepProp) => {
  const verify = useVerifyLoginCode();
  const resend = useResendLoginCode();
  const [code, setCode] = React.useState("");
  const [remember, setRemember] = React.useState(true);
  const [wait, setWait] = React.useState(RESEND_WAIT);
  const [sentTo, setSentTo] = React.useState(sent.sent_to);

  React.useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setWait((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  const isComplete = /^\d{6}$/.test(code);
  const error = verify.error ?? resend.error;

  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (isComplete) verify.mutate({ code, remember_device: remember }, { onSuccess: ({ data }) => onSignedIn(data) });
      }}
    >
      <div className="flex items-start gap-3 rounded-xl border bg-neutral-50 p-4">
        <MailCheck className="mt-0.5 size-5 shrink-0 text-branding" />
        <div className="space-y-1 text-sm text-neutral-800">
          <p className="font-medium text-neutral-900">Check your DepEd email</p>
          <p>
            We sent a 6-digit code to <span className="font-medium">{sentTo}</span>. It is valid for {sent.minutes} minutes.
            Check the Spam folder if you do not see it.
          </p>
        </div>
      </div>

      {error && <FormAlert>{apiErrorMessage(error)}</FormAlert>}
      {resend.isSuccess && !error && <FormAlert variant="success">A new code was sent.</FormAlert>}

      <div className="space-y-1">
        <label htmlFor="login-code" className="text-sm text-neutral-800">
          Sign-in code
        </label>
        <Input
          id="login-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="123456"
          className="h-12 text-center text-xl tracking-[0.5em]"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          autoFocus
        />
      </div>

      <label htmlFor="remember-device" className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-neutral-800">
        <Checkbox id="remember-device" checked={remember} onCheckedChange={(checked) => setRemember(checked === true)} className="size-5" />
        Remember this device for 30 days
      </label>

      <Button type="submit" className="h-11 w-full" disabled={!isComplete || verify.isPending}>
        {verify.isPending ? "Checking..." : "Verify and sign in"}
      </Button>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="ghost" className="h-11" onClick={onBack}>
          <ArrowLeft />
          Use a different account
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11"
          disabled={wait > 0 || resend.isPending}
          onClick={() =>
            resend.mutate(undefined, {
              onSuccess: (result) => {
                setSentTo(result.sent_to);
                setWait(RESEND_WAIT);
                setCode("");
              },
            })
          }
        >
          {resend.isPending ? "Sending..." : wait > 0 ? `Send a new code (${wait}s)` : "Send a new code"}
        </Button>
      </div>
    </form>
  );
};

export default LoginCodeStep;
