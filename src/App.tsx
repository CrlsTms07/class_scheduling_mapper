import "./App.css";
import { Route, Routes } from "react-router";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Index from "./pages/Index";
import Schedule from "./pages/Schedule";
import SectionSubjectDetail from "./features/schedule/SectionSubjectDetail";
import ClassroomScheduleDetail from "./features/schedule/ClassroomScheduleDetail";

function App() {
  return (
    <Routes>
      <Route index element={<Login />} />
      <Route path="forgot-password" element={<ForgotPassword />} />
      <Route path="reset-password" element={<ResetPassword />} />

      <Route path="index" element={<Index />}>
        <Route path="schedule" element={<Schedule />} />
        <Route
          path="schedule/classroom-detail"
          element={<ClassroomScheduleDetail />}
        />
        <Route
          path="schedule/section-detail"
          element={<SectionSubjectDetail />}
        />
      </Route>
    </Routes>
  );
}

export default App;
