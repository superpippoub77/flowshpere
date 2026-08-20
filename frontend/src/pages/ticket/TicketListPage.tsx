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
  Pagination,
  Grid,
  CircularProgress,
  TableSortLabel,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import dayjs from "dayjs";
import { api } from "../../api/client";
import { ClearableTextField } from "../../components/ClearableTextField";
import { useSort } from "../../hooks/useSort";
import { TicketDrawer } from "./TicketDrawer";

const STATUS_LABEL: Record<string, { label: string; color: any }> = {
  APERTO: { label: "Aperto", color: "info" },
  IN_LAVORAZIONE: { label: "In lavorazione", color: "warning" },
  RISOLTO: { label: "Risolto", color: "success" },
  CHIUSO: { label: "Chiuso", color: "default" },
};

const PRIORITY_LABEL: Record<string, { label: string; color: any }> = {
  BASSA: { label: "Bassa", color: "default" },
  MEDIA: { label: "Media", color: "info" },
  ALTA: { label: "Alta", color: "warning" },
  URGENTE: { label: "Urgente", color: "error" },
};

export function TicketListPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ code: "", categoryId: "", status: "", priority: "" });
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [priority, setPriority] = useState("MEDIA");

  const { data: categories } = useQuery({
    queryKey: ["ticket-categories"],
    queryFn: async () => (await api.get("/ticket-categories")).data,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["tickets", filters, page],
    queryFn: async () => (await api.get("/tickets", { ...filters, page })).data,
    refetchInterval: 8000,
  });

  const items = data?.items ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const sort = useSort(items);

  const createMutation = useMutation({
    mutationFn: async () => (await api.post("/tickets", { subject, description, categoryId: categoryId || undefined, priority })).data,
    onSuccess: (ticket) => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      setOpen(false);
      setSubject("");
      setDescription("");
      setCategoryId("");
      setPriority("MEDIA");
      setDrawerId(ticket.id);
    },
  });

  function updateFilter(key: string, value: string) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Stack spacing={0.3}>
          <Typography variant="overline" color="primary">
            TICKET
          </Typography>
          <Typography variant="h5">Gestione Ticket</Typography>
        </Stack>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
          Nuovo ticket
        </Button>
      </Stack>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={6} sm={3}>
            <ClearableTextField label="N. ticket" size="small" fullWidth value={filters.code} onChange={(e) => updateFilter("code", e.target.value)} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField select label="Ramo" size="small" fullWidth value={filters.categoryId} onChange={(e) => updateFilter("categoryId", e.target.value)}>
              <MenuItem value="">Tutti</MenuItem>
              {(categories ?? []).map((c: any) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField select label="Stato" size="small" fullWidth value={filters.status} onChange={(e) => updateFilter("status", e.target.value)}>
              <MenuItem value="">Tutti</MenuItem>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <MenuItem key={k} value={k}>
                  {v.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField select label="Priorità" size="small" fullWidth value={filters.priority} onChange={(e) => updateFilter("priority", e.target.value)}>
              <MenuItem value="">Tutte</MenuItem>
              {Object.entries(PRIORITY_LABEL).map(([k, v]) => (
                <MenuItem key={k} value={k}>
                  {v.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sortDirection={sort.orderBy === "code" ? sort.orderDir : false}>
                <TableSortLabel active={sort.orderBy === "code"} direction={sort.orderDir} onClick={() => sort.requestSort("code")}>
                  N. ticket
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={sort.orderBy === "subject" ? sort.orderDir : false}>
                <TableSortLabel active={sort.orderBy === "subject"} direction={sort.orderDir} onClick={() => sort.requestSort("subject")}>
                  Oggetto
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={sort.orderBy === "categoryName" ? sort.orderDir : false}>
                <TableSortLabel active={sort.orderBy === "categoryName"} direction={sort.orderDir} onClick={() => sort.requestSort("categoryName")}>
                  Ramo
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={sort.orderBy === "priority" ? sort.orderDir : false}>
                <TableSortLabel active={sort.orderBy === "priority"} direction={sort.orderDir} onClick={() => sort.requestSort("priority")}>
                  Priorità
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={sort.orderBy === "status" ? sort.orderDir : false}>
                <TableSortLabel active={sort.orderBy === "status"} direction={sort.orderDir} onClick={() => sort.requestSort("status")}>
                  Stato
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={sort.orderBy === "assignedToName" ? sort.orderDir : false}>
                <TableSortLabel active={sort.orderBy === "assignedToName"} direction={sort.orderDir} onClick={() => sort.requestSort("assignedToName")}>
                  Assegnato a
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={sort.orderBy === "updatedAt" ? sort.orderDir : false}>
                <TableSortLabel active={sort.orderBy === "updatedAt"} direction={sort.orderDir} onClick={() => sort.requestSort("updatedAt")}>
                  Aggiornato
                </TableSortLabel>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sort.sorted.map((t: any) => (
              <TableRow key={t.id} hover onClick={() => setDrawerId(t.id)} sx={{ cursor: "pointer" }}>
                <TableCell className="mono">{t.code}</TableCell>
                <TableCell>{t.subject}</TableCell>
                <TableCell>{t.categoryName ?? "—"}</TableCell>
                <TableCell>
                  <Chip size="small" label={PRIORITY_LABEL[t.priority]?.label ?? t.priority} color={PRIORITY_LABEL[t.priority]?.color} />
                </TableCell>
                <TableCell>
                  <Chip size="small" label={STATUS_LABEL[t.status]?.label ?? t.status} color={STATUS_LABEL[t.status]?.color} />
                </TableCell>
                <TableCell>{t.assignedToName ?? <Typography variant="caption" color="text.secondary">Non assegnato</Typography>}</TableCell>
                <TableCell className="mono">{dayjs(t.updatedAt).format("DD/MM/YYYY HH:mm")}</TableCell>
              </TableRow>
            ))}
            {!isLoading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    Nessun ticket trovato con questi filtri.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      {totalPages > 1 && (
        <Stack alignItems="center" sx={{ mt: 2 }}>
          <Pagination count={totalPages} page={page} onChange={(_, p) => setPage(p)} />
        </Stack>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Nuovo ticket</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <ClearableTextField label="Oggetto" value={subject} onChange={(e) => setSubject(e.target.value)} fullWidth autoFocus />
            <TextField select label="Ramo" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} fullWidth>
              <MenuItem value="">Nessuno</MenuItem>
              {(categories ?? []).map((c: any) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField select label="Priorità" value={priority} onChange={(e) => setPriority(e.target.value)} fullWidth>
              {Object.entries(PRIORITY_LABEL).map(([k, v]) => (
                <MenuItem key={k} value={k}>
                  {v.label}
                </MenuItem>
              ))}
            </TextField>
            <ClearableTextField label="Descrizione" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth multiline minRows={3} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Annulla</Button>
          <Button
            variant="contained"
            disabled={!subject || createMutation.isPending}
            onClick={() => createMutation.mutate()}
            startIcon={createMutation.isPending ? <CircularProgress size={14} color="inherit" /> : undefined}
          >
            Crea
          </Button>
        </DialogActions>
      </Dialog>

      <TicketDrawer ticketId={drawerId} onClose={() => setDrawerId(null)} />
    </Box>
  );
}
