import { Navigate, Route, Routes } from "react-router-dom";
import { useAuthStore } from "./store/authStore";
import { LoginPage } from "./pages/LoginPage";
import { AppSelectorPage } from "./pages/AppSelectorPage";
import { WorkflowShell } from "./pages/workflow/WorkflowShell";
import { DashboardPage } from "./pages/workflow/DashboardPage";
import { WorkflowListPage } from "./pages/workflow/WorkflowListPage";
import { WorkflowDesignerPage } from "./pages/workflow/WorkflowDesignerPage";
import { InstanceListPage } from "./pages/workflow/InstanceListPage";
import { InstanceDetailPage } from "./pages/workflow/InstanceDetailPage";

function RequireAuth({ children }: { children: JSX.Element }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function RequireCompany({ children }: { children: JSX.Element }) {
  const currentCompanyId = useAuthStore((s) => s.currentCompanyId);
  if (!currentCompanyId) return <Navigate to="/apps" replace />;
  return children;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/apps"
        element={
          <RequireAuth>
            <AppSelectorPage />
          </RequireAuth>
        }
      />
      <Route
        path="/workflow"
        element={
          <RequireAuth>
            <RequireCompany>
              <WorkflowShell />
            </RequireCompany>
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="designer" element={<WorkflowListPage />} />
        <Route path="designer/:id" element={<WorkflowDesignerPage />} />
        <Route path="instances" element={<InstanceListPage />} />
        <Route path="instances/:id" element={<InstanceDetailPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
