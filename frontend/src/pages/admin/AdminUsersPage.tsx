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
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  IconButton,
  Avatar,
  TableSortLabel,
  Pagination,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { api, getAvatarUrl } from "../../api/client";
import { AvatarPicker } from "../../components/AvatarPicker";
import { PasswordField } from "../../components/PasswordField";
import { useSort } from "../../hooks/useSort";
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
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ fullName: "", email: "", userType: "" });

  function updateFilter(key: string, value: string) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }
  function clearFilters() {
    setFilters({ fullName: "", email: "", userType: "" });
    setPage(1);
  }
  const hasActiveFilters = Object.values(filters).some((v) => v);

  const { data: usersPage } = useQuery({
    queryKey: ["admin-users-table", filters, page],
    queryFn: async () => (await api.get("/admin/users/table", { ...filters, page })).data,
  });
  const users = usersPage?.items ?? [];
  const totalPages = usersPage ? Math.max(1, Math.ceil(usersPage.total / usersPage.pageSize)) : 1;
  const sort = useSort(users ?? []);

  function closeDialog() {
    queryClient.invalidateQueries({ queryKey: ["admin-users-table"] });
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
      queryClient.invalidateQueries({ queryKey: ["admin-users-table"] });
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
        <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell></TableCell>
              <TableCell sortDirection={sort.orderBy === "fullName" ? sort.orderDir : false}>
                <TableSortLabel active={sort.orderBy === "fullName"} direction={sort.orderDir} onClick={() => sort.requestSort("fullName")}>
                  Nome
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={sort.orderBy === "email" ? sort.orderDir : false}>
                <TableSortLabel active={sort.orderBy === "email"} direction={sort.orderDir} onClick={() => sort.requestSort("email")}>
                  Email
                </TableSortLabel>
              </TableCell>
              <TableCell>Telefono / Ruolo</TableCell>
              <TableCell sortDirection={sort.orderBy === "userType" ? sort.orderDir : false}>
                <TableSortLabel active={sort.orderBy === "userType"} direction={sort.orderDir} onClick={() => sort.requestSort("userType")}>
                  Tipo
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">Azioni</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ py: 0.5 }} />
              <TableCell sx={{ py: 0.5 }}>
                <ClearableTextField size="small" variant="standard" placeholder="Cerca nome..." value={filters.fullName} onChange={(e) => updateFilter("fullName", e.target.value)} fullWidth />
              </TableCell>
              <TableCell sx={{ py: 0.5 }}>
                <ClearableTextField size="small" variant="standard" placeholder="Cerca email..." value={filters.email} onChange={(e) => updateFilter("email", e.target.value)} fullWidth />
              </TableCell>
              <TableCell sx={{ py: 0.5 }} />
              <TableCell sx={{ py: 0.5 }}>
                <TextField select size="small" variant="standard" value={filters.userType} onChange={(e) => updateFilter("userType", e.target.value)} fullWidth SelectProps={{ displayEmpty: true }}>
                  <MenuItem value="">Tutti</MenuItem>
                  <MenuItem value="UTENTE">Utente</MenuItem>
                  <MenuItem value="ADMIN">Amministratore</MenuItem>
                  <MenuItem value="SUPERADMIN">Super Amministratore</MenuItem>
                </TextField>
              </TableCell>
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
            {sort.sorted.map((u: any) => (
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
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    {hasActiveFilters ? "Nessun utente trovato con questi filtri." : "Nessun utente creato."}
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
