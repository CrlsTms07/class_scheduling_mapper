import React from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { useResetUserPassword } from "@/api/users";
import { apiErrorMessage } from "@/lib/forms";
import type { User } from "@/types/api";
import ConfirmDelete from "@/components/global-component/ConfirmDelete";
import FormAlert from "@/components/global-component/FormAlert";
import { Button } from "@/components/ui/button";

/**
 * For someone whose reset email did not arrive: a temporary password, shown here once. They
 * must choose a new password on the next sign-in, and every device they used is signed out.
 */
const ResetPasswordBlock = ({ user }: { user: User }) => {
  const reset = useResetUserPassword(user.id);
  const [isCopied, setIsCopied] = React.useState(false);
  const temporary = reset.data?.temporary_password;

  if (temporary) {
    return (
      <div className="space-y-2 rounded-md border border-emerald-300 bg-emerald-50 p-3" role="status">
        <p className="text-sm font-medium text-emerald-950">Temporary password for {user.first_name}</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded bg-white px-3 py-2 text-base font-semibold tracking-wider text-neutral-900">{temporary}</code>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11"
            aria-label="Copy the temporary password"
            onClick={() => {
              void navigator.clipboard?.writeText(temporary);
              setIsCopied(true);
            }}
          >
            {isCopied ? <Check /> : <Copy />}
          </Button>
        </div>
        <p className="text-xs text-emerald-900">
          Give it to {user.first_name} in person or by message. It is shown only now. On the next sign-in they choose their own
          password.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {reset.isError && <FormAlert>{apiErrorMessage(reset.error)}</FormAlert>}
      <ConfirmDelete
        label="Give a temporary password"
        icon={KeyRound}
        warning={`For when the reset email does not arrive. ${user.first_name} is signed out everywhere and must choose a new password on the next sign-in. Continue?`}
        confirmLabel="Yes, reset"
        isPending={reset.isPending}
        onConfirm={() => reset.mutate()}
      />
    </div>
  );
};

export default ResetPasswordBlock;
