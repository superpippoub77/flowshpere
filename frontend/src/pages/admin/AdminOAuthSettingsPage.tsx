import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Stack, Typography, Paper, Switch, FormControlLabel, Button, Alert, CircularProgress } from "@mui/material";
import { api } from "../../api/client";
import { ClearableTextField } from "../../components/ClearableTextField";
import { PasswordField } from "../../components/PasswordField";

function ProviderPanel({ provider, label, redirectHint }: { provider: "google" | "facebook"; label: string; redirectHint: string }) {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["oauth-config"],
    queryFn: async () => (await api.get("/admin/oauth-config")).data,
  });

  const [enabled, setEnabled] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [hasSecret, setHasSecret] = useState(false);

  useEffect(() => {
    const cfg = data?.[provider];
    if (!cfg) return;
    setEnabled(!!cfg.enabled);
    setClientId(cfg.clientId ?? "");
    setHasSecret(!!cfg.hasSecret);
  }, [data, provider]);

  const saveMutation = useMutation({
    mutationFn: async () =>
      api.post("/admin/oauth-config", { provider, enabled, clientId, clientSecret: clientSecret || undefined }),
    onSuccess: () => {
      if (clientSecret) setHasSecret(true);
      setClientSecret("");
      queryClient.invalidateQueries({ queryKey: ["oauth-config"] });
    },
  });

  const redirectUri = `${window.location.origin}${window.location.pathname.replace(/#.*/, "")}api/oauth.php`;

  return (
    <Paper sx={{ p: 3, mb: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="subtitle1">{label}</Typography>
        <FormControlLabel control={<Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />} label={enabled ? "Attivo" : "Disattivo"} />
      </Stack>
      <Stack spacing={2}>
        <ClearableTextField label="Client ID" value={clientId} onChange={(e) => setClientId(e.target.value)} fullWidth />
        <PasswordField
          label={hasSecret ? "Client secret (già impostato — lascia vuoto per non cambiarlo)" : "Client secret"}
          value={clientSecret}
          onChange={(e) => setClientSecret(e.target.value)}
          fullWidth
        />
        <Alert severity="info" sx={{ fontSize: 13 }}>
          URI di reindirizzamento da registrare su {redirectHint}: <code>{redirectUri}</code>
        </Alert>
        <Button
          variant="contained"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          startIcon={saveMutation.isPending ? <CircularProgress size={14} color="inherit" /> : undefined}
          sx={{ alignSelf: "flex-start" }}
        >
          Salva
        </Button>
        {saveMutation.isSuccess && <Alert severity="success">Configurazione salvata.</Alert>}
      </Stack>
    </Paper>
  );
}

export function AdminOAuthSettingsPage() {
  return (
    <Box sx={{ p: 3, maxWidth: 640 }}>
      <Stack spacing={0.3} sx={{ mb: 3 }}>
        <Typography variant="overline" color="primary">
          AMMINISTRAZIONE
        </Typography>
        <Typography variant="h5">Accesso con Google / Facebook</Typography>
        <Typography variant="body2" color="text.secondary">
          Per funzionare davvero serve un'app OAuth registrata presso il provider (Google Cloud Console o Meta for
          Developers), da cui ricavare Client ID e Client Secret. Finché non è configurato, il pulsante di accesso
          semplicemente non compare nella schermata di login.
        </Typography>
      </Stack>

      <ProviderPanel provider="google" label="Google" redirectHint="Google Cloud Console (Credenziali OAuth 2.0)" />
      <ProviderPanel provider="facebook" label="Facebook" redirectHint="Meta for Developers (Facebook Login)" />
    </Box>
  );
}
