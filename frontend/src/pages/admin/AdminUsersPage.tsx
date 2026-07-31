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
  Chip,
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
import { api } from "../../api/client";

const TYPE_LABEL: Record<string, { label: string; color: any }> = {
  SUPERADMIN: { label: "Super Amministratore", color: "error" },
  ADMIN: { label: "Amministratore", color: "warning" },
  UTENTE: { label: "Utente", color: "default" },
};

const emptyForm = { fullName: "", email: "", password: "", userType: "UTENTE" };

export function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: users } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => (await api.get("/admin/users")).data,
  });

  const createMutation = useMutation({
    mutationFn: async () => api.post("/admin/users", form),
    onSuccess: closeDialog,
  });

  const updateMutation = useMutation({
    mutationFn: async () => api.put(`/admin/users/${editingId}`, form),
    onSuccess: closeDialog,
  });

  function closeDialog() {
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    setOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(u: any) {
    setEditingId(u.id);
    setForm({ fullName: u.fullName, email: u.email, password: "", userType: u.userType });
    setOpen(true);
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Stack spacing={0.3}>
          <Typography variant="overline" color="primary">
            UTENTI
          </Typography>
          <Typography variant="h5">Gestione utenti</Typography>
        </Stack>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Nuovo utente
        </Button>
      </Stack>

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nome</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell align="right">Azioni</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(users ?? []).map((u: any) => (
              <TableRow key={u.id} hover>
                <TableCell>{u.fullName}</TableCell>
                <TableCell className="mono">{u.email}</TableCell>
                <TableCell>
                  <Chip size="small" label={TYPE_LABEL[u.userType]?.label ?? u.userType} color={TYPE_LABEL[u.userType]?.color} />
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => openEdit(u)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={closeDialog} fullWidth maxWidth="xs">
        <DialogTitle>{editingId ? "Modifica utente" : "Nuovo utente"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Nome completo" value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} fullWidth />
            <TextField label="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} fullWidth />
            <TextField
              label={editingId ? "Nuova password (lascia vuoto per non cambiarla)" : "Password"}
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              fullWidth
            />
            <TextField select label="Tipo" value={form.userType} onChange={(e) => setForm((f) => ({ ...f, userType: e.target.value }))} fullWidth>
              <MenuItem value="UTENTE">Utente</MenuItem>
              <MenuItem value="ADMIN">Amministratore</MenuItem>
              <MenuItem value="SUPERADMIN">Super Amministratore</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Annulla</Button>
          <Button
            variant="contained"
            disabled={!form.fullName || !form.email || (!editingId && !form.password) || createMutation.isPending || updateMutation.isPending}
            onClick={() => (editingId ? updateMutation.mutate() : createMutation.mutate())}
          >
            {editingId ? "Salva" : "Crea"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
