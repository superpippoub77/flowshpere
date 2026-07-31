import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Stack, Typography, Paper, TextField, MenuItem, Table, TableHead, TableRow, TableCell, TableBody } from "@mui/material";
import { api } from "../../api/client";

const ROLE_OPTIONS = [
  { value: "", label: "Nessun accesso" },
  { value: "ADMIN", label: "Amministratore" },
  { value: "SUPERVISOR", label: "Supervisore" },
  { value: "OPERATOR", label: "Operatore" },
];

export function AdminPermissionsPage() {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState("");

  const { data: users } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => (await api.get("/admin/users")).data,
  });

  const { data: perms } = useQuery({
    queryKey: ["admin-permissions", userId],
    queryFn: async () => (await api.get("/admin/permissions", { userId })).data,
    enabled: !!userId,
  });

  const setMutation = useMutation({
    mutationFn: async ({ companyId, roleKey }: { companyId: string; roleKey: string }) => {
      if (!roleKey) return api.post("/admin/permissions/revoke", { userId, companyId });
      return api.post("/admin/permissions", { userId, companyId, roleKey });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-permissions", userId] }),
  });

  const currentRole = (companyId: string) =>
    perms?.assignments.find((a: any) => a.company_id === companyId && a.app_key === "workflow")?.role_key ?? "";

  return (
    <Box sx={{ p: 3, maxWidth: 700 }}>
      <Stack spacing={0.3} sx={{ mb: 3 }}>
        <Typography variant="overline" color="primary">
          PERMESSI PER PROGETTO
        </Typography>
        <Typography variant="h5">Visibilita' aziende e ruolo (Workflow)</Typography>
        <Typography variant="body2" color="text.secondary">
          Per ogni azienda puoi decidere se l'utente la vede e con quale ruolo, indipendentemente dal suo tipo utente generale.
        </Typography>
      </Stack>

      <TextField select label="Utente" value={userId} onChange={(e) => setUserId(e.target.value)} sx={{ mb: 3, minWidth: 300 }}>
        {(users ?? []).map((u: any) => (
          <MenuItem key={u.id} value={u.id}>
            {u.fullName} — {u.email}
          </MenuItem>
        ))}
      </TextField>

      {userId && perms && (
        <Paper>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Azienda</TableCell>
                <TableCell>Ruolo per Workflow</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {perms.companies.map((c: any) => (
                <TableRow key={c.id} hover>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>
                    <TextField
                      select
                      size="small"
                      value={currentRole(c.id)}
                      onChange={(e) => setMutation.mutate({ companyId: c.id, roleKey: e.target.value })}
                      sx={{ minWidth: 200 }}
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <MenuItem key={r.value} value={r.value}>
                          {r.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
}
