import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Drawer,
  Box,
  Stack,
  Typography,
  Chip,
  Divider,
  TextField,
  MenuItem,
  Button,
  IconButton,
  CircularProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import dayjs from "dayjs";
import { api } from "../../api/client";
import { ClearableTextField } from "../../components/ClearableTextField";

const STATUS_OPTIONS = [
  { value: "APERTO", label: "Aperto" },
  { value: "IN_LAVORAZIONE", label: "In lavorazione" },
  { value: "RISOLTO", label: "Risolto" },
  { value: "CHIUSO", label: "Chiuso" },
];

const PRIORITY_COLOR: Record<string, any> = { BASSA: "default", MEDIA: "info", ALTA: "warning", URGENTE: "error" };

export function TicketDrawer({ ticketId, onClose }: { ticketId: string | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");

  const { data: ticket } = useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: async () => (await api.get(`/tickets/${ticketId}`)).data,
    enabled: !!ticketId,
  });

  const { data: companyUsers } = useQuery({
    queryKey: ["company-users"],
    queryFn: async () => (await api.get("/companies/users")).data,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] });
    queryClient.invalidateQueries({ queryKey: ["tickets"] });
  }

  const statusMutation = useMutation({
    mutationFn: async (status: string) => api.put(`/tickets/${ticketId}/status`, { status }),
    onSuccess: invalidate,
  });

  const assignMutation = useMutation({
    mutationFn: async (assignedToId: string) => api.put(`/tickets/${ticketId}/assign`, { assignedToId: assignedToId || null }),
    onSuccess: invalidate,
  });

  const commentMutation = useMutation({
    mutationFn: async () => api.post(`/tickets/${ticketId}/comments`, { body: comment }),
    onSuccess: () => {
      setComment("");
      invalidate();
    },
  });

  return (
    <Drawer anchor="right" open={!!ticketId} onClose={onClose} PaperProps={{ sx: { width: 440 } }}>
      {ticket && (
        <Box sx={{ p: 3, overflowY: "auto" }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="h6" className="mono">
              {ticket.code}
            </Typography>
            <IconButton size="small" onClick={onClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>

          <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
            {ticket.subject}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <Chip size="small" label={ticket.categoryName ?? "Nessun ramo"} />
            <Chip size="small" label={ticket.priority} color={PRIORITY_COLOR[ticket.priority]} />
          </Stack>

          {ticket.customerName && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Aperto da {ticket.customerName}
              {ticket.customerEmail ? ` — ${ticket.customerEmail}` : ""} (esterno)
            </Typography>
          )}

          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <TextField
              select
              label="Stato"
              size="small"
              fullWidth
              value={ticket.status}
              onChange={(e) => statusMutation.mutate(e.target.value)}
            >
              {STATUS_OPTIONS.map((s) => (
                <MenuItem key={s.value} value={s.value}>
                  {s.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Assegnato a"
              size="small"
              fullWidth
              value={ticket.assignedToId ?? ""}
              onChange={(e) => assignMutation.mutate(e.target.value)}
            >
              <MenuItem value="">Nessuno</MenuItem>
              {(companyUsers ?? []).map((u: any) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.fullName}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          {ticket.description && (
            <Box sx={{ mb: 2, p: 1.5, background: "rgba(127,184,217,0.06)", borderRadius: 1 }}>
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                {ticket.description}
              </Typography>
            </Box>
          )}

          <Divider sx={{ mb: 2 }} />

          <Typography variant="overline" color="text.secondary">
            Commenti
          </Typography>
          <Stack spacing={1.5} sx={{ mt: 1, mb: 2 }}>
            {ticket.comments.map((c: any) => (
              <Box key={c.id} sx={{ borderLeft: "2px solid rgba(127,184,217,0.3)", pl: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  {c.authorName} · {dayjs(c.createdAt).format("DD/MM HH:mm")}
                </Typography>
                <Typography variant="body2">{c.body}</Typography>
              </Box>
            ))}
            {ticket.comments.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                Nessun commento.
              </Typography>
            )}
          </Stack>

          <ClearableTextField
            placeholder="Scrivi un commento..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            fullWidth
            multiline
            minRows={2}
          />
          <Button
            sx={{ mt: 1 }}
            variant="outlined"
            disabled={!comment || commentMutation.isPending}
            onClick={() => commentMutation.mutate()}
            startIcon={commentMutation.isPending ? <CircularProgress size={14} /> : undefined}
          >
            Invia
          </Button>
        </Box>
      )}
    </Drawer>
  );
}
