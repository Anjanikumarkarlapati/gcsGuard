import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import BucketDetails from "./pages/BucketDetails";
import AuditLog from "./pages/AuditLog";
import Guide from "./pages/Guide";

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <p className="empty">Loading…</p>;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/buckets/:bucketName" element={<BucketDetails />} />
        <Route path="/audit-log" element={<AuditLog />} />
        <Route path="/guide" element={<Guide />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
