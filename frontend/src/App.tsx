import { Navigate, Route, Routes } from "react-router-dom";
import { useAuthStore } from "./store/authStore";
import { LoginPage } from "./pages/LoginPage";
import { MainShell } from "./pages/MainShell";
import { DashboardPage } from "./pages/workflow/DashboardPage";
import { WorkflowListPage } from "./pages/workflow/WorkflowListPage";
import { WorkflowDesignerPage } from "./pages/workflow/WorkflowDesignerPage";
import { InstanceListPage } from "./pages/workflow/InstanceListPage";
import { InstanceDetailPage } from "./pages/workflow/InstanceDetailPage";
import { AdminUsersPage } from "./pages/admin/AdminUsersPage";
import { AdminPermissionsPage } from "./pages/admin/AdminPermissionsPage";
import { AdminCompaniesPage } from "./pages/admin/AdminCompaniesPage";

function RequireAuth({ children }: { children: JSX.Element }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function RequireSuperAdmin({ children }: { children: JSX.Element }) {
  const user = useAuthStore((s) => s.user);
  if (!user?.isSuperAdmin) return <Navigate to="/workflow/dashboard" replace />;
  return children;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/apps" element={<Navigate to="/workflow/dashboard" replace />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <MainShell />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="workflow/dashboard" replace />} />
        <Route path="workflow" element={<Navigate to="dashboard" replace />} />
        <Route path="workflow/dashboard" element={<DashboardPage />} />
        <Route path="workflow/designer" element={<WorkflowListPage />} />
        <Route path="workflow/designer/:id" element={<WorkflowDesignerPage />} />
        <Route path="workflow/instances" element={<InstanceListPage />} />
        <Route path="workflow/instances/:id" element={<InstanceDetailPage />} />

        <Route
          path="admin/companies"
          element={
            <RequireSuperAdmin>
              <AdminCompaniesPage />
            </RequireSuperAdmin>
          }
        />
        <Route
          path="admin/users"
          element={
            <RequireSuperAdmin>
              <AdminUsersPage />
            </RequireSuperAdmin>
          }
        />
        <Route
          path="admin/permissions"
          element={
            <RequireSuperAdmin>
              <AdminPermissionsPage />
            </RequireSuperAdmin>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
