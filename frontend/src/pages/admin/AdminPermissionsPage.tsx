import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Stack, Typography, Paper, TextField, MenuItem, Table, TableContainer, TableHead, TableRow, TableCell, TableBody } from "@mui/material";
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
    mutationFn: async ({ companyId, applicationKey, roleKey }: { companyId: string; applicationKey: string; roleKey: string }) => {
      if (!roleKey) return api.post("/admin/permissions/revoke", { userId, companyId, applicationKey });
      return api.post("/admin/permissions", { userId, companyId, applicationKey, roleKey });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-permissions", userId] }),
  });

  const currentRole = (companyId: string, appKey: string) =>
    perms?.assignments.find((a: any) => a.company_id === companyId && a.app_key === appKey)?.role_key ?? "";

  const categories: string[] = perms ? Array.from(new Set(perms.applications.map((a: any) => a.category))) : [];

  return (
    <Box sx={{ p: 3, maxWidth: 900 }}>
      <Stack spacing={0.3} sx={{ mb: 3 }}>
        <Typography variant="overline" color="primary">
          PERMESSI PER PROGETTO
        </Typography>
        <Typography variant="h5">Visibilita' aziende e ruolo per applicazione</Typography>
        <Typography variant="body2" color="text.secondary">
          Per ogni azienda e ogni applicazione decidi se l'utente la vede e con quale ruolo, indipendentemente dal suo tipo utente generale.
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
        <Stack spacing={3}>
          {categories.map((category) => (
            <Box key={category}>
              <Typography variant="overline" color="text.secondary" sx={{ px: 0.5 }}>
                {category}
              </Typography>
              <Paper sx={{ mt: 1 }}>
                <TableContainer>
        <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Azienda</TableCell>
                      {perms.applications.filter((a: any) => a.category === category).map((a: any) => (
                        <TableCell key={a.app_key}>{a.name}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {perms.companies.map((c: any) => (
                      <TableRow key={c.id} hover>
                        <TableCell>{c.name}</TableCell>
                        {perms.applications.filter((a: any) => a.category === category).map((a: any) => (
                          <TableCell key={a.app_key}>
                            <TextField
                              select
                              size="small"
                              value={currentRole(c.id, a.app_key)}
                              onChange={(e) => setMutation.mutate({ companyId: c.id, applicationKey: a.app_key, roleKey: e.target.value })}
                              sx={{ minWidth: 170 }}
                            >
                              {ROLE_OPTIONS.map((r) => (
                                <MenuItem key={r.value} value={r.value}>
                                  {r.label}
                                </MenuItem>
                              ))}
                            </TextField>
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
      </TableContainer>
              </Paper>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}
