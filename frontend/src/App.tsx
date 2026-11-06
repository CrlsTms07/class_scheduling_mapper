import "./App.css";
import { Route, Routes } from "react-router";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Index from "./pages/Index";
import Schedule from "./pages/Schedule";
import SectionSubjectDetail from "./features/schedule/SectionSubjectDetail";
import ClassroomScheduleDetail from "./features/schedule/ClassroomScheduleDetail";
import ComingSoonIndex from "./features/coming-soon/ComingSoonIndex";
import DashboardIndex from "./features/dashboard/DashboardIndex";
import GuestViewIndex from "./features/guest/GuestViewIndex";
import {
  GuestOnly,
  RequireAuth,
  RequireRole,
} from "./components/global-component/RouteGuards";
import { ROLES } from "./lib/navigation";

function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="guest" element={<GuestViewIndex />} />
      <Route path="reset-password" element={<ResetPassword />} />

      <Route element={<GuestOnly />}>
        <Route index element={<Login />} />
        <Route path="signup" element={<SignUp />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
      </Route>

      {/* Signed-in users, inside the header and sidebar layout */}
      <Route element={<RequireAuth />}>
        <Route element={<Index />}>
          <Route element={<RequireRole roles={ROLES.STAFF} />}>
            <Route path="dashboard" element={<DashboardIndex />} />
            <Route path="schedule" element={<Schedule />} />
            <Route
              path="schedule/classroom-detail"
              element={<ClassroomScheduleDetail />}
            />
            <Route
              path="schedule/section-detail"
              element={<SectionSubjectDetail />}
            />
            <Route path="teachers" element={<ComingSoonIndex title="Teachers" />} />
            <Route path="subjects" element={<ComingSoonIndex title="Subjects" />} />
            <Route path="buildings" element={<ComingSoonIndex title="Building" />} />
            <Route path="reports" element={<ComingSoonIndex title="Reports" />} />
          </Route>

          <Route element={<RequireRole roles={ROLES.SCHEDULERS} />}>
            <Route
              path="teacher-loading"
              element={<ComingSoonIndex title="Teacher Loading" />}
            />
          </Route>

          <Route element={<RequireRole roles={ROLES.ADMIN} />}>
            <Route path="approvals" element={<ComingSoonIndex title="Approvals" />} />
            <Route path="sections" element={<ComingSoonIndex title="Sections" />} />
            <Route
              path="school-years"
              element={<ComingSoonIndex title="School Years" />}
            />
            <Route path="time-slots" element={<ComingSoonIndex title="Time Slots" />} />
            <Route path="users" element={<ComingSoonIndex title="Users" />} />
            <Route
              path="report-settings"
              element={<ComingSoonIndex title="Report Settings" />}
            />
          </Route>

          <Route element={<RequireRole roles={ROLES.TEACHER} />}>
            <Route path="my-schedule" element={<ComingSoonIndex title="My Schedule" />} />
            <Route path="my-profile" element={<ComingSoonIndex title="My Profile" />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
