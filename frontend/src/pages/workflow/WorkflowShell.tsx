import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Box, Stack, Typography, IconButton, Tooltip, Divider } from "@mui/material";
import DashboardIcon from "@mui/icons-material/SpaceDashboardOutlined";
import AccountTreeIcon from "@mui/icons-material/AccountTreeOutlined";
import ListAltIcon from "@mui/icons-material/ListAltOutlined";
import AppsIcon from "@mui/icons-material/AppsOutlined";
import LogoutIcon from "@mui/icons-material/LogoutOutlined";
import { useAuthStore } from "../../store/authStore";

const navItems = [
  { to: "/workflow/dashboard", label: "Dashboard", icon: <DashboardIcon /> },
  { to: "/workflow/designer", label: "Workflow", icon: <AccountTreeIcon /> },
  { to: "/workflow/instances", label: "Istanze", icon: <ListAltIcon /> },
];

export function WorkflowShell() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const companies = useAuthStore((s) => s.companies);
  const currentCompanyId = useAuthStore((s) => s.currentCompanyId);
  const logout = useAuthStore((s) => s.logout);
  const company = companies.find((c) => c.id === currentCompanyId);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <Box
        sx={{
          width: 220,
          flexShrink: 0,
          background: "var(--ink-navy)",
          borderRight: "1px solid rgba(127,184,217,0.14)",
          display: "flex",
          flexDirection: "column",
          py: 2,
        }}
      >
        <Stack spacing={0.2} sx={{ px: 2.5, mb: 3 }}>
          <Typography variant="overline" color="primary">
            WORKFLOW
          </Typography>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Management
          </Typography>
        </Stack>

        <Stack spacing={0.5} sx={{ px: 1.5, flex: 1 }}>
          {navItems.map((item) => (
            <Box
              key={item.to}
              component={NavLink}
              to={item.to}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                px: 1.5,
                py: 1,
                borderRadius: 1,
                textDecoration: "none",
                color: "text.secondary",
                fontSize: 14,
                "&.active": {
                  color: "text.primary",
                  background: "rgba(127,184,217,0.12)",
                },
                "&:hover": { background: "rgba(127,184,217,0.08)" },
              }}
            >
              {item.icon}
              {item.label}
            </Box>
          ))}
        </Stack>

        <Divider sx={{ mx: 1.5, my: 1 }} />
        <Stack direction="row" spacing={0.5} sx={{ px: 1.5 }}>
          <Tooltip title="Cambia applicazione">
            <IconButton size="small" onClick={() => navigate("/apps")}>
              <AppsIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Esci">
            <IconButton
              size="small"
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Box
          sx={{
            height: 56,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 3,
            borderBottom: "1px solid rgba(127,184,217,0.14)",
          }}
        >
          <Typography variant="body2" color="text.secondary" className="mono">
            {company?.name ?? "—"}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2">{user?.fullName}</Typography>
            <Typography variant="caption" color="text.secondary" className="mono">
              {company?.role}
            </Typography>
          </Stack>
        </Box>
        <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
