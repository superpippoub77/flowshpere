import { Navigate, Route, Routes } from "react-router-dom";
import { useAuthStore } from "./store/authStore";
import { LoginPage } from "./pages/LoginPage";
import { MainShell } from "./pages/MainShell";
import { DashboardPage } from "./pages/workflow/DashboardPage";
import { WorkflowListPage } from "./pages/workflow/WorkflowListPage";
import { WorkflowDesignerPage } from "./pages/workflow/WorkflowDesignerPage";
import { InstanceListPage } from "./pages/workflow/InstanceListPage";
import { ApiTokensPage } from "./pages/workflow/ApiTokensPage";
import { TicketListPage } from "./pages/ticket/TicketListPage";
import { TicketCategoriesPage } from "./pages/ticket/TicketCategoriesPage";
import { PublicOrderPage } from "./pages/public/PublicOrderPage";
import { PublicTicketPage } from "./pages/public/PublicTicketPage";
import { AdminUsersPage } from "./pages/admin/AdminUsersPage";
import { AdminPermissionsPage } from "./pages/admin/AdminPermissionsPage";
import { AuditLogPage } from "./pages/admin/AuditLogPage";
import { AdminMailSettingsPage } from "./pages/admin/AdminMailSettingsPage";
import { AdminOAuthSettingsPage } from "./pages/admin/AdminOAuthSettingsPage";
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

function RequireAppAdmin({ appKey, children }: { appKey: string | string[]; children: JSX.Element }) {
  const user = useAuthStore((s) => s.user);
  const companies = useAuthStore((s) => s.companies);
  const getCurrentCompanyForApp = useAuthStore((s) => s.getCurrentCompanyForApp);
  const keys = Array.isArray(appKey) ? appKey : [appKey];
  const isAdmin =
    user?.isSuperAdmin ||
    keys.some((k) => {
      const company = companies.find((c) => c.id === getCurrentCompanyForApp(k));
      return (company?.rolesByApp?.[k] ?? company?.roleKey) === "ADMIN";
    });
  if (!isAdmin) return <Navigate to="/workflow/dashboard" replace />;
  return children;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/public/order" element={<PublicOrderPage />} />
      <Route path="/public/ticket" element={<PublicTicketPage />} />
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
        <Route
          path="workflow/designer"
          element={
            <RequireAppAdmin appKey="workflow">
              <WorkflowListPage />
            </RequireAppAdmin>
          }
        />
        <Route
          path="workflow/designer/:id"
          element={
            <RequireAppAdmin appKey="workflow">
              <WorkflowDesignerPage />
            </RequireAppAdmin>
          }
        />
        <Route path="workflow/instances" element={<InstanceListPage />} />
        <Route
          path="workflow/api-tokens"
          element={
            <RequireAppAdmin appKey={["workflow", "ticket"]}>
              <ApiTokensPage />
            </RequireAppAdmin>
          }
        />

        <Route path="ticket/tickets" element={<TicketListPage />} />
        <Route
          path="ticket/categories"
          element={
            <RequireAppAdmin appKey="ticket">
              <TicketCategoriesPage />
            </RequireAppAdmin>
          }
        />

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
        <Route
          path="admin/audit-logs"
          element={
            <RequireSuperAdmin>
              <AuditLogPage />
            </RequireSuperAdmin>
          }
        />
        <Route
          path="admin/mail-settings"
          element={
            <RequireSuperAdmin>
              <AdminMailSettingsPage />
            </RequireSuperAdmin>
          }
        />
        <Route
          path="admin/oauth-settings"
          element={
            <RequireSuperAdmin>
              <AdminOAuthSettingsPage />
            </RequireSuperAdmin>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
