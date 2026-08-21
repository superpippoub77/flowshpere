import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Grid,
  Paper,
  Typography,
  Stack,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Alert,
  CircularProgress,
} from "@mui/material";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import { api } from "../../api/client";
import { useI18n } from "../../i18n";
import { CompanySelector } from "../../components/CompanySelector";
import { ClearableTextField } from "../../components/ClearableTextField";

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

function QuickOpenTicket() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [priority, setPriority] = useState("MEDIA");
  const [success, setSuccess] = useState<string | null>(null);

  const { data: categories } = useQuery({
    queryKey: ["ticket-categories"],
    queryFn: async () => (await api.get("/ticket-categories")).data,
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: async () => (await api.post("/tickets", { subject, description, categoryId: categoryId || undefined, priority })).data,
    onSuccess: (ticket) => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      setSuccess(ticket.code);
      setSubject("");
      setDescription("");
      setCategoryId("");
      setPriority("MEDIA");
    },
  });

  function close() {
    setOpen(false);
    setSuccess(null);
  }

  return (
    <>
      <Button variant="outlined" startIcon={<ConfirmationNumberIcon />} onClick={() => setOpen(true)}>
        Apri un ticket
      </Button>

      <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
        <DialogTitle>Apri un ticket</DialogTitle>
        <DialogContent>
          {success ? (
            <Alert severity="success">Ticket aperto correttamente — riferimento {success}.</Alert>
          ) : (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <ClearableTextField label="Oggetto" value={subject} onChange={(e) => setSubject(e.target.value)} fullWidth autoFocus />
              <TextField select label="Ramo" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} fullWidth>
                <MenuItem value="">Nessuno</MenuItem>
                {(categories ?? []).map((c: any) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField select label="Priorità" value={priority} onChange={(e) => setPriority(e.target.value)} fullWidth>
                <MenuItem value="BASSA">Bassa</MenuItem>
                <MenuItem value="MEDIA">Media</MenuItem>
                <MenuItem value="ALTA">Alta</MenuItem>
                <MenuItem value="URGENTE">Urgente</MenuItem>
              </TextField>
              <ClearableTextField label="Descrizione" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth multiline minRows={3} />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={close}>{success ? "Chiudi" : "Annulla"}</Button>
          {!success && (
            <Button
              variant="contained"
              disabled={!subject || createMutation.isPending}
              onClick={() => createMutation.mutate()}
              startIcon={createMutation.isPending ? <CircularProgress size={14} color="inherit" /> : undefined}
            >
              Invia
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}

export function DashboardPage() {
  const { t } = useI18n();
  const { data } = useQuery({
    queryKey: ["kpi"],
    queryFn: async () => (await api.get("/dashboard/kpi")).data,
  });

  return (
    <Box sx={{ p: 3, maxWidth: 1100 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-end" sx={{ mb: 3 }}>
        <Stack spacing={0.3}>
          <Typography variant="overline" color="primary">
            MONITORAGGIO
          </Typography>
          <Typography variant="h5">{t("kpi_workflow")}</Typography>
        </Stack>
        <Stack direction="row" spacing={2} alignItems="center">
          <CompanySelector appKey="workflow" />
          <QuickOpenTicket />
        </Stack>
      </Stack>

      <Grid container spacing={2}>
        <Grid item xs={6} md={3}>
          <KpiCard label={t("active")} value={data?.attivi ?? "—"} accent="var(--blueprint-line)" />
        </Grid>
        <Grid item xs={6} md={3}>
          <KpiCard label={t("completed")} value={data?.conclusi ?? "—"} accent="var(--verdigris)" />
        </Grid>
        <Grid item xs={6} md={3}>
          <KpiCard label={t("cancelled")} value={data?.bloccati ?? "—"} accent="var(--rust)" />
        </Grid>
        <Grid item xs={6} md={3}>
          <KpiCard label={t("avg_time")} value={data?.tempoMedioOre ?? "—"} suffix="h" />
        </Grid>
        <Grid item xs={6} md={3}>
          <KpiCard label={t("approvals")} value={data?.percentualeApprovazioni ?? "—"} suffix="%" />
        </Grid>
        <Grid item xs={6} md={3}>
          <KpiCard label={t("ai_decisions")} value={data?.decisioniAi ?? "—"} accent="var(--signal-amber)" />
        </Grid>
        <Grid item xs={6} md={3}>
          <KpiCard label={t("ai_automatic")} value={data?.decisioniAiAutomatiche ?? "—"} accent="var(--signal-amber)" />
        </Grid>
      </Grid>
    </Box>
  );
}
