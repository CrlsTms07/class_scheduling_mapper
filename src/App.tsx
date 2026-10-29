import "./App.css";
import { Route, Routes } from "react-router";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Index from "./pages/Index";
import ShsGenerateScheduleDetail from "./features/schedule/ClassroomScheduleDetail";
import Schedule from "./pages/Schedule";

function App() {
  return (
    <>
      <Routes>
        <Route index element={<Login />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-password" element={<ResetPassword />} />
        <Route path="index" element={<Index />}>
          <Route path="schedule" element={<Schedule />} />
          <Route path="room/:id" element={<ShsGenerateScheduleDetail />} />
        </Route>
      </Routes>
    </>
  );
}

export default App;
