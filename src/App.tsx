import "./App.css";
import { Route, Routes } from "react-router";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Index from "./pages/Index";
import GenerateSchedule from "./pages/GenerateSchedule";
import ShsGenerateScheduleDetail from "./layout/sub-pages/ShsGenerateScheduleDetail";

function App() {
  return (
    <>
      <Routes>
        <Route index element={<Login />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-password" element={<ResetPassword />} />
        <Route path="index" element={<Index />}>
          <Route path="schedule" element={<GenerateSchedule />} />
          <Route path="room/:id" element={<ShsGenerateScheduleDetail />} />
        </Route>
      </Routes>
    </>
  );
}

export default App;
