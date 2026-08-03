import { useMemo, useState } from "react";
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
  IconButton,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import TimelineIcon from "@mui/icons-material/TimelineOutlined";
import dayjs from "dayjs";
import { api } from "../../api/client";
import { ClearableTextField } from "../../components/ClearableTextField";
import { StepDots, computeMainSequence, computeStepStatuses } from "./StepDots";
import { InstanceDrawer } from "./InstanceDrawer";

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

function InlineSteps({ item, onSelect }: { item: any; onSelect: (nodeId: string) => void }) {
  const nodes = useMemo(() => JSON.parse(item.nodesJson), [item.nodesJson]);
  const edges = useMemo(() => JSON.parse(item.edgesJson), [item.edgesJson]);
  const sequence = useMemo(() => computeMainSequence(nodes, edges), [nodes, edges]);
  const statuses = useMemo(
    () => computeStepStatuses(sequence, item.tasks, item.currentNodeId, item.status),
    [sequence, item]
  );
  const badges = useMemo(
    () =>
      sequence.map((n: any) => {
        const t = item.tasks.find((t: any) => t.nodeId === n.id);
        return { hasComment: !!t?.hasComment, hasAttachment: !!t?.hasAttachment };
      }),
    [sequence, item]
  );
  return <StepDots sequence={sequence} statuses={statuses} badges={badges} onSelect={(node) => onSelect(node.id)} />;
}

function whoseTurnLabel(item: any, companyUsers: any[]): string {
  if (!item.currentNodeId) return "—";
  const nodes = JSON.parse(item.nodesJson);
  const node = nodes.find((n: any) => n.id === item.currentNodeId);
  if (!node) return "—";
  const ids: string[] = node.data?.config?.responsibleUserIds ?? [];
  if (ids.length === 0) return "Tutti";
  if (ids.length === 1 && ids[0] === "AI") return "🤖 AI";
  return ids.map((id) => companyUsers.find((u) => u.id === id)?.fullName ?? id).join(", ");
}

export function InstanceListPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [workflowId, setWorkflowId] = useState("");
  const [drawerInstanceId, setDrawerInstanceId] = useState<string | null>(null);
  const [initialNodeId, setInitialNodeId] = useState<string | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ code: "", workflowId: "", status: "", anagrafica: "", dateFrom: "", dateTo: "", openClosed: "open" });

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

  const { data: companyUsers } = useQuery({
    queryKey: ["company-users"],
    queryFn: async () => (await api.get("/companies/users")).data,
  });

  const publishedWorkflows = (workflows ?? []).filter((w: any) => w.status === "PUBLISHED");
  const items = data?.items ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const createMutation = useMutation({
    mutationFn: async () => (await api.post("/instances", { workflowId })).data,
    onSuccess: (instance) => {
      queryClient.invalidateQueries({ queryKey: ["instances"] });
      setOpen(false);
      setInitialNodeId(null);
      setDrawerInstanceId(instance.id);
      setDrawerVisible(true);
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

      <ToggleButtonGroup
        size="small"
        exclusive
        value={filters.openClosed}
        onChange={(_, value) => value && updateFilter("openClosed", value)}
        sx={{ mb: 2 }}
      >
        <ToggleButton value="open">Aperti</ToggleButton>
        <ToggleButton value="closed">Chiusi</ToggleButton>
        <ToggleButton value="all">Tutti</ToggleButton>
      </ToggleButtonGroup>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={1.5}>
          <Grid item xs={6} sm={3} md={2}>
            <ClearableTextField label="N. ordine" size="small" fullWidth value={filters.code} onChange={(e) => updateFilter("code", e.target.value)} />
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <TextField select label="Workflow" size="small" fullWidth value={filters.workflowId} onChange={(e) => updateFilter("workflowId", e.target.value)}>
              <MenuItem value="">Tutti</MenuItem>
              {(workflows ?? []).map((w: any) => (
                <MenuItem key={w.id} value={w.id}>
                  {w.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <TextField select label="Stato" size="small" fullWidth value={filters.status} onChange={(e) => updateFilter("status", e.target.value)}>
              <MenuItem value="">Tutti</MenuItem>
              {STATUS_OPTIONS.map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <ClearableTextField
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
              <TableCell>Andamento</TableCell>
              <TableCell>Chi tocca</TableCell>
              <TableCell>Creata</TableCell>
              <TableCell align="right">Timeline</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((inst: any) => (
              <TableRow key={inst.id} hover>
                <TableCell className="mono">{inst.code}</TableCell>
                <TableCell>{inst.workflow?.name}</TableCell>
                <TableCell>
                  <Chip size="small" label={inst.status} color={STATUS_COLOR[inst.status]} />
                </TableCell>
                <TableCell sx={{ minWidth: 220 }}>
                  <InlineSteps
                    item={inst}
                    onSelect={(nodeId) => {
                      setDrawerVisible(false);
                      setInitialNodeId(nodeId);
                      setDrawerInstanceId(inst.id);
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{whoseTurnLabel(inst, companyUsers ?? [])}</Typography>
                </TableCell>
                <TableCell>{dayjs(inst.createdAt).format("DD/MM/YYYY HH:mm")}</TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    onClick={() => {
                      setInitialNodeId(null);
                      setDrawerInstanceId(inst.id);
                      setDrawerVisible(true);
                    }}
                  >
                    <TimelineIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
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
          <TextField select label="Workflow pubblicato" fullWidth sx={{ mt: 1 }} value={workflowId} onChange={(e) => setWorkflowId(e.target.value)}>
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

      <InstanceDrawer
        instanceId={drawerInstanceId}
        initialNodeId={initialNodeId}
        drawerVisible={drawerVisible}
        onClose={() => {
          setDrawerInstanceId(null);
          setInitialNodeId(null);
          setDrawerVisible(false);
        }}
      />
    </Box>
  );
}
