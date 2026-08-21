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
  IconButton,
  Avatar,
} from "@mui/material";
import { DataGrid, GridColDef, GridToolbar, GridFilterModel } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { api, getAvatarUrl } from "../../api/client";
import { AvatarPicker } from "../../components/AvatarPicker";
import { PasswordField } from "../../components/PasswordField";
import { ClearableTextField } from "../../components/ClearableTextField";
import { GridHeaderFilter } from "../../components/GridHeaderFilter";

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
  const [page, setPage] = useState(0);
  const [filterModel, setFilterModel] = useState<GridFilterModel>({ items: [] });

  const { data: usersPage, isFetching } = useQuery({
    queryKey: ["admin-users-table", filterModel, page],
    queryFn: async () => (await api.get("/admin/users/table", { filterModel: JSON.stringify(filterModel), page: page + 1 })).data,
  });
  const users = usersPage?.items ?? [];

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

  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: "avatar_",
        headerName: "",
        width: 56,
        sortable: false,
        filterable: false,
        renderCell: (params) => (
          <Avatar src={params.row.hasAvatar ? getAvatarUrl(params.row.id) : undefined} sx={{ width: 32, height: 32, fontSize: 14 }}>
            {params.row.fullName?.[0]}
          </Avatar>
        ),
      },
      {
        field: "fullName",
        renderHeader: () => <GridHeaderFilter field="fullName" label="Nome" filterModel={filterModel} setFilterModel={setFilterModel} />,
        flex: 0.9,
        minWidth: 180,
      },
      {
        field: "email",
        renderHeader: () => <GridHeaderFilter field="email" label="Email" filterModel={filterModel} setFilterModel={setFilterModel} />,
        flex: 1,
        minWidth: 200,
      },
      {
        field: "jobTitle",
        headerName: "Telefono / Ruolo",
        flex: 0.8,
        minWidth: 160,
        filterable: false,
        renderCell: (params) => (
          <Box>
            <Typography variant="body2">{params.row.jobTitle || "—"}</Typography>
            <Typography variant="caption" color="text.secondary">
              {params.row.phone || ""}
            </Typography>
          </Box>
        ),
      },
      {
        field: "userType",
        renderHeader: () => (
          <GridHeaderFilter
            field="userType"
            label="Tipo"
            filterModel={filterModel}
            setFilterModel={setFilterModel}
            operator="equals"
            options={Object.entries(TYPE_LABEL).map(([value, v]) => ({ value, label: v.label }))}
          />
        ),
        width: 210,
        renderCell: (params) => <Chip size="small" label={TYPE_LABEL[params.value as string]?.label ?? params.value} color={TYPE_LABEL[params.value as string]?.color} />,
      },
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
    [filterModel, setFilterModel]
  );

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

      <Paper sx={{ height: 560, display: "flex", flexDirection: "column" }}>
        <DataGrid
          rows={users}
          columns={columns}
          loading={isFetching}
          getRowHeight={() => "auto"}
          columnHeaderHeight={64}
          paginationMode="server"
          filterMode="server"
          rowCount={usersPage?.total ?? 0}
          paginationModel={{ page, pageSize: 10 }}
          onPaginationModelChange={(model) => setPage(model.page)}
          filterModel={filterModel}
          onFilterModelChange={setFilterModel}
          pageSizeOptions={[10]}
          disableRowSelectionOnClick
          slots={{ toolbar: GridToolbar }}
          slotProps={{ toolbar: { showQuickFilter: false } }}
          localeText={{ noRowsLabel: "Nessun utente trovato." }}
          sx={{ border: 0 }}
        />
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
