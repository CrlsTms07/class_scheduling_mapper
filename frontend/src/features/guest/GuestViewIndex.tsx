import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";
import { buttonVariants } from "@/components/ui/button";

// Placeholder so the login page's button has a destination. Built in the Guest view task.
const GuestViewIndex = () => {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-branding text-xl font-medium">View Schedule</p>
      <p className="text-sm text-neutral-700">This page is being built.</p>
      <Link
        to="/"
        className={buttonVariants({ variant: "link", className: "h-11" })}
      >
        <ArrowLeft />
        Back to Sign in
      </Link>
    </div>
  );
};

export default GuestViewIndex;
