import { useMe } from "@/api/auth";
import { ROLE_LABELS } from "@/lib/navigation";
import AdminDashboardPanel from "./AdminDashboardPanel";
import SchedulerDashboardPanel from "./SchedulerDashboardPanel";
import TeacherDashboardPanel from "./TeacherDashboardPanel";

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
      {user?.role === "super_admin" && <AdminDashboardPanel />}
      {(user?.role === "glc" || user?.role === "master_teacher") && <SchedulerDashboardPanel />}
      {user?.role === "teacher" && <TeacherDashboardPanel />}
    </div>
  );
};

export default DashboardIndex;
