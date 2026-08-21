import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Stack, Typography, Button, Paper, Dialog, DialogTitle, DialogContent, DialogActions, IconButton } from "@mui/material";
import { DataGrid, GridColDef, GridToolbar, GridFilterModel } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import HubIcon from "@mui/icons-material/HubOutlined";
import dayjs from "dayjs";
import { api } from "../../api/client";
import { ClearableTextField } from "../../components/ClearableTextField";
import { CompanySelector } from "../../components/CompanySelector";
import { GridHeaderFilter } from "../../components/GridHeaderFilter";

export function NotesListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [page, setPage] = useState(0);
  const [filterModel, setFilterModel] = useState<GridFilterModel>({ items: [] });
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const { data, isFetching } = useQuery({
    queryKey: ["notes-table", filterModel, page],
    queryFn: async () => (await api.get("/notes/table", { filterModel: JSON.stringify(filterModel), page: page + 1 })).data,
  });
  const items = data?.items ?? [];

  const createMutation = useMutation({
    mutationFn: async () => (await api.post("/notes", { title: newTitle, content: "" })).data,
    onSuccess: (note) => {
      queryClient.invalidateQueries({ queryKey: ["notes-table"] });
      setOpen(false);
      setNewTitle("");
      navigate(`/notes/${note.id}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/notes/${id}/delete`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes-table"] });
      setDeleteTarget(null);
    },
  });

  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: "title",
        renderHeader: () => <GridHeaderFilter field="title" label="Titolo" filterModel={filterModel} setFilterModel={setFilterModel} />,
        flex: 1,
        minWidth: 240,
      },
      {
        field: "backlinkCount",
        headerName: "Collegamenti in entrata",
        width: 190,
        filterable: false,
        renderCell: (params) => (params.value > 0 ? `${params.value} nota/e` : "—"),
      },
      { field: "updatedByName", headerName: "Ultima modifica di", width: 170, filterable: false, valueGetter: (p) => p.row.updatedByName ?? "—" },
      { field: "updatedAt", headerName: "Aggiornata", width: 160, filterable: false, valueFormatter: (p) => dayjs(p.value as string).format("DD/MM/YYYY HH:mm") },
      {
        field: "actions_",
        headerName: "",
        width: 60,
        sortable: false,
        filterable: false,
        renderCell: (params) => (
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); setDeleteTarget(params.row); }}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        ),
      },
    ],
    [filterModel]
  );

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Stack spacing={0.3}>
          <Typography variant="overline" color="primary">
            NOTE
          </Typography>
          <Typography variant="h5">Le tue note</Typography>
          <Typography variant="body2" color="text.secondary">
            Scrivi in Markdown e collega le note tra loro con [[Titolo]] — proprio come in Obsidian.
          </Typography>
        </Stack>
        <Stack direction="row" spacing={2} alignItems="center">
          <CompanySelector appKey="notes" />
          <Button variant="outlined" startIcon={<HubIcon />} onClick={() => navigate("/notes/graph")}>
            Vista a grafo
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
            Nuova nota
          </Button>
        </Stack>
      </Stack>

      <Paper sx={{ height: 560, display: "flex", flexDirection: "column" }}>
        <DataGrid
          rows={items}
          columns={columns}
          loading={isFetching}
          columnHeaderHeight={64}
          paginationMode="server"
          filterMode="server"
          rowCount={data?.total ?? 0}
          paginationModel={{ page, pageSize: data?.pageSize ?? 15 }}
          onPaginationModelChange={(model) => setPage(model.page)}
          filterModel={filterModel}
          onFilterModelChange={setFilterModel}
          pageSizeOptions={[15]}
          disableRowSelectionOnClick
          onRowClick={(params) => navigate(`/notes/${params.row.id}`)}
          slots={{ toolbar: GridToolbar }}
          slotProps={{ toolbar: { showQuickFilter: false } }}
          localeText={{ noRowsLabel: "Nessuna nota trovata." }}
          sx={{ border: 0, "& .MuiDataGrid-row": { cursor: "pointer" } }}
        />
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Nuova nota</DialogTitle>
        <DialogContent>
          <ClearableTextField label="Titolo" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} fullWidth sx={{ mt: 1 }} autoFocus />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Annulla</Button>
          <Button variant="contained" disabled={!newTitle || createMutation.isPending} onClick={() => createMutation.mutate()}>
            Crea e apri
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Elimina nota</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Eliminare definitivamente <strong>{deleteTarget?.title}</strong>? I collegamenti verso e da questa nota verranno rimossi.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Annulla</Button>
          <Button variant="contained" color="error" onClick={() => deleteMutation.mutate(deleteTarget.id)}>
            Elimina
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
