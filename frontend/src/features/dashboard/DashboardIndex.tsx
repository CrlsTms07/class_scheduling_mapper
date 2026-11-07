import { useMe } from "@/api/auth";
import { useSelectedTerm } from "@/context/selectedTerm";
import { Card, CardContent } from "@/components/ui/card";
import { ROLE_LABELS } from "@/lib/navigation";
import AdminDashboardPanel from "./AdminDashboardPanel";

// The scheduler's own counts come with the GLC and Master Teacher screens.
const SchedulerDashboard = () => {
  const { terms, isPending } = useSelectedTerm();
  const activeTerm = terms.find(({ is_active }) => is_active);

  return (
    <Card className="shadow shadow-[#790D16]/40 max-w-md">
      <CardContent>
        <p className="text-xs text-neutral-700">Active term</p>
        {activeTerm ? (
          <>
            <p className="text-teal-700 font-bold text-base">
              {activeTerm.name}
            </p>
            <p className="text-sm">School Year {activeTerm.school_year.name}</p>
          </>
        ) : (
          !isPending && <p className="text-sm">No active term has been set.</p>
        )}
      </CardContent>
    </Card>
  );
};

const DashboardIndex = () => {
  const { data: user } = useMe();
  const grades = user?.grade_levels.map(({ grade }) => grade).join(", ");

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div>
        <p className="text-branding text-xl font-medium">
          Welcome, {user?.first_name}
        </p>
        <p className="text-sm text-neutral-700">
          {user?.role && ROLE_LABELS[user.role]}
          {grades && ` · Grade ${grades}`}
        </p>
      </div>
      {user?.role === "super_admin" ? <AdminDashboardPanel /> : <SchedulerDashboard />}
    </div>
  );
};

export default DashboardIndex;
