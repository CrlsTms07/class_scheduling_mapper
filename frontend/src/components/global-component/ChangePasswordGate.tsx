import React from "react";
import { LogOut } from "lucide-react";
import { useChangePassword, useLogout, useMe } from "@/api/auth";
import { apiErrorMessage } from "@/lib/forms";
import FormAlert from "@/components/global-component/FormAlert";
import PasswordInput from "@/components/global-component/PasswordInput";
import { Button } from "@/components/ui/button";

/**
 * After the Admin gave a temporary password, the person chooses their own before anything else.
 */
const ChangePasswordGate = () => {
  const { data: user } = useMe();
  const change = useChangePassword();
  const logout = useLogout();
  const [current, setCurrent] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmation, setConfirmation] = React.useState("");
  const isMismatch = confirmation !== "" && password !== confirmation;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-neutral-50 p-4">
      <form
        noValidate
        aria-labelledby="change-password-title"
        className="w-full max-w-md space-y-4 rounded-2xl border bg-background p-5 shadow-sm sm:p-8"
        onSubmit={(event) => {
          event.preventDefault();
          if (!isMismatch) change.mutate({ current_password: current, password, password_confirmation: confirmation });
        }}
      >
        <div className="flex items-center gap-3">
          <img src="/ercihs-logo.png" alt="" className="size-12 shrink-0" />
          <div>
            <h1 id="change-password-title" className="text-xl font-semibold text-branding">
              Choose a new password
            </h1>
            <p className="text-sm text-neutral-700">
              {user ? `Hi ${user.first_name}. ` : ""}You signed in with a temporary password from the Admin. Choose your own to continue.
            </p>
          </div>
        </div>

        {change.isError && <FormAlert>{apiErrorMessage(change.error)}</FormAlert>}

        <div className="space-y-1">
          <label htmlFor="current_password" className="text-sm text-neutral-800">
            Temporary password
          </label>
          <PasswordInput id="current_password" autoComplete="current-password" value={current} onChange={(event) => setCurrent(event.target.value)} />
        </div>
        <div className="space-y-1">
          <label htmlFor="new_password" className="text-sm text-neutral-800">
            New password
          </label>
          <PasswordInput id="new_password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <p className="text-xs text-neutral-600">At least 8 characters, with upper and lower case letters, a number and a symbol.</p>
        </div>
        <div className="space-y-1">
          <label htmlFor="new_password_confirmation" className="text-sm text-neutral-800">
            Confirm new password
          </label>
          <PasswordInput
            id="new_password_confirmation"
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            aria-invalid={isMismatch}
          />
          {isMismatch && <p className="text-xs text-destructive">The passwords do not match.</p>}
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="ghost" className="h-11" disabled={logout.isPending} onClick={() => logout.mutate()}>
            <LogOut />
            Sign out
          </Button>
          <Button type="submit" className="h-11" disabled={!current || !password || !confirmation || isMismatch || change.isPending}>
            {change.isPending ? "Saving..." : "Save and continue"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ChangePasswordGate;
