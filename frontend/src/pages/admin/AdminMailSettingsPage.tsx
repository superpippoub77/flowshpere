import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Box, Stack, Typography, Paper, TextField, MenuItem, Button, Alert, CircularProgress } from "@mui/material";
import { api } from "../../api/client";
import { ClearableTextField } from "../../components/ClearableTextField";
import { PasswordField } from "../../components/PasswordField";

export function AdminMailSettingsPage() {
  const [host, setHost] = useState("");
  const [port, setPort] = useState("587");
  const [encryption, setEncryption] = useState("tls");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [hasPassword, setHasPassword] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const { data } = useQuery({
    queryKey: ["mail-config"],
    queryFn: async () => (await api.get("/admin/mail-config")).data,
  });

  useEffect(() => {
    if (!data) return;
    setHost(data.host ?? "");
    setPort(String(data.port ?? 587));
    setEncryption(data.encryption ?? "tls");
    setUsername(data.username ?? "");
    setFromEmail(data.fromEmail ?? "");
    setFromName(data.fromName ?? "");
    setHasPassword(!!data.hasPassword);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () =>
      api.post("/admin/mail-config", {
        host,
        port: Number(port),
        encryption,
        username,
        password: password || undefined,
        fromEmail,
        fromName,
      }),
    onSuccess: () => {
      if (password) setHasPassword(true);
      setPassword("");
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => api.post("/admin/mail-config/test", { toEmail: testEmail }),
    onSuccess: () => setTestResult({ ok: true, message: "Email di prova inviata correttamente." }),
    onError: (err: any) => setTestResult({ ok: false, message: err?.response?.data?.error || "Invio fallito." }),
  });

  return (
    <Box sx={{ p: 3, maxWidth: 640 }}>
      <Stack spacing={0.3} sx={{ mb: 3 }}>
        <Typography variant="overline" color="primary">
          AMMINISTRAZIONE
        </Typography>
        <Typography variant="h5">Configurazione email (SMTP)</Typography>
        <Typography variant="body2" color="text.secondary">
          Se non configuri nulla, le email restano simulate (solo registrate) come prima — nessun invio reale.
        </Typography>
      </Stack>

      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <ClearableTextField label="Host SMTP" placeholder="es. smtp.aruba.it" value={host} onChange={(e) => setHost(e.target.value)} fullWidth />
          <Stack direction="row" spacing={2}>
            <TextField label="Porta" type="number" value={port} onChange={(e) => setPort(e.target.value)} sx={{ width: 140 }} />
            <TextField select label="Cifratura" value={encryption} onChange={(e) => setEncryption(e.target.value)} fullWidth>
              <MenuItem value="tls">STARTTLS (consigliata, porta 587)</MenuItem>
              <MenuItem value="ssl">SSL/TLS implicito (porta 465)</MenuItem>
              <MenuItem value="none">Nessuna (sconsigliata)</MenuItem>
            </TextField>
          </Stack>
          <ClearableTextField label="Nome utente SMTP" value={username} onChange={(e) => setUsername(e.target.value)} fullWidth />
          <PasswordField
            label={hasPassword ? "Password (già impostata — lascia vuoto per non cambiarla)" : "Password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
          />
          <ClearableTextField label="Email mittente" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} fullWidth />
          <ClearableTextField label="Nome mittente" value={fromName} onChange={(e) => setFromName(e.target.value)} fullWidth />

          <Button
            variant="contained"
            onClick={() => saveMutation.mutate()}
            disabled={!host || saveMutation.isPending}
            startIcon={saveMutation.isPending ? <CircularProgress size={14} color="inherit" /> : undefined}
            sx={{ alignSelf: "flex-start" }}
          >
            Salva configurazione
          </Button>
          {saveMutation.isSuccess && <Alert severity="success">Configurazione salvata.</Alert>}
        </Stack>
      </Paper>

      <Paper sx={{ p: 3, mt: 2 }}>
        <Typography variant="subtitle1" sx={{ mb: 2 }}>
          Invia un'email di prova
        </Typography>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          <ClearableTextField label="Indirizzo di destinazione" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} fullWidth />
          <Button
            variant="outlined"
            onClick={() => {
              setTestResult(null);
              testMutation.mutate();
            }}
            disabled={!testEmail || testMutation.isPending}
            startIcon={testMutation.isPending ? <CircularProgress size={14} /> : undefined}
            sx={{ flexShrink: 0, mt: 0.3 }}
          >
            Invia prova
          </Button>
        </Stack>
        {testResult && (
          <Alert severity={testResult.ok ? "success" : "error"} sx={{ mt: 2 }}>
            {testResult.message}
          </Alert>
        )}
      </Paper>
    </Box>
  );
}
