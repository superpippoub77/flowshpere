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
  Avatar,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { api, getAvatarUrl } from "../../api/client";
import { AvatarPicker } from "../../components/AvatarPicker";
import { PasswordField } from "../../components/PasswordField";
import { ClearableTextField } from "../../components/ClearableTextField";

const TYPE_LABEL: Record<string, { label: string; color: any }> = {
  SUPERADMIN: { label: "Super Amministratore", color: "error" },
  ADMIN: { label: "Amministratore", color: "warning" },
  UTENTE: { label: "Utente", color: "default" },
};

const emptyForm = { fullName: "", email: "", password: "", userType: "UTENTE", phone: "", jobTitle: "", notes: "" };

export function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [avatar, setAvatar] = useState<{ base64: string; mimeType: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: users } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => (await api.get("/admin/users")).data,
  });

  function closeDialog() {
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    setOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setAvatar(null);
  }

  const avatarPayload = avatar ? { avatarBase64: avatar.base64, avatarMimeType: avatar.mimeType } : {};

  const createMutation = useMutation({
    mutationFn: async () => api.post("/admin/users", { ...form, ...avatarPayload }),
    onSuccess: closeDialog,
  });

  const updateMutation = useMutation({
    mutationFn: async () => api.put(`/admin/users/${editingId}`, { ...form, ...avatarPayload }),
    onSuccess: closeDialog,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/admin/users/${id}/delete`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setDeleteTarget(null);
      setDeleteError(null);
    },
    onError: (err: any) => setDeleteError(err?.response?.data?.error || "Impossibile eliminare l'utente"),
  });

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setAvatar(null);
    setOpen(true);
  }

  function openEdit(u: any) {
    setEditingId(u.id);
    setForm({ fullName: u.fullName, email: u.email, password: "", userType: u.userType, phone: u.phone ?? "", jobTitle: u.jobTitle ?? "", notes: "" });
    setAvatar(null);
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
              <TableCell></TableCell>
              <TableCell>Nome</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Telefono / Ruolo</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell align="right">Azioni</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(users ?? []).map((u: any) => (
              <TableRow key={u.id} hover>
                <TableCell width={48}>
                  <Avatar src={u.hasAvatar ? getAvatarUrl(u.id) : undefined} sx={{ width: 32, height: 32, fontSize: 14 }}>
                    {u.fullName?.[0]}
                  </Avatar>
                </TableCell>
                <TableCell>{u.fullName}</TableCell>
                <TableCell className="mono">{u.email}</TableCell>
                <TableCell>
                  <Typography variant="body2">{u.jobTitle || "—"}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {u.phone || ""}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip size="small" label={TYPE_LABEL[u.userType]?.label ?? u.userType} color={TYPE_LABEL[u.userType]?.color} />
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => openEdit(u)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => { setDeleteTarget(u); setDeleteError(null); }}>
                    <DeleteOutlineIcon fontSize="small" />
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
            <AvatarPicker
              currentUrl={editingId && users?.find((u: any) => u.id === editingId)?.hasAvatar ? getAvatarUrl(editingId) : undefined}
              fallbackText={form.fullName?.[0] ?? "?"}
              onPick={({ base64, mimeType }) => setAvatar({ base64, mimeType })}
            />
            <ClearableTextField label="Nome completo" value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} fullWidth />
            <ClearableTextField label="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} fullWidth />
            <ClearableTextField label="Telefono" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} fullWidth />
            <ClearableTextField label="Ruolo / posizione" value={form.jobTitle} onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))} fullWidth />
            <ClearableTextField label="Note" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} fullWidth multiline minRows={2} />
            <PasswordField
              label={editingId ? "Nuova password (lascia vuoto per non cambiarla)" : "Password"}
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

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Elimina utente</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Eliminare definitivamente <strong>{deleteTarget?.fullName}</strong>? L'operazione non e' reversibile.
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
