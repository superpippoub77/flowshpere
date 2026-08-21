import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
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
  MenuItem,
  TextField,
  IconButton,
  ToggleButtonGroup,
  ToggleButton,
  CircularProgress,
} from "@mui/material";
import { DataGrid, GridColDef, GridToolbar, GridFilterModel } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import TimelineIcon from "@mui/icons-material/TimelineOutlined";
import dayjs from "dayjs";
import { api } from "../../api/client";
import { ClearableTextField } from "../../components/ClearableTextField";
import { useI18n } from "../../i18n";
import { CompanySelector } from "../../components/CompanySelector";
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
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [workflowId, setWorkflowId] = useState("");
  const [drawerInstanceId, setDrawerInstanceId] = useState<string | null>(null);
  const [initialNodeId, setInitialNodeId] = useState<string | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Link diretto (es. da un'email di notifica): ?openInstance=...&openNode=...
  // apre subito il passo giusto; solo ?openInstance=... apre la timeline.
  useEffect(() => {
    const openInstance = searchParams.get("openInstance");
    if (!openInstance) return;
    const openNode = searchParams.get("openNode");
    setDrawerInstanceId(openInstance);
    if (openNode) {
      setInitialNodeId(openNode);
      setDrawerVisible(false);
    } else {
      setInitialNodeId(null);
      setDrawerVisible(true);
    }
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [page, setPage] = useState(0);
  const [openClosed, setOpenClosed] = useState("open");
  const [workflowFilterId, setWorkflowFilterId] = useState("");
  const [anagrafica, setAnagrafica] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterModel, setFilterModel] = useState<GridFilterModel>({ items: [] });

  const { data, isFetching } = useQuery({
    queryKey: ["instances", page, openClosed, workflowFilterId, anagrafica, dateFrom, dateTo, filterModel],
    queryFn: async () =>
      (
        await api.get("/instances", {
          page: page + 1,
          openClosed,
          workflowId: workflowFilterId,
          anagrafica,
          dateFrom,
          dateTo,
          filterModel: JSON.stringify(filterModel),
        })
      ).data,
    refetchInterval: 8000,
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

  const columns: GridColDef[] = useMemo(
    () => [
      { field: "code", headerName: t("code"), width: 150 },
      { field: "workflowName", headerName: "Workflow", flex: 0.8, minWidth: 160, sortable: false, filterable: false, valueGetter: (p) => p.row.workflow?.name },
      {
        field: "status",
        headerName: "Stato",
        width: 140,
        type: "singleSelect",
        valueOptions: STATUS_OPTIONS,
        renderCell: (params) => <Chip size="small" label={params.value} color={STATUS_COLOR[params.value as string]} />,
      },
      {
        field: "progress",
        headerName: t("progress"),
        flex: 1,
        minWidth: 220,
        sortable: false,
        filterable: false,
        renderCell: (params) => (
          <InlineSteps
            item={params.row}
            onSelect={(nodeId) => {
              setDrawerVisible(false);
              setInitialNodeId(nodeId);
              setDrawerInstanceId(params.row.id);
            }}
          />
        ),
      },
      {
        field: "whoseTurn",
        headerName: t("whose_turn"),
        flex: 0.7,
        minWidth: 140,
        sortable: false,
        filterable: false,
        valueGetter: (p) => whoseTurnLabel(p.row, companyUsers ?? []),
      },
      {
        field: "createdAt",
        headerName: t("created"),
        width: 160,
        filterable: false,
        valueFormatter: (p) => dayjs(p.value as string).format("DD/MM/YYYY HH:mm"),
      },
      {
        field: "timeline_",
        headerName: t("timeline"),
        width: 90,
        sortable: false,
        filterable: false,
        align: "right",
        headerAlign: "right",
        renderCell: (params) => (
          <IconButton
            size="small"
            onClick={() => {
              setInitialNodeId(null);
              setDrawerInstanceId(params.row.id);
              setDrawerVisible(true);
            }}
          >
            <TimelineIcon fontSize="small" />
          </IconButton>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [companyUsers, t]
  );

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
        <Stack direction="row" spacing={2} alignItems="center">
          <CompanySelector appKey="workflow" />
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
            {t("new_instance")}
          </Button>
        </Stack>
      </Stack>

      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" sx={{ mb: 2 }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={openClosed}
          onChange={(_, value) => {
            if (value) {
              setPage(0);
              setOpenClosed(value);
            }
          }}
        >
          <ToggleButton value="open">{t("open_f")}</ToggleButton>
          <ToggleButton value="closed">{t("closed_f")}</ToggleButton>
          <ToggleButton value="all">{t("all")}</ToggleButton>
        </ToggleButtonGroup>

        <TextField
          select
          size="small"
          label="Workflow"
          value={workflowFilterId}
          onChange={(e) => {
            setPage(0);
            setWorkflowFilterId(e.target.value);
          }}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">{t("all")}</MenuItem>
          {(workflows ?? []).map((w: any) => (
            <MenuItem key={w.id} value={w.id}>
              {w.name}
            </MenuItem>
          ))}
        </TextField>

        <ClearableTextField
          size="small"
          label={t("customer")}
          placeholder={t("customer") + "..."}
          value={anagrafica}
          onChange={(e) => {
            setPage(0);
            setAnagrafica(e.target.value);
          }}
        />

        <TextField
          type="date"
          size="small"
          label={t("from_date")}
          InputLabelProps={{ shrink: true }}
          value={dateFrom}
          onChange={(e) => {
            setPage(0);
            setDateFrom(e.target.value);
          }}
        />
        <TextField
          type="date"
          size="small"
          label={t("to_date")}
          InputLabelProps={{ shrink: true }}
          value={dateTo}
          onChange={(e) => {
            setPage(0);
            setDateTo(e.target.value);
          }}
        />
      </Stack>

      <Paper sx={{ height: 600, display: "flex", flexDirection: "column" }}>
        <DataGrid
          rows={items}
          columns={columns}
          loading={isFetching}
          getRowHeight={() => "auto"}
          paginationMode="server"
          filterMode="server"
          rowCount={data?.total ?? 0}
          paginationModel={{ page, pageSize: 10 }}
          onPaginationModelChange={(model) => setPage(model.page)}
          filterModel={filterModel}
          onFilterModelChange={setFilterModel}
          pageSizeOptions={[10]}
          disableRowSelectionOnClick
          slots={{ toolbar: GridToolbar }}
          slotProps={{ toolbar: { showQuickFilter: false } }}
          localeText={{ noRowsLabel: t("no_results_filters") }}
          sx={{ border: 0 }}
        />
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{t("new_instance")}</DialogTitle>
        <DialogContent>
          <TextField select label={t("published_workflow")} fullWidth sx={{ mt: 1 }} value={workflowId} onChange={(e) => setWorkflowId(e.target.value)}>
            {publishedWorkflows.map((w: any) => (
              <MenuItem key={w.id} value={w.id}>
                {w.name}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>{t("cancel")}</Button>
          <Button
            variant="contained"
            disabled={!workflowId || createMutation.isPending}
            onClick={() => createMutation.mutate()}
            startIcon={createMutation.isPending ? <CircularProgress size={14} color="inherit" /> : undefined}
          >
            {t("start")}
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
