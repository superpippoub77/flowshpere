import { useState } from "react";
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
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { api } from "../../api/client";
import { ClearableTextField } from "../../components/ClearableTextField";

export function TicketCategoriesPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [defaultAssigneeId, setDefaultAssigneeId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: categories } = useQuery({
    queryKey: ["ticket-categories"],
    queryFn: async () => (await api.get("/ticket-categories")).data,
  });

  const { data: companyUsers } = useQuery({
    queryKey: ["company-users"],
    queryFn: async () => (await api.get("/companies/users")).data,
  });

  function closeDialog() {
    queryClient.invalidateQueries({ queryKey: ["ticket-categories"] });
    setOpen(false);
    setEditingId(null);
    setName("");
    setDescription("");
    setDefaultAssigneeId("");
  }

  const createMutation = useMutation({
    mutationFn: async () => api.post("/ticket-categories", { name, description, defaultAssigneeId: defaultAssigneeId || undefined }),
    onSuccess: closeDialog,
  });

  const updateMutation = useMutation({
    mutationFn: async () => api.put(`/ticket-categories/${editingId}`, { name, description, defaultAssigneeId: defaultAssigneeId || undefined }),
    onSuccess: closeDialog,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/ticket-categories/${id}/delete`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-categories"] });
      setDeleteTarget(null);
      setDeleteError(null);
    },
    onError: (err: any) => setDeleteError(err?.response?.data?.error || "Impossibile eliminare il ramo"),
  });

  function openCreate() {
    setEditingId(null);
    setName("");
    setDescription("");
    setDefaultAssigneeId("");
    setOpen(true);
  }

  function openEdit(c: any) {
    setEditingId(c.id);
    setName(c.name);
    setDescription(c.description ?? "");
    setDefaultAssigneeId(c.defaultAssigneeId ?? "");
    setOpen(true);
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Stack spacing={0.3}>
          <Typography variant="overline" color="primary">
            TICKET
          </Typography>
          <Typography variant="h5">Rami di gestione</Typography>
          <Typography variant="body2" color="text.secondary">
            Ogni ramo puo' avere un responsabile predefinito: i nuovi ticket in quel ramo gli vengono assegnati automaticamente.
          </Typography>
        </Stack>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Nuovo ramo
        </Button>
      </Stack>

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nome</TableCell>
              <TableCell>Descrizione</TableCell>
              <TableCell>Responsabile predefinito</TableCell>
              <TableCell align="right">Azioni</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(categories ?? []).map((c: any) => (
              <TableRow key={c.id} hover>
                <TableCell>{c.name}</TableCell>
                <TableCell>{c.description || "—"}</TableCell>
                <TableCell>{c.defaultAssigneeName ?? "Nessuno"}</TableCell>
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
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={closeDialog} fullWidth maxWidth="xs">
        <DialogTitle>{editingId ? "Modifica ramo" : "Nuovo ramo"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <ClearableTextField label="Nome" value={name} onChange={(e) => setName(e.target.value)} fullWidth autoFocus />
            <ClearableTextField label="Descrizione" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth multiline minRows={2} />
            <TextField select label="Responsabile predefinito" value={defaultAssigneeId} onChange={(e) => setDefaultAssigneeId(e.target.value)} fullWidth>
              <MenuItem value="">Nessuno</MenuItem>
              {(companyUsers ?? []).map((u: any) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.fullName}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Annulla</Button>
          <Button variant="contained" disabled={!name || createMutation.isPending || updateMutation.isPending} onClick={() => (editingId ? updateMutation.mutate() : createMutation.mutate())}>
            {editingId ? "Salva" : "Crea"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Elimina ramo</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Eliminare definitivamente <strong>{deleteTarget?.name}</strong>?
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
