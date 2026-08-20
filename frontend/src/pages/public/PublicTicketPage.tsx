import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Box, Paper, Typography, Stack, TextField, Button, Alert, CircularProgress, MenuItem } from "@mui/material";

function apiBase(): string {
  let path = window.location.pathname;
  if (!path.endsWith("/")) path = path.substring(0, path.lastIndexOf("/") + 1);
  return `${path}api/`;
}

const PRIORITIES = [
  { value: "BASSA", label: "Bassa" },
  { value: "MEDIA", label: "Media" },
  { value: "ALTA", label: "Alta" },
  { value: "URGENTE", label: "Urgente" },
];

export function PublicTicketPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIA");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ code: string } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`${apiBase()}tickets_submit.php`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ subject, description, priority, customerName, customerEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Invio non riuscito");
      setResult({ code: data.code });
    } catch (e: any) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", bgcolor: "background.default", p: 2 }}>
      <Paper sx={{ p: 4, maxWidth: 480, width: "100%" }}>
        <Typography variant="overline" color="primary">
          APRI UN TICKET
        </Typography>

        {!token && (
          <Alert severity="error" sx={{ mt: 2 }}>
            Link non valido: manca il token.
          </Alert>
        )}

        {token && !result && (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Oggetto" value={subject} onChange={(e) => setSubject(e.target.value)} fullWidth autoFocus />
            <TextField label="Descrizione" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth multiline minRows={4} />
            <TextField select label="Priorità" value={priority} onChange={(e) => setPriority(e.target.value)} fullWidth>
              {PRIORITIES.map((p) => (
                <MenuItem key={p.value} value={p.value}>
                  {p.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField label="Il tuo nome" value={customerName} onChange={(e) => setCustomerName(e.target.value)} fullWidth />
            <TextField label="La tua email" type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} fullWidth />
            {submitError && <Alert severity="error">{submitError}</Alert>}
            <Button
              variant="contained"
              size="large"
              disabled={!subject || submitting}
              onClick={submit}
              startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              Invia ticket
            </Button>
          </Stack>
        )}

        {result && (
          <Alert severity="success" sx={{ mt: 2 }}>
            Ticket aperto correttamente — riferimento <strong>{result.code}</strong>. Ti risponderemo al più presto.
          </Alert>
        )}
      </Paper>
    </Box>
  );
}
