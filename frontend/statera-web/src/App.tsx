import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Scheduler from "./pages/Scheduler";
import RequireAuth from "./auth/RequireAuth";
export default function App(){
  return (
    <Routes>
      <Route path="/login" element={<Login/>} />
      <Route path="/" element={<RequireAuth><Dashboard/></RequireAuth>} />
      <Route path="/scheduler" element={<RequireAuth><Scheduler/></RequireAuth>} />
    </Routes>
  );
}
