import { Navigate, Outlet, useLocation } from "react-router";
import { session, useMe } from "@/api/auth";
import { homePathFor } from "@/lib/navigation";
import type { RoleName } from "@/types/api";
import { Button } from "@/components/ui/button";
import ChangePasswordGate from "./ChangePasswordGate";
import TermsGate from "./TermsGate";

const CheckingSession = () => (
  <div className="flex min-h-dvh items-center justify-center text-sm text-neutral-600">
    Loading...
  </div>
);

const ServerUnavailable = ({ onRetry }: { onRetry: () => void }) => (
  <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
    <p className="text-sm text-neutral-700">
      Cannot reach the server. Please try again.
    </p>
    <Button className="h-11" onClick={onRetry}>
      Try again
    </Button>
  </div>
);

/** Pages for signed-in users. Visitors are sent to the login page; someone who just signed out, home. */
export const RequireAuth = () => {
  const { data: user, isPending, isError, refetch } = useMe();
  const location = useLocation();

  if (isPending) return <CheckingSession />;
  if (isError) return <ServerUnavailable onRetry={() => refetch()} />;
  if (!user) {
    return session.hasSignedOut ? (
      <Navigate to="/" replace />
    ) : (
      <Navigate to="/login" replace state={{ from: location.pathname }} />
    );
  }

  // An account that has not accepted the Terms and Conditions sees them before anything else.
  if (user.terms_accepted_at === null) return <TermsGate />;
  // After the Admin gave a temporary password, a new one comes next.
  if (user.must_change_password) return <ChangePasswordGate />;

  return <Outlet />;
};

/** Pages for some roles only. Anyone else goes back to their own home page. */
export const RequireRole = ({ roles }: { roles: RoleName[] }) => {
  const { data: user } = useMe();

  if (!user?.role || !roles.includes(user.role)) {
    return <Navigate to={homePathFor(user?.role ?? null)} replace />;
  }

  return <Outlet />;
};

/** Login, sign-up and similar pages. Signed-in users go to their home page. */
export const GuestOnly = () => {
  const { data: user, isPending } = useMe();

  if (isPending) return <CheckingSession />;
  if (user) return <Navigate to={homePathFor(user.role)} replace />;

  return <Outlet />;
};
