import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Stack,
  Typography,
  Chip,
  Paper,
  Button,
  TextField,
  Divider,
  IconButton,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
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

export function InstanceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  const { data: instance } = useQuery({
    queryKey: ["instance", id],
    queryFn: async () => (await api.get(`/instances/${id}`)).data,
    enabled: !!id,
    refetchInterval: 4000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["instance", id] });

  const decisionMutation = useMutation({
    mutationFn: async ({ taskId, decision }: { taskId: string; decision: "approve" | "reject" }) =>
      api.post(`/instances/${id}/tasks/${taskId}/decision`, { decision }),
    onSuccess: invalidate,
  });

  const completeMutation = useMutation({
    mutationFn: async (taskId: string) => api.post(`/instances/${id}/tasks/${taskId}/complete`),
    onSuccess: invalidate,
  });

  const formMutation = useMutation({
    mutationFn: async (taskId: string) => api.post(`/instances/${id}/tasks/${taskId}/form`, { values: formValues }),
    onSuccess: () => {
      setFormValues({});
      invalidate();
    },
  });

  const commentMutation = useMutation({
    mutationFn: async () => api.post(`/instances/${id}/comments`, { body: comment }),
    onSuccess: () => {
      setComment("");
      invalidate();
    },
  });

  const currentNode = useMemo(() => {
    if (!instance) return null;
    const nodes = JSON.parse(instance.workflowVersion.nodesJson);
    return nodes.find((n: any) => n.id === instance.currentNodeId) ?? null;
  }, [instance]);

  const openTask = useMemo(() => instance?.tasks?.find((t: any) => t.status === "APERTO"), [instance]);

  if (!instance) return null;

  return (
    <Box sx={{ p: 3, display: "flex", gap: 3, alignItems: "flex-start" }}>
      <Box sx={{ flex: 1, minWidth: 0, maxWidth: 640 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <IconButton size="small" onClick={() => navigate("/workflow/instances")}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Typography variant="h5" className="mono">
            {instance.code}
          </Typography>
          <Chip size="small" label={instance.status} color={STATUS_COLOR[instance.status]} />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {instance.workflow.name}
        </Typography>

        {/* Task corrente */}
        {openTask && (
          <Paper sx={{ p: 2.5, mb: 3 }}>
            <Typography variant="overline" color="primary">
              Attivita' in corso
            </Typography>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {openTask.nodeLabel}
            </Typography>

            {openTask.nodeType === "form" && (
              <Stack spacing={2}>
                {(currentNode?.data?.config?.fields ?? []).map((f: any) => (
                  <TextField
                    key={f.id}
                    label={f.label}
                    multiline={f.type === "textarea"}
                    type={f.type === "numero" || f.type === "valuta" ? "number" : "text"}
                    value={formValues[f.id] ?? ""}
                    onChange={(e) => setFormValues((v) => ({ ...v, [f.id]: e.target.value }))}
                    fullWidth
                  />
                ))}
                <Button variant="contained" onClick={() => formMutation.mutate(openTask.id)} disabled={formMutation.isPending}>
                  Invia form
                </Button>
              </Stack>
            )}

            {(openTask.nodeType === "approval" || openTask.nodeType === "ai") && (
              <Stack direction="row" spacing={1.5}>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<CheckIcon />}
                  onClick={() => decisionMutation.mutate({ taskId: openTask.id, decision: "approve" })}
                >
                  Approva
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<CloseIcon />}
                  onClick={() => decisionMutation.mutate({ taskId: openTask.id, decision: "reject" })}
                >
                  Rifiuta
                </Button>
              </Stack>
            )}

            {openTask.nodeType === "upload" && (
              <Button variant="contained" onClick={() => completeMutation.mutate(openTask.id)} disabled={completeMutation.isPending}>
                Simula caricamento allegato
              </Button>
            )}
          </Paper>
        )}

        {!openTask && instance.status === "COMPLETATO" && (
          <Paper sx={{ p: 2.5, mb: 3, borderColor: "success.main" }}>
            <Typography variant="body2">Processo completato.</Typography>
          </Paper>
        )}

        {/* Commenti */}
        <Paper sx={{ p: 2.5 }}>
          <Typography variant="overline" color="text.secondary">
            Commenti
          </Typography>
          <Stack spacing={1.5} sx={{ my: 1.5 }}>
            {instance.comments.map((c: any) => (
              <Box key={c.id}>
                <Typography variant="caption" color="text.secondary">
                  {c.author.fullName} · {dayjs(c.createdAt).format("DD/MM HH:mm")}
                </Typography>
                <Typography variant="body2">{c.body}</Typography>
              </Box>
            ))}
            {instance.comments.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                Nessun commento.
              </Typography>
            )}
          </Stack>
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              placeholder="Scrivi un commento..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              fullWidth
            />
            <Button variant="outlined" disabled={!comment || commentMutation.isPending} onClick={() => commentMutation.mutate()}>
              Invia
            </Button>
          </Stack>
        </Paper>
      </Box>

      {/* Timeline / audit log */}
      <Paper sx={{ width: 340, flexShrink: 0, p: 2.5 }}>
        <Typography variant="overline" color="text.secondary">
          Timeline
        </Typography>
        <Stack spacing={1.5} sx={{ mt: 1.5 }}>
          {instance.auditLogs.map((log: any) => (
            <Box key={log.id} sx={{ borderLeft: "2px solid var(--blueprint-line)", pl: 1.5 }}>
              <Typography variant="caption" color="text.secondary" className="mono">
                {dayjs(log.createdAt).format("HH:mm:ss")}
              </Typography>
              <Typography variant="body2">{log.action}</Typography>
              {log.user && (
                <Typography variant="caption" color="text.secondary">
                  {log.user.fullName}
                </Typography>
              )}
            </Box>
          ))}
        </Stack>

        {instance.aiDecisions.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="overline" color="text.secondary">
              Decisioni AI
            </Typography>
            <Stack spacing={1.5} sx={{ mt: 1.5 }}>
              {instance.aiDecisions.map((d: any) => (
                <Box key={d.id}>
                  <Typography variant="body2">
                    {d.suggestion} — {Math.round(d.confidence * 100)}%
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {d.autoApplied ? "Applicata automaticamente" : "Inviata a un responsabile"}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </>
        )}
      </Paper>
    </Box>
  );
}
