import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Stack,
  Typography,
  Button,
  Paper,
  Table,
  TableContainer,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  TableSortLabel,
  Pagination,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { api } from "../../api/client";
import { useSort } from "../../hooks/useSort";
import { ClearableTextField } from "../../components/ClearableTextField";

export function AdminCompaniesPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ name: "" });

  function updateFilter(key: string, value: string) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }
  function clearFilters() {
    setFilters({ name: "" });
    setPage(1);
  }
  const hasActiveFilters = Object.values(filters).some((v) => v);

  const { data: companiesPage } = useQuery({
    queryKey: ["admin-companies-table", filters, page],
    queryFn: async () => (await api.get("/admin/companies/table", { ...filters, page })).data,
  });
  const companies = companiesPage?.items ?? [];
  const totalPages = companiesPage ? Math.max(1, Math.ceil(companiesPage.total / companiesPage.pageSize)) : 1;
  const sort = useSort(companies ?? []);

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

      <Paper>
        <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sortDirection={sort.orderBy === "name" ? sort.orderDir : false}>
                <TableSortLabel active={sort.orderBy === "name"} direction={sort.orderDir} onClick={() => sort.requestSort("name")}>
                  Nome
                </TableSortLabel>
              </TableCell>
              <TableCell>Codice</TableCell>
              <TableCell align="right">Azioni</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ py: 0.5 }}>
                <ClearableTextField size="small" variant="standard" placeholder="Cerca nome..." value={filters.name} onChange={(e) => updateFilter("name", e.target.value)} fullWidth />
              </TableCell>
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
            {sort.sorted.map((c: any) => (
              <TableRow key={c.id} hover>
                <TableCell>{c.name}</TableCell>
                <TableCell className="mono">{c.slug}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => openEdit(c)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => { setDeleteTarget(c); setDeleteError(null); }}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {companies.length === 0 && (
              <TableRow>
                <TableCell colSpan={3}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    {hasActiveFilters ? "Nessuna azienda trovata con questi filtri." : "Nessuna azienda creata."}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      </Paper>

      {totalPages > 1 && (
        <Stack alignItems="center" sx={{ mt: 2 }}>
          <Pagination count={totalPages} page={page} onChange={(_, p) => setPage(p)} />
        </Stack>
      )}

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
