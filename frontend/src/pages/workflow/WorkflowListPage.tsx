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
  CircularProgress,
  TableSortLabel,
  Pagination,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/EditOutlined";
import { api } from "../../api/client";
import { useAuthStore } from "../../store/authStore";
import { ClearableTextField } from "../../components/ClearableTextField";
import { useI18n } from "../../i18n";
import { CompanySelector } from "../../components/CompanySelector";
import { useSort } from "../../hooks/useSort";

const STATUS_LABEL: Record<string, { label: string; color: any }> = {
  DRAFT: { label: "Bozza", color: "default" },
  PUBLISHED: { label: "Pubblicato", color: "success" },
  ARCHIVED: { label: "Archiviato", color: "default" },
};

export function WorkflowListPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [openCreate, setOpenCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const companies = useAuthStore((s) => s.companies);
  const getCurrentCompanyForApp = useAuthStore((s) => s.getCurrentCompanyForApp);
  const setCurrentCompanyForApp = useAuthStore((s) => s.setCurrentCompanyForApp);
  const currentCompanyId = getCurrentCompanyForApp("workflow");
  const [targetCompanyId, setTargetCompanyId] = useState(currentCompanyId ?? "");
  const user = useAuthStore((s) => s.user);
  const [companyEditTarget, setCompanyEditTarget] = useState<{ id: string; companyId: string } | null>(null);
  const [newCompanyId, setNewCompanyId] = useState("");
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ name: "", status: "" });

  function updateFilter(key: string, value: string) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }
  function clearFilters() {
    setFilters({ name: "", status: "" });
    setPage(1);
  }
  const hasActiveFilters = Object.values(filters).some((v) => v);

  const { data: workflowsPage } = useQuery({
    queryKey: ["workflows-table", filters, page],
    queryFn: async () => (await api.get("/workflows/table", { ...filters, page })).data,
    refetchInterval: 15000,
  });
  const workflows = workflowsPage?.items ?? [];
  const totalPages = workflowsPage ? Math.max(1, Math.ceil(workflowsPage.total / workflowsPage.pageSize)) : 1;
  const sort = useSort(workflows ?? []);

  const createMutation = useMutation({
    mutationFn: async () => {
      const startNode = { id: "n1", type: "start", position: { x: 250, y: 60 }, data: { label: "Inizio Processo" } };
      const res = await api.post("/workflows", { name, description, nodes: [startNode], edges: [], companyId: targetCompanyId });
      return res.data;
    },
    onSuccess: (workflow) => {
      if (targetCompanyId && targetCompanyId !== currentCompanyId) setCurrentCompanyForApp("workflow", targetCompanyId);
      queryClient.invalidateQueries({ queryKey: ["workflows-table"] });
      setOpenCreate(false);
      setName("");
      setDescription("");
      navigate(`/workflow/designer/${workflow.id}`);
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/workflows/${id}/publish`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workflows-table"] }),
  });

  const updateCompanyMutation = useMutation({
    mutationFn: async () => api.post(`/workflows/${companyEditTarget!.id}/company`, { newCompanyId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows-table"] });
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
          <Typography variant="h5">{t("your_workflows")}</Typography>
        </Stack>
        <Stack direction="row" spacing={2} alignItems="center">
          <CompanySelector appKey="workflow" />
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenCreate(true)}>
            {t("new_workflow")}
          </Button>
        </Stack>
      </Stack>

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sortDirection={sort.orderBy === "name" ? sort.orderDir : false}>
                <TableSortLabel active={sort.orderBy === "name"} direction={sort.orderDir} onClick={() => sort.requestSort("name")}>
                  {t("name")}
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={sort.orderBy === "companyName" ? sort.orderDir : false}>
                <TableSortLabel active={sort.orderBy === "companyName"} direction={sort.orderDir} onClick={() => sort.requestSort("companyName")}>
                  Azienda
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={sort.orderBy === "status" ? sort.orderDir : false}>
                <TableSortLabel active={sort.orderBy === "status"} direction={sort.orderDir} onClick={() => sort.requestSort("status")}>
                  {t("status")}
                </TableSortLabel>
              </TableCell>
              <TableCell>Versione</TableCell>
              <TableCell sortDirection={sort.orderBy === "instanceCount" ? sort.orderDir : false}>
                <TableSortLabel active={sort.orderBy === "instanceCount"} direction={sort.orderDir} onClick={() => sort.requestSort("instanceCount")}>
                  {t("instances")}
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">{t("actions")}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ py: 0.5 }}>
                <ClearableTextField
                  size="small"
                  variant="standard"
                  placeholder="Cerca nome..."
                  value={filters.name}
                  onChange={(e) => updateFilter("name", e.target.value)}
                  fullWidth
                />
              </TableCell>
              <TableCell sx={{ py: 0.5 }} />
              <TableCell sx={{ py: 0.5 }}>
                <TextField select size="small" variant="standard" value={filters.status} onChange={(e) => updateFilter("status", e.target.value)} fullWidth SelectProps={{ displayEmpty: true }}>
                  <MenuItem value="">Tutti</MenuItem>
                  {Object.entries(STATUS_LABEL).map(([k, v]) => (
                    <MenuItem key={k} value={k}>
                      {v.label}
                    </MenuItem>
                  ))}
                </TextField>
              </TableCell>
              <TableCell sx={{ py: 0.5 }} />
              <TableCell sx={{ py: 0.5 }} />
              <TableCell sx={{ py: 0.5 }} align="right">
                {hasActiveFilters && (
                  <Button size="small" onClick={clearFilters}>
                    Cancella filtri
                  </Button>
                )}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sort.sorted.map((w: any) => (
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
                    {t("open_designer")}
                  </Button>
                  {w.status !== "PUBLISHED" && (
                    <Button size="small" color="secondary" onClick={() => publishMutation.mutate(w.id)}>
                      {t("publish")}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(workflows ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    {hasActiveFilters ? "Nessun workflow trovato con questi filtri." : "Nessun workflow ancora creato."}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      {totalPages > 1 && (
        <Stack alignItems="center" sx={{ mt: 2 }}>
          <Pagination count={totalPages} page={page} onChange={(_, p) => setPage(p)} />
        </Stack>
      )}

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
          <Button onClick={() => setOpenCreate(false)}>{t("cancel")}</Button>
          <Button
            variant="contained"
            disabled={!name || createMutation.isPending}
            onClick={() => createMutation.mutate()}
            startIcon={createMutation.isPending ? <CircularProgress size={14} color="inherit" /> : undefined}
          >
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
          <Button onClick={() => setCompanyEditTarget(null)}>{t("cancel")}</Button>
          <Button variant="contained" disabled={!newCompanyId || updateCompanyMutation.isPending} onClick={() => updateCompanyMutation.mutate()}>
            Salva
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
