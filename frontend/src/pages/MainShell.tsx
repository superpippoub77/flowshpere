import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Stack,
  Typography,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Collapse,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
} from "@mui/material";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import DashboardIcon from "@mui/icons-material/SpaceDashboardOutlined";
import AccountTreeIcon from "@mui/icons-material/AccountTreeOutlined";
import ListAltIcon from "@mui/icons-material/ListAltOutlined";
import ScheduleIcon from "@mui/icons-material/ScheduleOutlined";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import GroupsIcon from "@mui/icons-material/GroupsOutlined";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import BusinessIcon from "@mui/icons-material/BusinessOutlined";
import PeopleIcon from "@mui/icons-material/PeopleOutlined";
import LockPersonIcon from "@mui/icons-material/LockPersonOutlined";
import LogoutIcon from "@mui/icons-material/LogoutOutlined";
import { api } from "../api/client";
import { useAuthStore } from "../store/authStore";

// Operazioni disponibili per applicazione: questo e' il catalogo che rende
// la sidebar "a cascata" — ogni app abilitata si apre mostrando cosa ci puoi
// fare dentro, senza dover prima passare da una schermata di selezione.
const APP_OPERATIONS: Record<string, { label: string; to: string; icon: JSX.Element }[]> = {
  workflow: [
    { label: "Dashboard", to: "/workflow/dashboard", icon: <DashboardIcon fontSize="small" /> },
    { label: "Designer workflow", to: "/workflow/designer", icon: <AccountTreeIcon fontSize="small" /> },
    { label: "Istanze", to: "/workflow/instances", icon: <ListAltIcon fontSize="small" /> },
  ],
  timesheet: [{ label: "Presto disponibile", to: "#", icon: <ScheduleIcon fontSize="small" /> }],
  ticket: [{ label: "Presto disponibile", to: "#", icon: <ConfirmationNumberIcon fontSize="small" /> }],
  crm: [{ label: "Presto disponibile", to: "#", icon: <GroupsIcon fontSize="small" /> }],
};

const APP_ICONS: Record<string, JSX.Element> = {
  workflow: <AccountTreeIcon />,
  timesheet: <ScheduleIcon />,
  ticket: <ConfirmationNumberIcon />,
  crm: <GroupsIcon />,
};

const ADMIN_ITEMS = [
  { label: "Aziende", to: "/admin/companies", icon: <BusinessIcon fontSize="small" /> },
  { label: "Utenti", to: "/admin/users", icon: <PeopleIcon fontSize="small" /> },
  { label: "Permessi", to: "/admin/permissions", icon: <LockPersonIcon fontSize="small" /> },
];

function NavItem({ to, icon, label }: { to: string; icon: JSX.Element; label: string }) {
  return (
    <ListItemButton
      component={NavLink}
      to={to}
      sx={{
        pl: 4,
        py: 0.6,
        color: "text.secondary",
        "&.active": { color: "text.primary", background: "rgba(127,184,217,0.12)" },
        "&:hover": { background: "rgba(127,184,217,0.08)" },
      }}
    >
      <ListItemIcon sx={{ minWidth: 32, color: "inherit" }}>{icon}</ListItemIcon>
      <ListItemText primary={label} primaryTypographyProps={{ fontSize: 13.5 }} />
    </ListItemButton>
  );
}

export function MainShell() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const companies = useAuthStore((s) => s.companies);
  const setCompanies = useAuthStore((s) => s.setCompanies);
  const currentCompanyId = useAuthStore((s) => s.currentCompanyId);
  const setCurrentCompany = useAuthStore((s) => s.setCurrentCompany);
  const logout = useAuthStore((s) => s.logout);

  const { data } = useQuery({
    queryKey: ["me-companies"],
    queryFn: async () => (await api.get("/auth/me/companies")).data,
  });

  useEffect(() => {
    if (data) setCompanies(data);
  }, [data, setCompanies]);

  const list = companies.length ? companies : data ?? [];

  useEffect(() => {
    if (!currentCompanyId && list.length > 0) setCurrentCompany(list[0].id);
  }, [list, currentCompanyId, setCurrentCompany]);

  const [openApps, setOpenApps] = useState<Record<string, boolean>>({ workflow: true });
  const [openAdmin, setOpenAdmin] = useState(true);

  const company = list.find((c: any) => c.id === currentCompanyId);

  if (list.length === 0) {
    return (
      <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--ink-navy)" }}>
        <Typography color="text.secondary">Caricamento...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <Box
        sx={{
          width: 260,
          flexShrink: 0,
          background: "var(--ink-navy)",
          borderRight: "1px solid rgba(127,184,217,0.14)",
          display: "flex",
          flexDirection: "column",
          py: 2,
        }}
      >
        <Stack spacing={0.2} sx={{ px: 2.5, mb: 2 }}>
          <Typography variant="overline" color="primary">
            FLOWSPHERE
          </Typography>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {user?.fullName}
          </Typography>
        </Stack>

        <Box sx={{ px: 2, mb: 1.5 }}>
          <Select
            size="small"
            fullWidth
            value={currentCompanyId ?? ""}
            onChange={(e) => setCurrentCompany(e.target.value as string)}
          >
            {list.map((c: any) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}
          </Select>
        </Box>

        <Box sx={{ flex: 1, overflowY: "auto" }}>
          {(Object.entries(
            (company?.applications ?? []).reduce((acc: Record<string, any[]>, appItem: any) => {
              const cat = appItem.category ?? "Generale";
              (acc[cat] ||= []).push(appItem);
              return acc;
            }, {})
          ) as [string, any[]][]).map(([category, apps]) => (
            <Box key={category} sx={{ mb: 0.5 }}>
              <Typography variant="overline" color="text.secondary" sx={{ px: 2, fontSize: 10.5 }}>
                {category}
              </Typography>
              <List dense sx={{ px: 0.5 }}>
                {apps.map((appItem: any) => (
                  <Box key={appItem.key}>
                    <ListItemButton
                      onClick={() => setOpenApps((o) => ({ ...o, [appItem.key]: !o[appItem.key] }))}
                      sx={{ borderRadius: 1 }}
                    >
                      <ListItemIcon sx={{ minWidth: 34, color: "primary.main" }}>{APP_ICONS[appItem.key] ?? <AccountTreeIcon />}</ListItemIcon>
                      <ListItemText primary={appItem.name} primaryTypographyProps={{ fontSize: 14, fontWeight: 600 }} />
                      {openApps[appItem.key] ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                    </ListItemButton>
                    <Collapse in={!!openApps[appItem.key]}>
                      <List disablePadding dense>
                        {(APP_OPERATIONS[appItem.key] ?? []).map((op) => (
                          <NavItem key={op.to} to={op.to} icon={op.icon} label={op.label} />
                        ))}
                      </List>
                    </Collapse>
                  </Box>
                ))}
              </List>
            </Box>
          ))}

          {user?.isSuperAdmin && (
            <>
              <Divider sx={{ my: 1, mx: 1.5 }} />
              <List dense sx={{ px: 0.5 }}>
                <ListItemButton onClick={() => setOpenAdmin((o) => !o)} sx={{ borderRadius: 1 }}>
                  <ListItemIcon sx={{ minWidth: 34, color: "secondary.main" }}>
                    <AdminPanelSettingsIcon />
                  </ListItemIcon>
                  <ListItemText primary="Amministrazione" primaryTypographyProps={{ fontSize: 14, fontWeight: 600 }} />
                  {openAdmin ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                </ListItemButton>
                <Collapse in={openAdmin}>
                  <List disablePadding dense>
                    {ADMIN_ITEMS.map((item) => (
                      <NavItem key={item.to} to={item.to} icon={item.icon} label={item.label} />
                    ))}
                  </List>
                </Collapse>
              </List>
            </>
          )}
        </Box>

        <Stack direction="row" spacing={0.5} sx={{ px: 1.5, pt: 1 }}>
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
          <Typography variant="caption" color="text.secondary" className="mono">
            {company?.role}
          </Typography>
        </Box>
        <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          {currentCompanyId ? <Outlet /> : null}
        </Box>
      </Box>
    </Box>
  );
}
