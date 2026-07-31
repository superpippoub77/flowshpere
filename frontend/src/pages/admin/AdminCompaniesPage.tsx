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
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { api } from "../../api/client";

export function AdminCompaniesPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const { data: companies } = useQuery({
    queryKey: ["admin-companies"],
    queryFn: async () => (await api.get("/admin/companies")).data,
  });

  const createMutation = useMutation({
    mutationFn: async () => api.post("/admin/companies", { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-companies"] });
      queryClient.invalidateQueries({ queryKey: ["admin-permissions"] });
      setOpen(false);
      setName("");
    },
  });

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Stack spacing={0.3}>
          <Typography variant="overline" color="primary">
            AZIENDE
          </Typography>
          <Typography variant="h5">Gestione aziende</Typography>
        </Stack>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
          Nuova azienda
        </Button>
      </Stack>

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nome</TableCell>
              <TableCell>Codice</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(companies ?? []).map((c: any) => (
              <TableRow key={c.id} hover>
                <TableCell>{c.name}</TableCell>
                <TableCell className="mono">{c.slug}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Nuova azienda</DialogTitle>
        <DialogContent>
          <TextField label="Nome azienda" value={name} onChange={(e) => setName(e.target.value)} fullWidth sx={{ mt: 1 }} autoFocus />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Annulla</Button>
          <Button variant="contained" disabled={!name || createMutation.isPending} onClick={() => createMutation.mutate()}>
            Crea
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
