import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Box, Stack, Typography, IconButton, Tooltip } from "@mui/material";
import PeopleIcon from "@mui/icons-material/PeopleOutlined";
import LockPersonIcon from "@mui/icons-material/LockPersonOutlined";
import AppsIcon from "@mui/icons-material/AppsOutlined";
import LogoutIcon from "@mui/icons-material/LogoutOutlined";
import { useAuthStore } from "../../store/authStore";

const navItems = [
  { to: "/admin/users", label: "Utenti", icon: <PeopleIcon /> },
  { to: "/admin/permissions", label: "Permessi", icon: <LockPersonIcon /> },
];

export function AdminShell() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

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
            AMMINISTRAZIONE
          </Typography>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Super Admin
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
                "&.active": { color: "text.primary", background: "rgba(127,184,217,0.12)" },
                "&:hover": { background: "rgba(127,184,217,0.08)" },
              }}
            >
              {item.icon}
              {item.label}
            </Box>
          ))}
        </Stack>

        <Stack direction="row" spacing={0.5} sx={{ px: 1.5 }}>
          <Tooltip title="Torna alle applicazioni">
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
            justifyContent: "flex-end",
            px: 3,
            borderBottom: "1px solid rgba(127,184,217,0.14)",
          }}
        >
          <Typography variant="body2">{user?.fullName}</Typography>
        </Box>
        <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
