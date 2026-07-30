import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Paper, TextField, Button, Typography, Alert, Stack } from "@mui/material";
import { api } from "../api/client";
import { useAuthStore } from "../store/authStore";

export function LoginPage() {
  const [email, setEmail] = useState("admin@demo.it");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { email, password });
      setSession(res.data.token, res.data.user);
      navigate("/apps");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Accesso non riuscito");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background:
          "radial-gradient(circle at 20% 20%, rgba(127,184,217,0.12), transparent 45%), var(--ink-navy)",
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
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              required
            />
            <TextField
              label="Password"
              type="password"
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

        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 3 }}>
          Demo: admin@demo.it · supervisore@demo.it · operatore@demo.it — password: password123
        </Typography>
      </Paper>
    </Box>
  );
}
