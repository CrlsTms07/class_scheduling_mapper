import "./App.css";
import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router";
import {
  GuestOnly,
  RequireAuth,
  RequireRole,
} from "./components/global-component/RouteGuards";
import ComingSoonIndex from "./features/coming-soon/ComingSoonIndex";
import { ROLES } from "./lib/navigation";

// Each page downloads only when opened, so phones do not load the whole system at once.
const Login = lazy(() => import("./pages/Login"));
const SignUp = lazy(() => import("./pages/SignUp"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Index = lazy(() => import("./pages/Index"));
const Schedule = lazy(() => import("./pages/Schedule"));
const PlotterPage = lazy(() => import("./features/schedule/plotter/PlotterPage"));
const DashboardIndex = lazy(() => import("./features/dashboard/DashboardIndex"));
const GuestViewIndex = lazy(() => import("./features/guest/GuestViewIndex"));
const UsersIndex = lazy(() => import("./features/users/UsersIndex"));

const PageLoading = () => (
  <div className="flex min-h-dvh items-center justify-center text-sm text-neutral-600">
    Loading...
  </div>
);

function App() {
  return (
    <Suspense fallback={<PageLoading />}>
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
              <Route path="schedule/sections/:sectionId" element={<PlotterPage />} />
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
              <Route path="users" element={<UsersIndex />} />
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
    </Suspense>
  );
}

export default App;
