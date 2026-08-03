import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/EditOutlined";
import { api } from "../../api/client";
import { useAuthStore } from "../../store/authStore";
import { ClearableTextField } from "../../components/ClearableTextField";

const STATUS_LABEL: Record<string, { label: string; color: any }> = {
  DRAFT: { label: "Bozza", color: "default" },
  PUBLISHED: { label: "Pubblicato", color: "success" },
  ARCHIVED: { label: "Archiviato", color: "default" },
};

export function WorkflowListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [openCreate, setOpenCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const companies = useAuthStore((s) => s.companies);
  const currentCompanyId = useAuthStore((s) => s.currentCompanyId);
  const setCurrentCompany = useAuthStore((s) => s.setCurrentCompany);
  const [targetCompanyId, setTargetCompanyId] = useState(currentCompanyId ?? "");
  const user = useAuthStore((s) => s.user);
  const [companyEditTarget, setCompanyEditTarget] = useState<{ id: string; companyId: string } | null>(null);
  const [newCompanyId, setNewCompanyId] = useState("");

  const { data: workflows } = useQuery({
    queryKey: ["workflows"],
    queryFn: async () => (await api.get("/workflows")).data,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const startNode = { id: "n1", type: "start", position: { x: 250, y: 60 }, data: { label: "Inizio Processo" } };
      const res = await api.post("/workflows", { name, description, nodes: [startNode], edges: [], companyId: targetCompanyId });
      return res.data;
    },
    onSuccess: (workflow) => {
      if (targetCompanyId && targetCompanyId !== currentCompanyId) setCurrentCompany(targetCompanyId);
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      setOpenCreate(false);
      setName("");
      setDescription("");
      navigate(`/workflow/designer/${workflow.id}`);
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/workflows/${id}/publish`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workflows"] }),
  });

  const updateCompanyMutation = useMutation({
    mutationFn: async () => api.post(`/workflows/${companyEditTarget!.id}/company`, { newCompanyId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      setCompanyEditTarget(null);
    },
  });

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Stack spacing={0.3}>
          <Typography variant="overline" color="primary">
            DESIGNER
          </Typography>
          <Typography variant="h5">I tuoi workflow</Typography>
        </Stack>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenCreate(true)}>
          Nuovo workflow
        </Button>
      </Stack>

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nome</TableCell>
              <TableCell>Azienda</TableCell>
              <TableCell>Stato</TableCell>
              <TableCell>Versione</TableCell>
              <TableCell>Istanze</TableCell>
              <TableCell align="right">Azioni</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(workflows ?? []).map((w: any) => (
              <TableRow key={w.id} hover>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {w.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {w.description}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Typography variant="body2">{w.companyName ?? "—"}</Typography>
                    {user?.isSuperAdmin && (
                      <IconButton
                        size="small"
                        onClick={() => {
                          setCompanyEditTarget({ id: w.id, companyId: w.companyId });
                          setNewCompanyId(w.companyId);
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Stack>
                </TableCell>
                <TableCell>
                  <Chip size="small" label={STATUS_LABEL[w.status]?.label ?? w.status} color={STATUS_LABEL[w.status]?.color} />
                </TableCell>
                <TableCell className="mono">v{w.latestVersion ?? 1}</TableCell>
                <TableCell className="mono">{w.instanceCount}</TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => navigate(`/workflow/designer/${w.id}`)}>
                    Apri designer
                  </Button>
                  {w.status !== "PUBLISHED" && (
                    <Button size="small" color="secondary" onClick={() => publishMutation.mutate(w.id)}>
                      Pubblica
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(workflows ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    Nessun workflow ancora creato.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={openCreate} onClose={() => setOpenCreate(false)} fullWidth maxWidth="xs">
        <DialogTitle>Nuovo workflow</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {companies.length > 1 && (
              <TextField select label="Azienda" value={targetCompanyId} onChange={(e) => setTargetCompanyId(e.target.value)} fullWidth>
                {companies.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </TextField>
            )}
            <ClearableTextField label="Nome" value={name} onChange={(e) => setName(e.target.value)} fullWidth autoFocus />
            <ClearableTextField
              label="Descrizione"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreate(false)}>Annulla</Button>
          <Button variant="contained" disabled={!name || createMutation.isPending} onClick={() => createMutation.mutate()}>
            Crea e apri designer
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!companyEditTarget} onClose={() => setCompanyEditTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Azienda del workflow</DialogTitle>
        <DialogContent>
          <TextField
            select
            label="Azienda"
            value={newCompanyId}
            onChange={(e) => setNewCompanyId(e.target.value)}
            required
            fullWidth
            sx={{ mt: 1 }}
          >
            {companies.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCompanyEditTarget(null)}>Annulla</Button>
          <Button variant="contained" disabled={!newCompanyId || updateCompanyMutation.isPending} onClick={() => updateCompanyMutation.mutate()}>
            Salva
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
