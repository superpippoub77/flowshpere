import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
  MenuItem,
  TextField,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import dayjs from "dayjs";
import { api } from "../../api/client";

const STATUS_COLOR: Record<string, any> = {
  BOZZA: "default",
  IN_CORSO: "info",
  IN_ATTESA: "warning",
  APPROVATO: "success",
  RIFIUTATO: "error",
  COMPLETATO: "success",
  ANNULLATO: "default",
};

export function InstanceListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [workflowId, setWorkflowId] = useState("");

  const { data: instances } = useQuery({
    queryKey: ["instances"],
    queryFn: async () => (await api.get("/instances")).data,
  });

  const { data: workflows } = useQuery({
    queryKey: ["workflows"],
    queryFn: async () => (await api.get("/workflows")).data,
  });

  const publishedWorkflows = (workflows ?? []).filter((w: any) => w.status === "PUBLISHED");

  const createMutation = useMutation({
    mutationFn: async () => (await api.post("/instances", { workflowId })).data,
    onSuccess: (instance) => {
      queryClient.invalidateQueries({ queryKey: ["instances"] });
      setOpen(false);
      navigate(`/workflow/instances/${instance.id}`);
    },
  });

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Stack spacing={0.3}>
          <Typography variant="overline" color="primary">
            RUNTIME
          </Typography>
          <Typography variant="h5">Istanze workflow</Typography>
        </Stack>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
          Nuova istanza
        </Button>
      </Stack>

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Codice</TableCell>
              <TableCell>Workflow</TableCell>
              <TableCell>Stato</TableCell>
              <TableCell>Aggiornata</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(instances ?? []).map((inst: any) => (
              <TableRow key={inst.id} hover sx={{ cursor: "pointer" }} onClick={() => navigate(`/workflow/instances/${inst.id}`)}>
                <TableCell className="mono">{inst.code}</TableCell>
                <TableCell>{inst.workflow?.name}</TableCell>
                <TableCell>
                  <Chip size="small" label={inst.status} color={STATUS_COLOR[inst.status]} />
                </TableCell>
                <TableCell>{dayjs(inst.updatedAt).format("DD/MM/YYYY HH:mm")}</TableCell>
              </TableRow>
            ))}
            {(instances ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={4}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    Nessuna istanza ancora avviata.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Nuova istanza</DialogTitle>
        <DialogContent>
          <TextField
            select
            label="Workflow pubblicato"
            fullWidth
            sx={{ mt: 1 }}
            value={workflowId}
            onChange={(e) => setWorkflowId(e.target.value)}
          >
            {publishedWorkflows.map((w: any) => (
              <MenuItem key={w.id} value={w.id}>
                {w.name}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Annulla</Button>
          <Button variant="contained" disabled={!workflowId || createMutation.isPending} onClick={() => createMutation.mutate()}>
            Avvia
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
