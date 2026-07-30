import { useQuery } from "@tanstack/react-query";
import { Box, Grid, Paper, Typography, Stack } from "@mui/material";
import { api } from "../../api/client";

function KpiCard({ label, value, suffix, accent }: { label: string; value: string | number; suffix?: string; accent?: string }) {
  return (
    <Paper sx={{ p: 2.5, height: "100%" }}>
      <Typography variant="overline" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h3" sx={{ mt: 0.5, color: accent }}>
        {value}
        {suffix && (
          <Typography component="span" variant="h6" color="text.secondary" sx={{ ml: 0.5 }}>
            {suffix}
          </Typography>
        )}
      </Typography>
    </Paper>
  );
}

export function DashboardPage() {
  const { data } = useQuery({
    queryKey: ["kpi"],
    queryFn: async () => (await api.get("/dashboard/kpi")).data,
  });

  return (
    <Box sx={{ p: 3, maxWidth: 1100 }}>
      <Stack spacing={0.3} sx={{ mb: 3 }}>
        <Typography variant="overline" color="primary">
          MONITORAGGIO
        </Typography>
        <Typography variant="h5">KPI Workflow</Typography>
      </Stack>

      <Grid container spacing={2}>
        <Grid item xs={6} md={3}>
          <KpiCard label="Attivi" value={data?.attivi ?? "—"} accent="var(--blueprint-line)" />
        </Grid>
        <Grid item xs={6} md={3}>
          <KpiCard label="Conclusi" value={data?.conclusi ?? "—"} accent="var(--verdigris)" />
        </Grid>
        <Grid item xs={6} md={3}>
          <KpiCard label="Annullati" value={data?.bloccati ?? "—"} accent="var(--rust)" />
        </Grid>
        <Grid item xs={6} md={3}>
          <KpiCard label="Tempo medio" value={data?.tempoMedioOre ?? "—"} suffix="h" />
        </Grid>
        <Grid item xs={6} md={3}>
          <KpiCard label="Approvazioni" value={data?.percentualeApprovazioni ?? "—"} suffix="%" />
        </Grid>
        <Grid item xs={6} md={3}>
          <KpiCard label="Decisioni AI" value={data?.decisioniAi ?? "—"} accent="var(--signal-amber)" />
        </Grid>
        <Grid item xs={6} md={3}>
          <KpiCard label="AI automatiche" value={data?.decisioniAiAutomatiche ?? "—"} accent="var(--signal-amber)" />
        </Grid>
      </Grid>
    </Box>
  );
}
