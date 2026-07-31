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
  MenuItem,
  TextField,
  Pagination,
  Grid,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import dayjs from "dayjs";
import { api } from "../../api/client";

const STATUS_COLOR: Record<string, any> = {
  BOZZA: "default",
  IN_CORSO: "info",
  IN_ATTESA: "warning",
  APPROVATO: "success",
  RIFIUTATO: "error",
  COMPLETATO: "success",
  ANNULLATO: "default",
};

const STATUS_OPTIONS = ["BOZZA", "IN_CORSO", "IN_ATTESA", "APPROVATO", "RIFIUTATO", "COMPLETATO", "ANNULLATO"];

export function InstanceListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [workflowId, setWorkflowId] = useState("");

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ code: "", workflowId: "", status: "", anagrafica: "", dateFrom: "", dateTo: "" });

  function updateFilter(key: string, value: string) {
    setPage(1);
    setFilters((f) => ({ ...f, [key]: value }));
  }

  const { data } = useQuery({
    queryKey: ["instances", page, filters],
    queryFn: async () => (await api.get("/instances", { page, ...filters })).data,
  });

  const { data: workflows } = useQuery({
    queryKey: ["workflows"],
    queryFn: async () => (await api.get("/workflows")).data,
  });

  const publishedWorkflows = (workflows ?? []).filter((w: any) => w.status === "PUBLISHED");
  const items = data?.items ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const createMutation = useMutation({
    mutationFn: async () => (await api.post("/instances", { workflowId })).data,
    onSuccess: (instance) => {
      queryClient.invalidateQueries({ queryKey: ["instances"] });
      setOpen(false);
      navigate(`/workflow/instances/${instance.id}`);
    },
  });

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Stack spacing={0.3}>
          <Typography variant="overline" color="primary">
            RUNTIME
          </Typography>
          <Typography variant="h5">Istanze workflow</Typography>
        </Stack>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
          Nuova istanza
        </Button>
      </Stack>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={1.5}>
          <Grid item xs={6} sm={3} md={2}>
            <TextField
              label="N. ordine"
              size="small"
              fullWidth
              value={filters.code}
              onChange={(e) => updateFilter("code", e.target.value)}
            />
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <TextField
              select
              label="Workflow"
              size="small"
              fullWidth
              value={filters.workflowId}
              onChange={(e) => updateFilter("workflowId", e.target.value)}
            >
              <MenuItem value="">Tutti</MenuItem>
              {(workflows ?? []).map((w: any) => (
                <MenuItem key={w.id} value={w.id}>
                  {w.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <TextField
              select
              label="Stato"
              size="small"
              fullWidth
              value={filters.status}
              onChange={(e) => updateFilter("status", e.target.value)}
            >
              <MenuItem value="">Tutti</MenuItem>
              {STATUS_OPTIONS.map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <TextField
              label="Anagrafica"
              size="small"
              fullWidth
              placeholder="es. nome cliente"
              value={filters.anagrafica}
              onChange={(e) => updateFilter("anagrafica", e.target.value)}
            />
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <TextField
              label="Dal"
              type="date"
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={filters.dateFrom}
              onChange={(e) => updateFilter("dateFrom", e.target.value)}
            />
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <TextField
              label="Al"
              type="date"
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={filters.dateTo}
              onChange={(e) => updateFilter("dateTo", e.target.value)}
            />
          </Grid>
        </Grid>
      </Paper>

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Codice</TableCell>
              <TableCell>Workflow</TableCell>
              <TableCell>Stato</TableCell>
              <TableCell>Creata</TableCell>
              <TableCell>Aggiornata</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((inst: any) => (
              <TableRow key={inst.id} hover sx={{ cursor: "pointer" }} onClick={() => navigate(`/workflow/instances/${inst.id}`)}>
                <TableCell className="mono">{inst.code}</TableCell>
                <TableCell>{inst.workflow?.name}</TableCell>
                <TableCell>
                  <Chip size="small" label={inst.status} color={STATUS_COLOR[inst.status]} />
                </TableCell>
                <TableCell>{dayjs(inst.createdAt).format("DD/MM/YYYY HH:mm")}</TableCell>
                <TableCell>{dayjs(inst.updatedAt).format("DD/MM/YYYY HH:mm")}</TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    Nessuna istanza trovata con questi filtri.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      {totalPages > 1 && (
        <Stack alignItems="center" sx={{ mt: 2 }}>
          <Pagination count={totalPages} page={page} onChange={(_, p) => setPage(p)} color="primary" />
        </Stack>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Nuova istanza</DialogTitle>
        <DialogContent>
          <TextField
            select
            label="Workflow pubblicato"
            fullWidth
            sx={{ mt: 1 }}
            value={workflowId}
            onChange={(e) => setWorkflowId(e.target.value)}
          >
            {publishedWorkflows.map((w: any) => (
              <MenuItem key={w.id} value={w.id}>
                {w.name}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Annulla</Button>
          <Button variant="contained" disabled={!workflowId || createMutation.isPending} onClick={() => createMutation.mutate()}>
            Avvia
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
