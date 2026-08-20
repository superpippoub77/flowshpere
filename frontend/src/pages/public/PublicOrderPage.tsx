import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Box, Paper, Typography, Stack, TextField, Button, Alert, CircularProgress, Checkbox, FormControlLabel } from "@mui/material";

function apiBase(): string {
  let path = window.location.pathname;
  if (!path.endsWith("/")) path = path.substring(0, path.lastIndexOf("/") + 1);
  return `${path}api/`;
}

interface FieldDef {
  id: string;
  label: string;
  type: string;
}

export function PublicOrderPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [workflowName, setWorkflowName] = useState("");
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [values, setValues] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ code: string } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoadError("Link non valido: manca il token.");
      setLoading(false);
      return;
    }
    fetch(`${apiBase()}orders.php`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Impossibile caricare il modulo");
        setWorkflowName(data.workflowName);
        setFields(data.fields ?? []);
      })
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  function setValue(id: string, v: any) {
    setValues((s) => ({ ...s, [id]: v }));
  }

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`${apiBase()}orders.php`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ data: values }),
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

  function renderField(f: FieldDef) {
    if (f.type === "checkbox") {
      return (
        <FormControlLabel
          key={f.id}
          control={<Checkbox checked={!!values[f.id]} onChange={(e) => setValue(f.id, e.target.checked)} />}
          label={f.label}
        />
      );
    }
    return (
      <TextField
        key={f.id}
        label={f.label}
        fullWidth
        multiline={f.type === "textarea"}
        minRows={f.type === "textarea" ? 3 : undefined}
        type={f.type === "numero" || f.type === "valuta" ? "number" : f.type === "data" ? "date" : "text"}
        InputLabelProps={f.type === "data" ? { shrink: true } : undefined}
        value={values[f.id] ?? ""}
        onChange={(e) => setValue(f.id, e.target.value)}
      />
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", bgcolor: "background.default", p: 2 }}>
      <Paper sx={{ p: 4, maxWidth: 480, width: "100%" }}>
        <Typography variant="overline" color="primary">
          NUOVO ORDINE
        </Typography>

        {loading && (
          <Stack alignItems="center" sx={{ py: 4 }}>
            <CircularProgress size={28} />
          </Stack>
        )}

        {!loading && loadError && <Alert severity="error">{loadError}</Alert>}

        {!loading && !loadError && !result && (
          <>
            <Typography variant="h5" sx={{ mb: 2 }}>
              {workflowName}
            </Typography>
            <Stack spacing={2}>
              {fields.map(renderField)}
              {submitError && <Alert severity="error">{submitError}</Alert>}
              <Button
                variant="contained"
                size="large"
                disabled={submitting}
                onClick={submit}
                startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : undefined}
              >
                Invia ordine
              </Button>
            </Stack>
          </>
        )}

        {result && (
          <Alert severity="success" sx={{ mt: 2 }}>
            Ordine inviato correttamente — riferimento <strong>{result.code}</strong>.
          </Alert>
        )}
      </Paper>
    </Box>
  );
}
