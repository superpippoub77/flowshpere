import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Box, Typography, Card, CardActionArea, CardContent, Stack, Chip, Container } from "@mui/material";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import ScheduleIcon from "@mui/icons-material/Schedule";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import GroupsIcon from "@mui/icons-material/Groups";
import { api } from "../api/client";
import { useAuthStore } from "../store/authStore";

const APP_ICONS: Record<string, JSX.Element> = {
  workflow: <AccountTreeIcon fontSize="large" />,
  timesheet: <ScheduleIcon fontSize="large" />,
  ticket: <ConfirmationNumberIcon fontSize="large" />,
  crm: <GroupsIcon fontSize="large" />,
};

export function AppSelectorPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setCompanies = useAuthStore((s) => s.setCompanies);
  const setCurrentCompany = useAuthStore((s) => s.setCurrentCompany);
  const companies = useAuthStore((s) => s.companies);

  const { data } = useQuery({
    queryKey: ["me-companies"],
    queryFn: async () => (await api.get("/auth/me/companies")).data,
  });

  useEffect(() => {
    if (data) setCompanies(data);
  }, [data, setCompanies]);

  const list = companies.length ? companies : data ?? [];

  function openApp(companyId: string, appKey: string) {
    setCurrentCompany(companyId);
    if (appKey === "workflow") navigate("/workflow");
  }

  return (
    <Box sx={{ minHeight: "100vh", background: "var(--ink-navy)", py: 6 }}>
      <Container maxWidth="md">
        <Typography variant="overline" color="primary">
          Benvenuto {user?.fullName}
        </Typography>
        <Typography variant="h4" sx={{ mb: 4 }}>
          Applicazioni disponibili
        </Typography>

        {list.map((company: any) => (
          <Box key={company.id} sx={{ mb: 4 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
              <Typography variant="h6">{company.name}</Typography>
              <Chip size="small" label={company.role} />
            </Stack>
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
              {company.applications.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  Nessuna applicazione abilitata per questo utente.
                </Typography>
              )}
              {company.applications.map((appItem: any) => (
                <Card key={appItem.key} sx={{ width: 200 }}>
                  <CardActionArea onClick={() => openApp(company.id, appItem.key)}>
                    <CardContent sx={{ textAlign: "center", py: 3 }}>
                      <Box sx={{ color: "primary.main", mb: 1 }}>
                        {APP_ICONS[appItem.key] ?? <AccountTreeIcon fontSize="large" />}
                      </Box>
                      <Typography variant="subtitle2">{appItem.name}</Typography>
                    </CardContent>
                  </CardActionArea>
                </Card>
              ))}
            </Stack>
          </Box>
        ))}
      </Container>
    </Box>
  );
}
