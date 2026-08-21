import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Box, Paper, TextField, Button, Typography, Alert, Stack, Divider } from "@mui/material";
import { PasswordField } from "../components/PasswordField";
import { ClearableTextField } from "../components/ClearableTextField";
import { api } from "../api/client";
import { useAuthStore } from "../store/authStore";

function apiBase(): string {
  let path = window.location.pathname;
  if (!path.endsWith("/")) path = path.substring(0, path.lastIndexOf("/") + 1);
  return `${path}api/`;
}

export function LoginPage() {
  const [email, setEmail] = useState("admin@demo.it");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthProviders, setOauthProviders] = useState<Record<string, { clientId: string }>>({});
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("oauth_error")) {
      setError("Accesso con il provider esterno non riuscito. Riprova o usa email e password.");
    }
    api
      .get("/auth/oauth-providers")
      .then((res) => setOauthProviders(res.data))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { email, password });
      setSession(res.data.token, res.data.user);
      navigate("/workflow/dashboard");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Accesso non riuscito");
    } finally {
      setLoading(false);
    }
  }

  const hasOAuth = Object.keys(oauthProviders).length > 0;

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background:
          "radial-gradient(circle at 20% 20%, rgba(127,184,217,0.12), transparent 45%)",
        bgcolor: "background.default",
        px: 2,
      }}
    >
      <Paper elevation={0} sx={{ width: 400, p: 4, borderRadius: 2 }}>
        <Stack spacing={0.5} sx={{ mb: 3 }}>
          <Typography variant="overline" color="primary">
            PIATTAFORMA AZIENDALE
          </Typography>
          <Typography variant="h4">Workflow Hub</Typography>
          <Typography variant="body2" color="text.secondary">
            Accedi con le tue credenziali per continuare.
          </Typography>
        </Stack>

        <form onSubmit={handleSubmit}>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            <ClearableTextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              required
            />
            <PasswordField
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              required
            />
            <Button type="submit" variant="contained" size="large" disabled={loading} fullWidth>
              {loading ? "Accesso in corso..." : "Accedi"}
            </Button>
          </Stack>
        </form>

        {hasOAuth && (
          <>
            <Divider sx={{ my: 2.5 }}>oppure</Divider>
            <Stack spacing={1.5}>
              {oauthProviders.google && (
                <Button variant="outlined" fullWidth onClick={() => (window.location.href = `${apiBase()}oauth.php?action=start&provider=google`)}>
                  Accedi con Google
                </Button>
              )}
              {oauthProviders.facebook && (
                <Button variant="outlined" fullWidth onClick={() => (window.location.href = `${apiBase()}oauth.php?action=start&provider=facebook`)}>
                  Accedi con Facebook
                </Button>
              )}
            </Stack>
          </>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 3 }}>
          Demo: superadmin@platform.it (Super Amministratore) · admin@demo.it · supervisore@demo.it · operatore@demo.it — password: password123
        </Typography>
      </Paper>
    </Box>
  );
}
