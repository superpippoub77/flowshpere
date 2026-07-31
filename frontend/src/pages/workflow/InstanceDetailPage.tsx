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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import dayjs from "dayjs";
import { api } from "../../api/client";
import { useAuthStore } from "../../store/authStore";
import {
  StepDots,
  computeMainSequence,
  computeStepStatuses,
  stepStatusLabel,
  FlowNode,
} from "./StepDots";

const STATUS_COLOR: Record<string, any> = {
  BOZZA: "default",
  IN_CORSO: "info",
  IN_ATTESA: "warning",
  APPROVATO: "success",
  RIFIUTATO: "error",
  COMPLETATO: "success",
  ANNULLATO: "default",
};

function canActOnNode(node: FlowNode, userId: string, roleKey: string, creatorId: string): boolean {
  if (roleKey === "SUPERVISOR" || roleKey === "SUPER_ADMIN") return true;
  const responsibleIds: string[] = node.data?.config?.responsibleUserIds ?? [];
  if (responsibleIds.length > 0) return responsibleIds.includes(userId);
  if (["form", "upload"].includes(node.type)) return roleKey === "ADMIN" || userId === creatorId;
  return roleKey === "ADMIN";
}

export function InstanceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [decisionComment, setDecisionComment] = useState("");
  const [dialogNode, setDialogNode] = useState<{ node: FlowNode; index: number } | null>(null);

  const user = useAuthStore((s) => s.user);
  const companies = useAuthStore((s) => s.companies);
  const currentCompanyId = useAuthStore((s) => s.currentCompanyId);
  const roleKey = companies.find((c) => c.id === currentCompanyId)?.roleKey ?? "";

  const { data: instance } = useQuery({
    queryKey: ["instance", id],
    queryFn: async () => (await api.get(`/instances/${id}`)).data,
    enabled: !!id,
    refetchInterval: 4000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["instance", id] });

  const decisionMutation = useMutation({
    mutationFn: async ({ taskId, decision, comment }: { taskId: string; decision: "approve" | "reject"; comment: string }) =>
      api.post(`/instances/${id}/tasks/${taskId}/decision`, { decision, comment }),
    onSuccess: () => {
      setDecisionComment("");
      setDialogNode(null);
      invalidate();
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (taskId: string) => api.post(`/instances/${id}/tasks/${taskId}/complete`),
    onSuccess: () => {
      setDialogNode(null);
      invalidate();
    },
  });

  const formMutation = useMutation({
    mutationFn: async (taskId: string) => api.post(`/instances/${id}/tasks/${taskId}/form`, { values: formValues }),
    onSuccess: () => {
      setFormValues({});
      setDialogNode(null);
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

  const nodes: FlowNode[] = useMemo(() => (instance ? JSON.parse(instance.workflowVersion.nodesJson) : []), [instance]);
  const edges = useMemo(() => (instance ? JSON.parse(instance.workflowVersion.edgesJson) : []), [instance]);
  const sequence = useMemo(() => computeMainSequence(nodes, edges), [nodes, edges]);
  const statuses = useMemo(
    () => (instance ? computeStepStatuses(sequence, instance.tasks, instance.currentNodeId, instance.status) : []),
    [sequence, instance]
  );

  if (!instance) return null;

  function openStep(node: FlowNode, index: number) {
    setFormValues({});
    setDecisionComment("");
    setDialogNode({ node, index });
  }

  const dialogIsActive = dialogNode && instance.currentNodeId === dialogNode.node.id;
  const dialogTasks = dialogNode ? instance.tasks.filter((t: any) => t.nodeId === dialogNode.node.id) : [];
  const openTask = dialogTasks.find((t: any) => t.status === "APERTO");
  const authorized = dialogNode && user ? canActOnNode(dialogNode.node, user.id, roleKey, instance.createdById) : false;

  // audit log fino a questo step (in base all'ultimo aggiornamento del task, o ad ora se e' quello attivo)
  const cutoff = openTask ? null : dialogTasks[dialogTasks.length - 1]?.resolvedAt;
  const relevantAudit = instance.auditLogs.filter((l: any) => !cutoff || l.createdAt <= cutoff);

  return (
    <Box sx={{ p: 3, display: "flex", gap: 3, alignItems: "flex-start" }}>
      <Box sx={{ flex: 1, minWidth: 0, maxWidth: 720 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <IconButton size="small" onClick={() => navigate("/workflow/instances")}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Typography variant="h5" className="mono">
            {instance.code}
          </Typography>
          <Chip size="small" label={instance.status} color={STATUS_COLOR[instance.status]} />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {instance.workflow.name}
        </Typography>

        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="overline" color="text.secondary" sx={{ px: 0.5 }}>
            Andamento del processo
          </Typography>
          <StepDots sequence={sequence} statuses={statuses} onSelect={openStep} />
        </Paper>

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

      {/* Timeline / audit log completo */}
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

      {/* Dialog dettaglio step */}
      <Dialog open={!!dialogNode} onClose={() => setDialogNode(null)} fullWidth maxWidth="sm">
        {dialogNode && (
          <>
            <DialogTitle>
              Passo {dialogNode.index + 1}: {dialogNode.node.data.label}
            </DialogTitle>
            <DialogContent>
              <Typography variant="overline" color="text.secondary">
                Storico dei tentativi
              </Typography>
              <Stack spacing={1} sx={{ mb: 2, mt: 1 }}>
                {dialogTasks.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    Passo non ancora raggiunto.
                  </Typography>
                )}
                {dialogTasks.map((t: any) => (
                  <Box key={t.id} sx={{ borderLeft: "2px solid rgba(127,184,217,0.3)", pl: 1.5 }}>
                    <Typography variant="body2">
                      {t.status} {t.assignedTo ? `— ${t.assignedTo.fullName}` : ""}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" className="mono">
                      {dayjs(t.createdAt).format("DD/MM HH:mm")}
                      {t.resolvedAt ? ` → ${dayjs(t.resolvedAt).format("DD/MM HH:mm")}` : ""}
                    </Typography>
                  </Box>
                ))}
              </Stack>

              <Typography variant="overline" color="text.secondary">
                Andamento fino a qui
              </Typography>
              <Stack spacing={1} sx={{ mt: 1, mb: 2 }}>
                {relevantAudit.map((l: any) => (
                  <Typography key={l.id} variant="body2" color="text.secondary">
                    <span className="mono">{dayjs(l.createdAt).format("HH:mm:ss")}</span> — {l.action}
                  </Typography>
                ))}
              </Stack>

              <Divider sx={{ mb: 2 }} />

              {!dialogIsActive && (
                <Alert severity="info">Questo passo non e' quello attivo: solo consultabile.</Alert>
              )}

              {dialogIsActive && !authorized && (
                <Alert severity="warning">Non accessibile: non sei tra i responsabili di questo passaggio.</Alert>
              )}

              {dialogIsActive && authorized && openTask?.nodeType === "form" && (
                <Stack spacing={2}>
                  {(dialogNode.node.data.config?.fields ?? []).map((f: any) => (
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
                </Stack>
              )}

              {dialogIsActive && authorized && openTask?.nodeType === "upload" && (
                <Typography variant="body2" color="text.secondary">
                  Simula il caricamento dell'allegato per completare questo passo.
                </Typography>
              )}

              {dialogIsActive && authorized && (openTask?.nodeType === "approval" || openTask?.nodeType === "ai") && (
                <TextField
                  label="Commento (obbligatorio)"
                  value={decisionComment}
                  onChange={(e) => setDecisionComment(e.target.value)}
                  fullWidth
                  multiline
                  minRows={2}
                />
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDialogNode(null)}>Chiudi</Button>

              {dialogIsActive && authorized && openTask?.nodeType === "form" && (
                <Button variant="contained" onClick={() => formMutation.mutate(openTask.id)} disabled={formMutation.isPending}>
                  Invia form
                </Button>
              )}

              {dialogIsActive && authorized && openTask?.nodeType === "upload" && (
                <Button variant="contained" onClick={() => completeMutation.mutate(openTask.id)} disabled={completeMutation.isPending}>
                  Simula caricamento
                </Button>
              )}

              {dialogIsActive && authorized && (openTask?.nodeType === "approval" || openTask?.nodeType === "ai") && (
                <>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<CloseIcon />}
                    disabled={!decisionComment || decisionMutation.isPending}
                    onClick={() => decisionMutation.mutate({ taskId: openTask.id, decision: "reject", comment: decisionComment })}
                  >
                    Rifiuta
                  </Button>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<CheckIcon />}
                    disabled={!decisionComment || decisionMutation.isPending}
                    onClick={() => decisionMutation.mutate({ taskId: openTask.id, decision: "approve", comment: decisionComment })}
                  >
                    Approva
                  </Button>
                </>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
