import { useMe } from "@/api/auth";
import { useSelectedTerm } from "@/context/selectedTerm";
import { Card, CardContent } from "@/components/ui/card";
import { ROLE_LABELS } from "@/lib/navigation";

// A starting point: the pending counts, flags and checklist come with the dashboard task.
const DashboardIndex = () => {
  const { data: user } = useMe();
  const { terms, isPending } = useSelectedTerm();
  const activeTerm = terms.find(({ is_active }) => is_active);
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
    </div>
  );
};

export default DashboardIndex;
