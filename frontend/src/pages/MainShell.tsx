import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Stack,
  Typography,
  MenuItem,
  IconButton,
  Tooltip,
  Collapse,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Menu,
  Avatar,
  Chip,
} from "@mui/material";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import MenuOpenIcon from "@mui/icons-material/MenuOpen";
import MenuIcon from "@mui/icons-material/Menu";
import DashboardIcon from "@mui/icons-material/SpaceDashboardOutlined";
import AccountTreeIcon from "@mui/icons-material/AccountTreeOutlined";
import ListAltIcon from "@mui/icons-material/ListAltOutlined";
import VpnKeyIcon from "@mui/icons-material/VpnKeyOutlined";
import ScheduleIcon from "@mui/icons-material/ScheduleOutlined";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import GroupsIcon from "@mui/icons-material/GroupsOutlined";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import BusinessIcon from "@mui/icons-material/BusinessOutlined";
import PeopleIcon from "@mui/icons-material/PeopleOutlined";
import LockPersonIcon from "@mui/icons-material/LockPersonOutlined";
import HistoryIcon from "@mui/icons-material/HistoryOutlined";
import EmailIcon from "@mui/icons-material/EmailOutlined";
import LoginIcon from "@mui/icons-material/LoginOutlined";
import LogoutIcon from "@mui/icons-material/LogoutOutlined";
import AccountCircleIcon from "@mui/icons-material/AccountCircleOutlined";
import LightModeIcon from "@mui/icons-material/LightModeOutlined";
import DarkModeIcon from "@mui/icons-material/DarkModeOutlined";
import TranslateIcon from "@mui/icons-material/TranslateOutlined";
import HelpOutlineIcon from "@mui/icons-material/HelpOutlineOutlined";
import { api, getAvatarUrl } from "../api/client";
import { useAuthStore } from "../store/authStore";
import { useThemeMode } from "../contexts/ThemeModeContext";
import { useI18n } from "../i18n";
import { GlobalSearch } from "../components/GlobalSearch";
import { ProfileDialog } from "../components/ProfileDialog";
import { StatusBar } from "../components/StatusBar";
import { HelpWizard } from "../components/HelpWizard";
import { appKeyFromPath } from "../lib/appKey";

const APP_OPERATIONS: Record<string, { label: string; to: string; icon: JSX.Element; adminOnly?: boolean }[]> = {
  workflow: [
    { label: "Dashboard", to: "/workflow/dashboard", icon: <DashboardIcon fontSize="small" /> },
    { label: "Designer workflow", to: "/workflow/designer", icon: <AccountTreeIcon fontSize="small" />, adminOnly: true },
    { label: "Istanze", to: "/workflow/instances", icon: <ListAltIcon fontSize="small" /> },
    { label: "Token API", to: "/workflow/api-tokens", icon: <VpnKeyIcon fontSize="small" />, adminOnly: true },
  ],
  timesheet: [{ label: "Presto disponibile", to: "#", icon: <ScheduleIcon fontSize="small" /> }],
  ticket: [
    { label: "Ticket", to: "/ticket/tickets", icon: <ConfirmationNumberIcon fontSize="small" /> },
    { label: "Rami di gestione", to: "/ticket/categories", icon: <ListAltIcon fontSize="small" />, adminOnly: true },
    { label: "Token API", to: "/workflow/api-tokens", icon: <VpnKeyIcon fontSize="small" />, adminOnly: true },
  ],
  crm: [{ label: "Presto disponibile", to: "#", icon: <GroupsIcon fontSize="small" /> }],
};

const APP_ICONS: Record<string, JSX.Element> = {
  workflow: <AccountTreeIcon />,
  timesheet: <ScheduleIcon />,
  ticket: <ConfirmationNumberIcon />,
  crm: <GroupsIcon />,
};

const APP_LABELS: Record<string, string> = {
  workflow: "Workflow",
  timesheet: "Timesheet",
  ticket: "Ticket",
  crm: "CRM",
};

const ADMIN_ITEMS = [
  { label: "Aziende", to: "/admin/companies", icon: <BusinessIcon fontSize="small" /> },
  { label: "Utenti", to: "/admin/users", icon: <PeopleIcon fontSize="small" /> },
  { label: "Permessi", to: "/admin/permissions", icon: <LockPersonIcon fontSize="small" /> },
  { label: "Registro attività", to: "/admin/audit-logs", icon: <HistoryIcon fontSize="small" /> },
  { label: "Configurazione email", to: "/admin/mail-settings", icon: <EmailIcon fontSize="small" /> },
  { label: "Accesso Google/Facebook", to: "/admin/oauth-settings", icon: <LoginIcon fontSize="small" /> },
];

const MIN_WIDTH = 200;
const MAX_WIDTH = 420;
const COLLAPSED_WIDTH = 64;

function CollapsedAppButton({
  icon,
  label,
  operations,
}: {
  icon: JSX.Element;
  label: string;
  operations: { to: string; icon: JSX.Element; label: string }[];
}) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  return (
    <>
      <Tooltip title={label} placement="right">
        <ListItemButton
          onClick={(e) => setAnchor(e.currentTarget)}
          sx={{ justifyContent: "center", borderRadius: 1, mb: 0.3 }}
        >
          <ListItemIcon sx={{ minWidth: 0, color: "primary.main" }}>{icon}</ListItemIcon>
        </ListItemButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: "top", horizontal: "right" }}>
        <Typography variant="overline" color="text.secondary" sx={{ px: 2, py: 0.5, display: "block" }}>
          {label}
        </Typography>
        {operations.map((op) => (
          <MenuItem key={op.to} component={NavLink} to={op.to} onClick={() => setAnchor(null)}>
            <ListItemIcon sx={{ minWidth: 32 }}>{op.icon}</ListItemIcon>
            {op.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

function NavItem({ to, icon, label }: { to: string; icon: JSX.Element; label: string }) {
  return (
    <ListItemButton
      component={NavLink}
      to={to}
      sx={{
        pl: 4,
        py: 0.6,
        color: "text.secondary",
        borderLeft: "3px solid transparent",
        "&.active": {
          color: "text.primary",
          background: "rgba(127,184,217,0.14)",
          borderLeft: "3px solid",
          borderLeftColor: "primary.main",
          fontWeight: 600,
        },
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
  const location = useLocation();
  const appKey = appKeyFromPath(location.pathname);
  const user = useAuthStore((s) => s.user);
  const companies = useAuthStore((s) => s.companies);
  const setCompanies = useAuthStore((s) => s.setCompanies);
  const currentCompanyIdByApp = useAuthStore((s) => s.currentCompanyIdByApp);
  const setCurrentCompanyForApp = useAuthStore((s) => s.setCurrentCompanyForApp);
  const getCurrentCompanyForApp = useAuthStore((s) => s.getCurrentCompanyForApp);
  const currentCompanyId = getCurrentCompanyForApp(appKey);
  const logout = useAuthStore((s) => s.logout);
  const { mode, toggle: toggleTheme } = useThemeMode();
  const { lang, setLang, t } = useI18n();

  const { data } = useQuery({
    queryKey: ["me-companies"],
    queryFn: async () => (await api.get("/auth/me/companies")).data,
  });

  const ticketCompanyId = getCurrentCompanyForApp("ticket");
  const workflowCompanyId = getCurrentCompanyForApp("workflow");

  const { data: ticketPending } = useQuery({
    queryKey: ["badge-tickets-pending", ticketCompanyId],
    queryFn: async () => (await api.get("/tickets", { status: "APERTO", companyId: ticketCompanyId })).data,
    enabled: !!ticketCompanyId,
    refetchInterval: 15000,
  });
  const { data: ticketDone } = useQuery({
    queryKey: ["badge-tickets-done", ticketCompanyId],
    queryFn: async () => (await api.get("/tickets", { status: "RISOLTO", companyId: ticketCompanyId })).data,
    enabled: !!ticketCompanyId,
    refetchInterval: 15000,
  });
  const { data: instancesPending } = useQuery({
    queryKey: ["badge-instances-pending", workflowCompanyId],
    queryFn: async () => (await api.get("/instances", { openClosed: "open", companyId: workflowCompanyId })).data,
    enabled: !!workflowCompanyId,
    refetchInterval: 15000,
  });
  const { data: instancesDone } = useQuery({
    queryKey: ["badge-instances-done", workflowCompanyId],
    queryFn: async () => (await api.get("/instances", { openClosed: "closed", companyId: workflowCompanyId })).data,
    enabled: !!workflowCompanyId,
    refetchInterval: 15000,
  });

  const APP_BADGES: Record<string, { pending?: number; done?: number }> = {
    ticket: { pending: ticketPending?.total, done: ticketDone?.total },
    workflow: { pending: instancesPending?.total, done: instancesDone?.total },
  };

  useEffect(() => {
    if (data) setCompanies(data);
  }, [data, setCompanies]);

  const list = companies.length ? companies : data ?? [];

  useEffect(() => {
    if (currentCompanyId || list.length === 0) return;
    // Preferisce un'azienda in cui questa app e' effettivamente abilitata,
    // altrimenti ripiega sulla prima disponibile.
    const withApp = list.find((c: any) => c.applications?.some((a: any) => a.key === appKey));
    setCurrentCompanyForApp(appKey, (withApp ?? list[0]).id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, currentCompanyId, appKey]);

  const [openApps, setOpenApps] = useState<Record<string, boolean>>({ workflow: true });
  const [helpAppKey, setHelpAppKey] = useState<string | null>(null);
  const [openAdmin, setOpenAdmin] = useState(true);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("wf_sidebar_collapsed") === "1");
  const [width, setWidth] = useState(() => Number(localStorage.getItem("wf_sidebar_width")) || 260);
  const resizing = useRef(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [langMenuAnchor, setLangMenuAnchor] = useState<null | HTMLElement>(null);
  const [profileMenuAnchor, setProfileMenuAnchor] = useState<null | HTMLElement>(null);

  useEffect(() => {
    localStorage.setItem("wf_sidebar_collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  function startResize() {
    resizing.current = true;
    function onMove(e: MouseEvent) {
      if (!resizing.current) return;
      const w = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX));
      setWidth(w);
    }
    function onUp() {
      resizing.current = false;
      localStorage.setItem("wf_sidebar_width", String(width));
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  const company = list.find((c: any) => c.id === currentCompanyId);
  const sidebarWidth = collapsed ? COLLAPSED_WIDTH : width;

  if (list.length === 0) {
    return (
      <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <Typography color="text.secondary">Caricamento...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Box
        sx={{
          width: sidebarWidth,
          flexShrink: 0,
          bgcolor: "background.paper",
          borderRight: "1px solid rgba(127,184,217,0.14)",
          display: "flex",
          flexDirection: "column",
          py: 2,
          position: "relative",
          transition: resizing.current ? "none" : "width 0.15s ease",
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: collapsed ? 1 : 2.5, mb: 2 }}>
          {!collapsed && (
            <Stack spacing={0.2}>
              <Typography variant="overline" color="primary">
                FLOWSPHERE
              </Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {user?.fullName}
              </Typography>
            </Stack>
          )}
          <Tooltip title={collapsed ? t("expand_sidebar") : t("collapse_sidebar")}>
            <IconButton size="small" onClick={() => setCollapsed((c) => !c)} sx={{ color: "text.secondary" }}>
              {collapsed ? <MenuIcon fontSize="small" /> : <MenuOpenIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Stack>

        <Box sx={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
          {(Object.entries(
            (company?.applications ?? []).reduce((acc: Record<string, any[]>, appItem: any) => {
              const cat = appItem.category ?? "Generale";
              (acc[cat] ||= []).push(appItem);
              return acc;
            }, {})
          ) as [string, any[]][]).map(([category, apps]) => (
            <Box key={category} sx={{ mb: 0.5 }}>
              {!collapsed && (
                <Typography variant="overline" color="text.secondary" sx={{ px: 2, fontSize: 10.5 }}>
                  {category}
                </Typography>
              )}
              <List dense sx={{ px: 0.5 }}>
                {apps.map((appItem: any) =>
                  collapsed ? (
                    <CollapsedAppButton
                      key={appItem.key}
                      icon={APP_ICONS[appItem.key] ?? <AccountTreeIcon />}
                      label={appItem.name}
                      operations={(APP_OPERATIONS[appItem.key] ?? []).filter((op) => {
                        if (!op.adminOnly) return true;
                        if (user?.isSuperAdmin) return true;
                        const appCompanyId = getCurrentCompanyForApp(appItem.key);
                        const appCompany = list.find((c: any) => c.id === appCompanyId);
                        return (appCompany?.rolesByApp?.[appItem.key] ?? appCompany?.roleKey) === "ADMIN";
                      })}
                    />
                  ) : (
                    <Box key={appItem.key}>
                      <ListItemButton onClick={() => setOpenApps((o) => ({ ...o, [appItem.key]: !o[appItem.key] }))} sx={{ borderRadius: 1 }}>
                        <ListItemIcon sx={{ minWidth: 34, color: "primary.main" }}>{APP_ICONS[appItem.key] ?? <AccountTreeIcon />}</ListItemIcon>
                        <ListItemText primary={appItem.name} primaryTypographyProps={{ fontSize: 14, fontWeight: 600 }} />
                        {typeof APP_BADGES[appItem.key]?.pending === "number" && APP_BADGES[appItem.key].pending! > 0 && (
                          <Tooltip title="Da elaborare">
                            <Chip
                              size="small"
                              label={APP_BADGES[appItem.key].pending}
                              sx={{ height: 18, fontSize: 11, mr: 0.5, bgcolor: "var(--signal-amber)", color: "#1a1200", fontWeight: 700 }}
                            />
                          </Tooltip>
                        )}
                        {typeof APP_BADGES[appItem.key]?.done === "number" && APP_BADGES[appItem.key].done! > 0 && (
                          <Tooltip title="Elaborati di recente">
                            <Chip
                              size="small"
                              label={APP_BADGES[appItem.key].done}
                              sx={{ height: 18, fontSize: 11, mr: 0.5, bgcolor: "var(--verdigris)", color: "#04140f", fontWeight: 700 }}
                            />
                          </Tooltip>
                        )}
                        <Tooltip title={`Guida ${appItem.name}`}>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              setHelpAppKey(appItem.key);
                            }}
                            sx={{ mr: 0.5 }}
                          >
                            <HelpOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {openApps[appItem.key] ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                      </ListItemButton>
                      <Collapse in={!!openApps[appItem.key]}>
                        <List disablePadding dense>
                          {(APP_OPERATIONS[appItem.key] ?? [])
                            .filter((op) => {
                              if (!op.adminOnly) return true;
                              if (user?.isSuperAdmin) return true;
                              const appCompanyId = getCurrentCompanyForApp(appItem.key);
                              const appCompany = list.find((c: any) => c.id === appCompanyId);
                              return (appCompany?.rolesByApp?.[appItem.key] ?? appCompany?.roleKey) === "ADMIN";
                            })
                            .map((op) => (
                              <NavItem key={op.to} to={op.to} icon={op.icon} label={op.label} />
                            ))}
                        </List>
                      </Collapse>
                    </Box>
                  )
                )}
              </List>
            </Box>
          ))}

          {user?.isSuperAdmin && (
            <>
              <Divider sx={{ my: 1, mx: 1.5 }} />
              <List dense sx={{ px: 0.5 }}>
                {collapsed ? (
                  <CollapsedAppButton icon={<AdminPanelSettingsIcon />} label={t("administration")} operations={ADMIN_ITEMS} />
                ) : (
                  <>
                    <ListItemButton onClick={() => setOpenAdmin((o) => !o)} sx={{ borderRadius: 1 }}>
                      <ListItemIcon sx={{ minWidth: 34, color: "secondary.main" }}>
                        <AdminPanelSettingsIcon />
                      </ListItemIcon>
                      <ListItemText primary={t("administration")} primaryTypographyProps={{ fontSize: 14, fontWeight: 600 }} />
                      {openAdmin ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                    </ListItemButton>
                    <Collapse in={openAdmin}>
                      <List disablePadding dense>
                        {ADMIN_ITEMS.map((item) => (
                          <NavItem key={item.to} to={item.to} icon={item.icon} label={item.label} />
                        ))}
                      </List>
                    </Collapse>
                  </>
                )}
              </List>
            </>
          )}
        </Box>

        <Stack direction="row" spacing={0.5} sx={{ px: 1.5, pt: 1, justifyContent: collapsed ? "center" : "flex-start" }}>
          <Tooltip title={t("logout")}>
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

        {!collapsed && (
          <Box
            onMouseDown={startResize}
            sx={{
              position: "absolute",
              top: 0,
              right: -3,
              width: 6,
              height: "100%",
              cursor: "col-resize",
              zIndex: 10,
            }}
          />
        )}
      </Box>

      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
        <Box
          sx={{
            height: 56,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 3,
            borderBottom: "1px solid rgba(127,184,217,0.14)",
            gap: 2,
          }}
        >
          <GlobalSearch />

          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Tooltip title={mode === "dark" ? t("light_theme") : t("dark_theme")}>
              <IconButton size="small" onClick={toggleTheme}>
                {mode === "dark" ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            <Tooltip title={t("language")}>
              <IconButton size="small" onClick={(e) => setLangMenuAnchor(e.currentTarget)}>
                <TranslateIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Menu anchorEl={langMenuAnchor} open={!!langMenuAnchor} onClose={() => setLangMenuAnchor(null)}>
              <MenuItem selected={lang === "it"} onClick={() => { setLang("it"); setLangMenuAnchor(null); }}>
                Italiano
              </MenuItem>
              <MenuItem selected={lang === "en"} onClick={() => { setLang("en"); setLangMenuAnchor(null); }}>
                English
              </MenuItem>
            </Menu>

            <Tooltip title={t("profile")}>
              <IconButton size="small" onClick={(e) => setProfileMenuAnchor(e.currentTarget)}>
                {user?.hasAvatar && user?.id ? (
                  <Avatar src={getAvatarUrl(user.id)} sx={{ width: 22, height: 22 }} />
                ) : (
                  <AccountCircleIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
            <Menu anchorEl={profileMenuAnchor} open={!!profileMenuAnchor} onClose={() => setProfileMenuAnchor(null)}>
              <MenuItem
                onClick={() => {
                  setProfileOpen(true);
                  setProfileMenuAnchor(null);
                }}
              >
                {t("edit_profile")}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  logout();
                  navigate("/login");
                }}
              >
                {t("logout")}
              </MenuItem>
            </Menu>
          </Stack>
        </Box>
        <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>{currentCompanyId ? <Outlet /> : null}</Box>
        <StatusBar companyName={company?.name} roleName={company?.role} />
      </Box>

      <ProfileDialog open={profileOpen} onClose={() => setProfileOpen(false)} />
      {helpAppKey && <HelpWizard open={!!helpAppKey} appKey={helpAppKey} onClose={() => setHelpAppKey(null)} />}
    </Box>
  );
}
