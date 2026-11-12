import "./App.css";
import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router";
import {
  GuestOnly,
  RequireAuth,
  RequireRole,
} from "./components/global-component/RouteGuards";
import { ROLES } from "./lib/navigation";

// Each page downloads only when opened, so phones do not load the whole system at once.
const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/Login"));
const SignUp = lazy(() => import("./pages/SignUp"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Index = lazy(() => import("./pages/Index"));
const Schedule = lazy(() => import("./pages/Schedule"));
const PlotterPage = lazy(() => import("./features/schedule/plotter/PlotterPage"));
const RoomSchedulePage = lazy(() => import("./features/schedule/RoomSchedulePage"));
const BuildingViewPage = lazy(() => import("./features/schedule/BuildingViewPage"));
const TeacherDetailPage = lazy(() => import("./features/teachers/TeacherDetailPage"));
const DashboardIndex = lazy(() => import("./features/dashboard/DashboardIndex"));
const GuestViewIndex = lazy(() => import("./features/guest/GuestViewIndex"));
const GuestSectionPage = lazy(() => import("./features/guest/GuestSectionPage"));
const MySchedulePage = lazy(() => import("./features/my-records/MySchedulePage"));
const MyProfilePage = lazy(() => import("./features/my-records/MyProfilePage"));
const UsersIndex = lazy(() => import("./features/users/UsersIndex"));
const ApprovalsIndex = lazy(() => import("./features/approvals/ApprovalsIndex"));
const SchoolYearsIndex = lazy(() => import("./features/school-years/SchoolYearsIndex"));
const TimeSlotsIndex = lazy(() => import("./features/time-slots/TimeSlotsIndex"));
const SectionsIndex = lazy(() => import("./features/sections/SectionsIndex"));
const TeachersIndex = lazy(() => import("./features/teachers/TeachersIndex"));
const BuildingsIndex = lazy(() => import("./features/buildings/BuildingsIndex"));
const ReportsIndex = lazy(() => import("./features/reports/ReportsIndex"));
const SubjectsIndex = lazy(() => import("./features/subjects/SubjectsIndex"));
const TeacherLoadingIndex = lazy(() => import("./features/teacher-loading/TeacherLoadingIndex"));
const ReportSettingsIndex = lazy(() => import("./features/report-settings/ReportSettingsIndex"));

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
        <Route path="guest/sections/:sectionId" element={<GuestSectionPage />} />
        <Route path="reset-password" element={<ResetPassword />} />

        <Route element={<GuestOnly />}>
          <Route index element={<Landing />} />
          <Route path="login" element={<Login />} />
          <Route path="signup" element={<SignUp />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
        </Route>

        {/* Signed-in users, inside the header and sidebar layout */}
        <Route element={<RequireAuth />}>
          <Route element={<Index />}>
            <Route element={<RequireRole roles={ROLES.EVERYONE} />}>
              <Route path="dashboard" element={<DashboardIndex />} />
            </Route>

            <Route element={<RequireRole roles={ROLES.STAFF} />}>
              <Route path="schedule" element={<Schedule />} />
              <Route path="schedule/sections/:sectionId" element={<PlotterPage />} />
              <Route path="schedule/rooms/:roomId" element={<RoomSchedulePage />} />
              <Route path="schedule/buildings/:buildingId" element={<BuildingViewPage />} />
              <Route path="teachers" element={<TeachersIndex />} />
              <Route path="teachers/:teacherId" element={<TeacherDetailPage />} />
              <Route path="subjects" element={<SubjectsIndex />} />
              <Route path="buildings" element={<BuildingsIndex />} />
              <Route path="time-slots" element={<TimeSlotsIndex />} />
              <Route path="reports" element={<ReportsIndex />} />
            </Route>

              <Route path="teacher-loading" element={<TeacherLoadingIndex />} />
              <Route path="sections" element={<SectionsIndex />} />

            <Route element={<RequireRole roles={ROLES.ADMIN} />}>
              <Route path="approvals" element={<ApprovalsIndex />} />
              <Route path="school-years" element={<SchoolYearsIndex />} />
              <Route path="users" element={<UsersIndex />} />
              <Route path="report-settings" element={<ReportSettingsIndex />} />
            </Route>

            <Route element={<RequireRole roles={ROLES.TEACHING} />}>
              <Route path="my-schedule" element={<MySchedulePage />} />
              <Route path="my-profile" element={<MyProfilePage />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
