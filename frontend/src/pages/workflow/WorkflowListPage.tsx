import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Stack,
  Typography,
  Button,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  IconButton,
  CircularProgress,
} from "@mui/material";
import { DataGrid, GridColDef, GridToolbar, GridFilterModel } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/EditOutlined";
import { api } from "../../api/client";
import { useAuthStore } from "../../store/authStore";
import { ClearableTextField } from "../../components/ClearableTextField";
import { useI18n } from "../../i18n";
import { CompanySelector } from "../../components/CompanySelector";
import { GridHeaderFilter } from "../../components/GridHeaderFilter";

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
  const [page, setPage] = useState(0);
  const [filterModel, setFilterModel] = useState<GridFilterModel>({ items: [] });

  const { data: workflowsPage, isFetching } = useQuery({
    queryKey: ["workflows-table", filterModel, page],
    queryFn: async () => (await api.get("/workflows/table", { page: page + 1, filterModel: JSON.stringify(filterModel) })).data,
    refetchInterval: 15000,
  });
  const workflows = workflowsPage?.items ?? [];

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

  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: "name",
        renderHeader: () => <GridHeaderFilter field="name" label={t("name")} filterModel={filterModel} setFilterModel={setFilterModel} />,
        flex: 1.2,
        minWidth: 200,
        renderCell: (params) => (
          <Box sx={{ py: 0.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {params.row.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {params.row.description}
            </Typography>
          </Box>
        ),
      },
      {
        field: "companyName",
        headerName: "Azienda",
        flex: 0.8,
        minWidth: 150,
        filterable: false,
        renderCell: (params) => (
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="body2">{params.row.companyName ?? "—"}</Typography>
            {user?.isSuperAdmin && (
              <IconButton
                size="small"
                onClick={() => {
                  setCompanyEditTarget({ id: params.row.id, companyId: params.row.companyId });
                  setNewCompanyId(params.row.companyId);
                }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            )}
          </Stack>
        ),
      },
      {
        field: "status",
        renderHeader: () => (
          <GridHeaderFilter
            field="status"
            label={t("status")}
            filterModel={filterModel}
            setFilterModel={setFilterModel}
            operator="equals"
            options={Object.entries(STATUS_LABEL).map(([value, v]) => ({ value, label: v.label }))}
          />
        ),
        width: 160,
        renderCell: (params) => <Chip size="small" label={STATUS_LABEL[params.value as string]?.label ?? params.value} color={STATUS_LABEL[params.value as string]?.color} />,
      },
      { field: "latestVersion", headerName: "Versione", width: 90, filterable: false, valueFormatter: (p) => `v${p.value ?? 1}` },
      { field: "instanceCount", headerName: t("instances"), width: 100, type: "number", filterable: false },
      {
        field: "actions_",
        headerName: t("actions"),
        width: 220,
        sortable: false,
        filterable: false,
        renderCell: (params) => (
          <Stack direction="row" spacing={0.5}>
            <Button size="small" onClick={() => navigate(`/workflow/designer/${params.row.id}`)}>
              {t("open_designer")}
            </Button>
            {params.row.status !== "PUBLISHED" && (
              <Button size="small" color="secondary" onClick={() => publishMutation.mutate(params.row.id)}>
                {t("publish")}
              </Button>
            )}
          </Stack>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, navigate, filterModel, setFilterModel]
  );

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

      <Paper sx={{ height: 560, display: "flex", flexDirection: "column" }}>
        <DataGrid
          rows={workflows}
          columns={columns}
          loading={isFetching}
          getRowHeight={() => "auto"}
          columnHeaderHeight={64}
          paginationMode="server"
          filterMode="server"
          rowCount={workflowsPage?.total ?? 0}
          paginationModel={{ page, pageSize: 10 }}
          onPaginationModelChange={(model) => setPage(model.page)}
          filterModel={filterModel}
          onFilterModelChange={setFilterModel}
          pageSizeOptions={[10]}
          disableRowSelectionOnClick
          density="standard"
          slots={{ toolbar: GridToolbar }}
          slotProps={{ toolbar: { showQuickFilter: false } }}
          localeText={{ noRowsLabel: "Nessun workflow trovato." }}
          sx={{ border: 0 }}
        />
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
