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
  ToggleButtonGroup,
  ToggleButton,
  CircularProgress,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ContentCopyIcon from "@mui/icons-material/ContentCopyOutlined";
import { api } from "../../api/client";
import { ClearableTextField } from "../../components/ClearableTextField";

function publicLink(scope: string, token: string): string {
  const base = `${window.location.origin}${window.location.pathname.replace(/#.*/, "")}`;
  return `${base}#/public/${scope === "ticket" ? "ticket" : "order"}?token=${encodeURIComponent(token)}`;
}

export function ApiTokensPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [scope, setScope] = useState<"order" | "ticket">("order");
  const [workflowId, setWorkflowId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [issued, setIssued] = useState<{ token: string; scope: string } | null>(null);
  const [copyLabel, setCopyLabel] = useState("Copia token");
  const [copyLinkLabel, setCopyLinkLabel] = useState("Copia link modulo");

  const { data: tokens } = useQuery({
    queryKey: ["api-tokens"],
    queryFn: async () => (await api.get("/api-tokens")).data,
  });

  const { data: workflows } = useQuery({
    queryKey: ["workflows"],
    queryFn: async () => (await api.get("/workflows")).data,
  });

  const { data: categories } = useQuery({
    queryKey: ["ticket-categories"],
    queryFn: async () => (await api.get("/ticket-categories")).data,
  });

  const createMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post("/api-tokens", {
          label,
          scope,
          workflowId: scope === "order" ? workflowId || undefined : undefined,
          categoryId: scope === "ticket" ? categoryId || undefined : undefined,
        })
      ).data,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["api-tokens"] });
      setIssued({ token: result.token, scope });
      setLabel("");
      setWorkflowId("");
      setCategoryId("");
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/api-tokens/${id}/revoke`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["api-tokens"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/api-tokens/${id}/delete`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["api-tokens"] }),
  });

  function closeDialog() {
    setOpen(false);
    setIssued(null);
    setCopyLabel("Copia token");
    setCopyLinkLabel("Copia link modulo");
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
            Usati da sistemi esterni (o da un modulo web pubblico) per inviare ordini o aprire ticket senza login.
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
              <TableCell>Tipo</TableCell>
              <TableCell>Vincolato a</TableCell>
              <TableCell>Creato</TableCell>
              <TableCell>Stato</TableCell>
              <TableCell align="right">Azioni</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(tokens ?? []).map((t: any) => (
              <TableRow key={t.id} hover>
                <TableCell>{t.label}</TableCell>
                <TableCell>
                  <Chip size="small" label={t.scope === "ticket" ? "Ticket" : "Ordine"} />
                </TableCell>
                <TableCell>
                  {t.workflowName ?? t.categoryName ?? (
                    <Typography variant="caption" color="text.secondary">
                      {t.scope === "ticket" ? "Qualsiasi ramo" : "Qualsiasi workflow"}
                    </Typography>
                  )}
                </TableCell>
                <TableCell className="mono">{t.createdAt}</TableCell>
                <TableCell>
                  <Chip size="small" label={t.revoked ? "Revocato" : "Attivo"} color={t.revoked ? "default" : "success"} />
                </TableCell>
                <TableCell align="right">
                  {!t.revoked && (
                    <Button size="small" onClick={() => revokeMutation.mutate(t.id)}>
                      Disattiva
                    </Button>
                  )}
                  <IconButton
                    size="small"
                    onClick={() => {
                      if (window.confirm(`Eliminare definitivamente il token "${t.label}"? L'operazione non e' reversibile.`)) {
                        deleteMutation.mutate(t.id);
                      }
                    }}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {(tokens ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
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
          {!issued && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <ToggleButtonGroup exclusive size="small" value={scope} onChange={(_, v) => v && setScope(v)}>
                <ToggleButton value="order">Per ordini (Workflow)</ToggleButton>
                <ToggleButton value="ticket">Per ticket</ToggleButton>
              </ToggleButtonGroup>

              <ClearableTextField label="Etichetta" placeholder="es. Portale clienti" value={label} onChange={(e) => setLabel(e.target.value)} fullWidth autoFocus />

              {scope === "order" && (
                <TextField select label="Vincola a un workflow (opzionale)" value={workflowId} onChange={(e) => setWorkflowId(e.target.value)} fullWidth>
                  <MenuItem value="">Qualsiasi workflow (specificato in ogni chiamata)</MenuItem>
                  {(workflows ?? [])
                    .filter((w: any) => w.status === "PUBLISHED")
                    .map((w: any) => (
                      <MenuItem key={w.id} value={w.id}>
                        {w.name}
                      </MenuItem>
                    ))}
                </TextField>
              )}

              {scope === "ticket" && (
                <TextField select label="Vincola a un ramo (opzionale)" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} fullWidth>
                  <MenuItem value="">Qualsiasi ramo</MenuItem>
                  {(categories ?? []).map((c: any) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            </Stack>
          )}

          {issued && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Alert severity="warning">Copia il token ora: non verrà più mostrato per intero in seguito.</Alert>
              <TextField value={issued.token} fullWidth multiline minRows={3} InputProps={{ readOnly: true, sx: { fontFamily: "monospace", fontSize: 12 } }} />
              <Button
                startIcon={<ContentCopyIcon />}
                onClick={() => {
                  navigator.clipboard.writeText(issued.token);
                  setCopyLabel("Copiato!");
                }}
              >
                {copyLabel}
              </Button>

              <Typography variant="body2" color="text.secondary">
                Modulo web pronto da condividere (nessun account richiesto per chi lo compila):
              </Typography>
              <TextField
                value={publicLink(issued.scope, issued.token)}
                fullWidth
                InputProps={{ readOnly: true, sx: { fontFamily: "monospace", fontSize: 12 } }}
              />
              <Button
                startIcon={<ContentCopyIcon />}
                onClick={() => {
                  navigator.clipboard.writeText(publicLink(issued.scope, issued.token));
                  setCopyLinkLabel("Copiato!");
                }}
              >
                {copyLinkLabel}
              </Button>

              <Typography variant="body2" color="text.secondary">
                In alternativa, chiamata diretta via API:
              </Typography>
              <Box component="pre" sx={{ fontSize: 11.5, p: 1.5, background: "rgba(127,184,217,0.08)", borderRadius: 1, overflowX: "auto" }}>
{issued.scope === "ticket"
  ? `POST ${window.location.origin}${window.location.pathname.replace(/#.*/, "")}api/tickets_submit.php
Authorization: Bearer ${issued.token.slice(0, 24)}...
Content-Type: application/json

{ "subject": "Non riesco ad accedere", "description": "...", "customerName": "Mario Rossi", "customerEmail": "mario@test.it" }`
  : `POST ${window.location.origin}${window.location.pathname.replace(/#.*/, "")}api/orders.php
Authorization: Bearer ${issued.token.slice(0, 24)}...
Content-Type: application/json

{ "data": { "cliente": "ACME", "importo": 500 } }`}
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          {!issued && (
            <>
              <Button onClick={closeDialog}>Annulla</Button>
              <Button
                variant="contained"
                disabled={!label || createMutation.isPending}
                onClick={() => createMutation.mutate()}
                startIcon={createMutation.isPending ? <CircularProgress size={14} color="inherit" /> : undefined}
              >
                Crea
              </Button>
            </>
          )}
          {issued && <Button onClick={closeDialog}>Chiudi</Button>}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
