import React from "react";
import { LogOut } from "lucide-react";
import { useLogout } from "@/api/auth";
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

/** Asks once before signing out, so a stray tap never ends someone's work. The guards then go home. */
const SignOutButton = () => {
  const [isAsking, setIsAsking] = React.useState(false);
  const logout = useLogout();

  return (
    <>
      <Button variant="ghost" size="icon" aria-label="Sign out" className="size-11" onClick={() => setIsAsking(true)}>
        <LogOut className="text-[#790D16]" />
      </Button>

      <Dialog open={isAsking} onOpenChange={setIsAsking}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="text-branding">Sign out?</DialogTitle>
            <DialogDescription>
              Are you sure you want to sign out? You will need your email and password to sign in again.
            </DialogDescription>
          </DialogHeader>
          {logout.isError && <FormAlert>{apiErrorMessage(logout.error)}</FormAlert>}
          <DialogFooter>
            <Button type="button" variant="outline" className="h-11" onClick={() => setIsAsking(false)}>
              Cancel
            </Button>
            <Button type="button" className="h-11" disabled={logout.isPending} onClick={() => logout.mutate()}>
              {logout.isPending ? "Signing out..." : "Yes, sign out"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SignOutButton;
