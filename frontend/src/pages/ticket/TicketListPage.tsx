import { useMemo, useState } from "react";
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
  CircularProgress,
} from "@mui/material";
import { DataGrid, GridColDef, GridToolbar, GridFilterModel } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import dayjs from "dayjs";
import { api } from "../../api/client";
import { ClearableTextField } from "../../components/ClearableTextField";
import { CompanySelector } from "../../components/CompanySelector";
import { TicketDrawer } from "./TicketDrawer";

const STATUS_LABEL: Record<string, { label: string; color: any }> = {
  APERTO: { label: "Aperto", color: "info" },
  IN_LAVORAZIONE: { label: "In lavorazione", color: "warning" },
  RISOLTO: { label: "Risolto", color: "success" },
  CHIUSO: { label: "Chiuso", color: "default" },
};

const PRIORITY_LABEL: Record<string, { label: string; color: any }> = {
  BASSA: { label: "Bassa", color: "default" },
  MEDIA: { label: "Media", color: "info" },
  ALTA: { label: "Alta", color: "warning" },
  URGENTE: { label: "Urgente", color: "error" },
};

export function TicketListPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [categoryFilterId, setCategoryFilterId] = useState("");
  const [filterModel, setFilterModel] = useState<GridFilterModel>({ items: [] });
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [priority, setPriority] = useState("MEDIA");

  const { data: categories } = useQuery({
    queryKey: ["ticket-categories"],
    queryFn: async () => (await api.get("/ticket-categories")).data,
  });

  const { data, isFetching } = useQuery({
    queryKey: ["tickets", categoryFilterId, filterModel, page],
    queryFn: async () => (await api.get("/tickets", { categoryId: categoryFilterId, filterModel: JSON.stringify(filterModel), page: page + 1 })).data,
    refetchInterval: 8000,
  });

  const items = data?.items ?? [];

  const createMutation = useMutation({
    mutationFn: async () => (await api.post("/tickets", { subject, description, categoryId: categoryId || undefined, priority })).data,
    onSuccess: (ticket) => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      setOpen(false);
      setSubject("");
      setDescription("");
      setCategoryId("");
      setPriority("MEDIA");
      setDrawerId(ticket.id);
    },
  });

  const columns: GridColDef[] = useMemo(
    () => [
      { field: "code", headerName: "N. ticket", width: 130 },
      { field: "subject", headerName: "Oggetto", flex: 1, minWidth: 200 },
      { field: "categoryName", headerName: "Ramo", width: 140, filterable: false, valueGetter: (p) => p.row.categoryName ?? "—" },
      {
        field: "priority",
        headerName: "Priorità",
        width: 130,
        type: "singleSelect",
        valueOptions: Object.entries(PRIORITY_LABEL).map(([value, v]) => ({ value, label: v.label })),
        renderCell: (params) => <Chip size="small" label={PRIORITY_LABEL[params.value as string]?.label ?? params.value} color={PRIORITY_LABEL[params.value as string]?.color} />,
      },
      {
        field: "status",
        headerName: "Stato",
        width: 150,
        type: "singleSelect",
        valueOptions: Object.entries(STATUS_LABEL).map(([value, v]) => ({ value, label: v.label })),
        renderCell: (params) => <Chip size="small" label={STATUS_LABEL[params.value as string]?.label ?? params.value} color={STATUS_LABEL[params.value as string]?.color} />,
      },
      {
        field: "assignedToName",
        headerName: "Assegnato a",
        flex: 0.7,
        minWidth: 140,
        filterable: false,
        renderCell: (params) => params.value ?? <Typography variant="caption" color="text.secondary">Non assegnato</Typography>,
      },
      {
        field: "updatedAt",
        headerName: "Aggiornato",
        width: 160,
        filterable: false,
        valueFormatter: (p) => dayjs(p.value as string).format("DD/MM/YYYY HH:mm"),
      },
    ],
    []
  );

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Stack spacing={0.3}>
          <Typography variant="overline" color="primary">
            TICKET
          </Typography>
          <Typography variant="h5">Gestione Ticket</Typography>
        </Stack>
        <Stack direction="row" spacing={2} alignItems="center">
          <CompanySelector appKey="ticket" />
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
            Nuovo ticket
          </Button>
        </Stack>
      </Stack>

      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <TextField
          select
          size="small"
          label="Ramo"
          value={categoryFilterId}
          onChange={(e) => {
            setPage(0);
            setCategoryFilterId(e.target.value);
          }}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">Tutti</MenuItem>
          {(categories ?? []).map((c: any) => (
            <MenuItem key={c.id} value={c.id}>
              {c.name}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <Paper sx={{ height: 560, display: "flex", flexDirection: "column" }}>
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
          onRowClick={(params) => setDrawerId(params.row.id)}
          slots={{ toolbar: GridToolbar }}
          slotProps={{ toolbar: { showQuickFilter: false } }}
          localeText={{ noRowsLabel: "Nessun ticket trovato con questi filtri." }}
          sx={{ border: 0, "& .MuiDataGrid-row": { cursor: "pointer" } }}
        />
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Nuovo ticket</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <ClearableTextField label="Oggetto" value={subject} onChange={(e) => setSubject(e.target.value)} fullWidth autoFocus />
            <TextField select label="Ramo" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} fullWidth>
              <MenuItem value="">Nessuno</MenuItem>
              {(categories ?? []).map((c: any) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField select label="Priorità" value={priority} onChange={(e) => setPriority(e.target.value)} fullWidth>
              {Object.entries(PRIORITY_LABEL).map(([k, v]) => (
                <MenuItem key={k} value={k}>
                  {v.label}
                </MenuItem>
              ))}
            </TextField>
            <ClearableTextField label="Descrizione" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth multiline minRows={3} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Annulla</Button>
          <Button
            variant="contained"
            disabled={!subject || createMutation.isPending}
            onClick={() => createMutation.mutate()}
            startIcon={createMutation.isPending ? <CircularProgress size={14} color="inherit" /> : undefined}
          >
            Crea
          </Button>
        </DialogActions>
      </Dialog>

      <TicketDrawer ticketId={drawerId} onClose={() => setDrawerId(null)} />
    </Box>
  );
}
