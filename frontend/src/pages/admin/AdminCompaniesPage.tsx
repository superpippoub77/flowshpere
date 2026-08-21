import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Stack,
  Typography,
  Button,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from "@mui/material";
import { DataGrid, GridColDef, GridToolbar, GridFilterModel } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { api } from "../../api/client";
import { ClearableTextField } from "../../components/ClearableTextField";

export function AdminCompaniesPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [filterModel, setFilterModel] = useState<GridFilterModel>({ items: [] });

  const { data: companiesPage, isFetching } = useQuery({
    queryKey: ["admin-companies-table", filterModel, page],
    queryFn: async () => (await api.get("/admin/companies/table", { filterModel: JSON.stringify(filterModel), page: page + 1 })).data,
  });
  const companies = companiesPage?.items ?? [];

  function closeDialog() {
    queryClient.invalidateQueries({ queryKey: ["admin-companies-table"] });
    queryClient.invalidateQueries({ queryKey: ["admin-permissions"] });
    setOpen(false);
    setEditingId(null);
    setName("");
  }

  const createMutation = useMutation({
    mutationFn: async () => api.post("/admin/companies", { name }),
    onSuccess: closeDialog,
  });

  const updateMutation = useMutation({
    mutationFn: async () => api.put(`/admin/companies/${editingId}`, { name }),
    onSuccess: closeDialog,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/admin/companies/${id}/delete`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-companies-table"] });
      setDeleteTarget(null);
      setDeleteError(null);
    },
    onError: (err: any) => setDeleteError(err?.response?.data?.error || "Impossibile eliminare l'azienda"),
  });

  function openCreate() {
    setEditingId(null);
    setName("");
    setOpen(true);
  }

  function openEdit(c: any) {
    setEditingId(c.id);
    setName(c.name);
    setOpen(true);
  }

  const columns: GridColDef[] = useMemo(
    () => [
      { field: "name", headerName: "Nome", flex: 1, minWidth: 200 },
      { field: "slug", headerName: "Codice", flex: 0.7, minWidth: 140 },
      {
        field: "actions_",
        headerName: "Azioni",
        width: 100,
        sortable: false,
        filterable: false,
        align: "right",
        headerAlign: "right",
        renderCell: (params) => (
          <Stack direction="row">
            <IconButton size="small" onClick={() => openEdit(params.row)}>
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => {
                setDeleteTarget(params.row);
                setDeleteError(null);
              }}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Stack>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Stack spacing={0.3}>
          <Typography variant="overline" color="primary">
            AZIENDE
          </Typography>
          <Typography variant="h5">Gestione aziende</Typography>
        </Stack>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Nuova azienda
        </Button>
      </Stack>

      <Paper sx={{ height: 520, display: "flex", flexDirection: "column" }}>
        <DataGrid
          rows={companies}
          columns={columns}
          loading={isFetching}
          paginationMode="server"
          filterMode="server"
          rowCount={companiesPage?.total ?? 0}
          paginationModel={{ page, pageSize: 10 }}
          onPaginationModelChange={(model) => setPage(model.page)}
          filterModel={filterModel}
          onFilterModelChange={setFilterModel}
          pageSizeOptions={[10]}
          disableRowSelectionOnClick
          slots={{ toolbar: GridToolbar }}
          slotProps={{ toolbar: { showQuickFilter: false } }}
          localeText={{ noRowsLabel: "Nessuna azienda trovata." }}
          sx={{ border: 0 }}
        />
      </Paper>

      <Dialog open={open} onClose={closeDialog} fullWidth maxWidth="xs">
        <DialogTitle>{editingId ? "Modifica azienda" : "Nuova azienda"}</DialogTitle>
        <DialogContent>
          <ClearableTextField label="Nome azienda" value={name} onChange={(e) => setName(e.target.value)} fullWidth sx={{ mt: 1 }} autoFocus />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Annulla</Button>
          <Button
            variant="contained"
            disabled={!name || createMutation.isPending || updateMutation.isPending}
            onClick={() => (editingId ? updateMutation.mutate() : createMutation.mutate())}
          >
            {editingId ? "Salva" : "Crea"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Elimina azienda</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Eliminare definitivamente <strong>{deleteTarget?.name}</strong>? L'operazione non e' reversibile.
          </Typography>
          {deleteError && (
            <Typography variant="body2" color="error" sx={{ mt: 1.5 }}>
              {deleteError}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Annulla</Button>
          <Button variant="contained" color="error" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(deleteTarget.id)}>
            Elimina
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
