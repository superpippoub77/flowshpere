import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Stack,
  Typography,
  Paper,
  Table,
  TableContainer,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TextField,
  MenuItem,
  Grid,
  Pagination,
} from "@mui/material";
import dayjs from "dayjs";
import { api } from "../../api/client";
import { ClearableTextField } from "../../components/ClearableTextField";

export function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ companyId: "", query: "", dateFrom: "", dateTo: "" });

  const { data: companies } = useQuery({
    queryKey: ["admin-companies"],
    queryFn: async () => (await api.get("/admin/companies")).data,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", filters, page],
    queryFn: async () => (await api.get("/admin/audit-logs", { ...filters, page })).data,
  });

  const items = data?.items ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  function updateFilter(key: string, value: string) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={0.3} sx={{ mb: 3 }}>
        <Typography variant="overline" color="primary">
          AMMINISTRAZIONE
        </Typography>
        <Typography variant="h5">Registro attività (Audit Log)</Typography>
        <Typography variant="body2" color="text.secondary">
          Ogni creazione, modifica o cancellazione rilevante nell'applicazione, con chi l'ha fatta e quando.
        </Typography>
      </Stack>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <TextField select label="Azienda" size="small" fullWidth value={filters.companyId} onChange={(e) => updateFilter("companyId", e.target.value)}>
              <MenuItem value="">Tutte (incluse azioni globali)</MenuItem>
              {(companies ?? []).map((c: any) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={4}>
            <ClearableTextField label="Cerca nell'azione" size="small" fullWidth value={filters.query} onChange={(e) => updateFilter("query", e.target.value)} />
          </Grid>
          <Grid item xs={6} sm={2}>
            <TextField label="Dal" type="date" size="small" fullWidth InputLabelProps={{ shrink: true }} value={filters.dateFrom} onChange={(e) => updateFilter("dateFrom", e.target.value)} />
          </Grid>
          <Grid item xs={6} sm={2}>
            <TextField label="Al" type="date" size="small" fullWidth InputLabelProps={{ shrink: true }} value={filters.dateTo} onChange={(e) => updateFilter("dateTo", e.target.value)} />
          </Grid>
        </Grid>
      </Paper>

      <Paper>
        <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Quando</TableCell>
              <TableCell>Azione</TableCell>
              <TableCell>Azienda</TableCell>
              <TableCell>Utente</TableCell>
              <TableCell>IP</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((l: any) => (
              <TableRow key={l.id} hover>
                <TableCell className="mono">{dayjs(l.createdAt).format("DD/MM/YYYY HH:mm:ss")}</TableCell>
                <TableCell>{l.action}</TableCell>
                <TableCell>{l.companyName ?? <Typography variant="caption" color="text.secondary">Globale</Typography>}</TableCell>
                <TableCell>{l.userName ?? <Typography variant="caption" color="text.secondary">Sistema</Typography>}</TableCell>
                <TableCell className="mono">{l.ip ?? "—"}</TableCell>
              </TableRow>
            ))}
            {!isLoading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    Nessuna voce trovata con questi filtri.
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
    </Box>
  );
}
