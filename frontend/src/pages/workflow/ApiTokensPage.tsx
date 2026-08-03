import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Stack,
  Typography,
  Button,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  IconButton,
  Alert,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ContentCopyIcon from "@mui/icons-material/ContentCopyOutlined";
import { api } from "../../api/client";

export function ApiTokensPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [workflowId, setWorkflowId] = useState("");
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [copyLabel, setCopyLabel] = useState("Copia");

  const { data: tokens } = useQuery({
    queryKey: ["api-tokens"],
    queryFn: async () => (await api.get("/api-tokens")).data,
  });

  const { data: workflows } = useQuery({
    queryKey: ["workflows"],
    queryFn: async () => (await api.get("/workflows")).data,
  });

  const createMutation = useMutation({
    mutationFn: async () => (await api.post("/api-tokens", { label, workflowId: workflowId || undefined })).data,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["api-tokens"] });
      setIssuedToken(result.token);
      setLabel("");
      setWorkflowId("");
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/api-tokens/${id}/revoke`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["api-tokens"] }),
  });

  function closeDialog() {
    setOpen(false);
    setIssuedToken(null);
    setCopyLabel("Copia");
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Stack spacing={0.3}>
          <Typography variant="overline" color="primary">
            INTEGRAZIONI ESTERNE
          </Typography>
          <Typography variant="h5">Token API</Typography>
          <Typography variant="body2" color="text.secondary">
            Usati da sistemi esterni per inviare ordini direttamente a un workflow, senza login.
          </Typography>
        </Stack>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
          Nuovo token
        </Button>
      </Stack>

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Etichetta</TableCell>
              <TableCell>Workflow</TableCell>
              <TableCell>Creato</TableCell>
              <TableCell>Stato</TableCell>
              <TableCell align="right">Azioni</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(tokens ?? []).map((t: any) => (
              <TableRow key={t.id} hover>
                <TableCell>{t.label}</TableCell>
                <TableCell>{t.workflowName ?? <Typography variant="caption" color="text.secondary">Qualsiasi workflow</Typography>}</TableCell>
                <TableCell className="mono">{t.createdAt}</TableCell>
                <TableCell>
                  <Chip size="small" label={t.revoked ? "Revocato" : "Attivo"} color={t.revoked ? "default" : "success"} />
                </TableCell>
                <TableCell align="right">
                  {!t.revoked && (
                    <IconButton size="small" onClick={() => revokeMutation.mutate(t.id)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(tokens ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    Nessun token creato.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>Nuovo token API</DialogTitle>
        <DialogContent>
          {!issuedToken && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Etichetta" placeholder="es. Integrazione e-commerce" value={label} onChange={(e) => setLabel(e.target.value)} fullWidth autoFocus />
              <TextField select label="Vincola a un workflow (opzionale)" value={workflowId} onChange={(e) => setWorkflowId(e.target.value)} fullWidth>
                <MenuItem value="">Qualsiasi workflow (specificato in ogni chiamata)</MenuItem>
                {(workflows ?? []).filter((w: any) => w.status === "PUBLISHED").map((w: any) => (
                  <MenuItem key={w.id} value={w.id}>
                    {w.name}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          )}

          {issuedToken && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Alert severity="warning">
                Copia il token ora: non verra' piu' mostrato per intero in seguito.
              </Alert>
              <TextField value={issuedToken} fullWidth multiline minRows={3} InputProps={{ readOnly: true, sx: { fontFamily: "monospace", fontSize: 12 } }} />
              <Button
                startIcon={<ContentCopyIcon />}
                onClick={() => {
                  navigator.clipboard.writeText(issuedToken);
                  setCopyLabel("Copiato!");
                }}
              >
                {copyLabel}
              </Button>
              <Typography variant="body2" color="text.secondary">
                Esempio di chiamata:
              </Typography>
              <Box component="pre" sx={{ fontSize: 11.5, p: 1.5, background: "rgba(127,184,217,0.08)", borderRadius: 1, overflowX: "auto" }}>
{`POST ${window.location.origin}${window.location.pathname.replace(/#.*/, "")}api/orders.php
Authorization: Bearer ${issuedToken.slice(0, 24)}...
Content-Type: application/json

{ "data": { "cliente": "ACME", "importo": 500 } }`}
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          {!issuedToken && (
            <>
              <Button onClick={closeDialog}>Annulla</Button>
              <Button variant="contained" disabled={!label || createMutation.isPending} onClick={() => createMutation.mutate()}>
                Crea
              </Button>
            </>
          )}
          {issuedToken && <Button onClick={closeDialog}>Chiudi</Button>}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
