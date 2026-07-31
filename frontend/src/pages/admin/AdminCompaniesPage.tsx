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
  IconButton,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/EditOutlined";
import { api } from "../../api/client";

export function AdminCompaniesPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");

  const { data: companies } = useQuery({
    queryKey: ["admin-companies"],
    queryFn: async () => (await api.get("/admin/companies")).data,
  });

  function closeDialog() {
    queryClient.invalidateQueries({ queryKey: ["admin-companies"] });
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
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nome</TableCell>
              <TableCell>Codice</TableCell>
              <TableCell align="right">Azioni</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(companies ?? []).map((c: any) => (
              <TableRow key={c.id} hover>
                <TableCell>{c.name}</TableCell>
                <TableCell className="mono">{c.slug}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => openEdit(c)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={closeDialog} fullWidth maxWidth="xs">
        <DialogTitle>{editingId ? "Modifica azienda" : "Nuova azienda"}</DialogTitle>
        <DialogContent>
          <TextField label="Nome azienda" value={name} onChange={(e) => setName(e.target.value)} fullWidth sx={{ mt: 1 }} autoFocus />
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
    </Box>
  );
}
