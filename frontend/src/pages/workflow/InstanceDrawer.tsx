import { useEffect, useMemo, useState } from "react";
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
  Drawer,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CloseIcon from "@mui/icons-material/Close";
import CheckIcon from "@mui/icons-material/Check";
import CancelIcon from "@mui/icons-material/Cancel";
import dayjs from "dayjs";
import { api } from "../../api/client";
import { useAuthStore } from "../../store/authStore";
import { computeMainSequence, FlowNode } from "./StepDots";
import { RichTextEditor } from "./RichTextEditor";
import { AttachmentDropzone } from "./AttachmentDropzone";
import { CustomerAutocomplete } from "../../components/CustomerAutocomplete";
import { ClearableTextField } from "../../components/ClearableTextField";

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

export function InstanceDrawer({
  instanceId,
  onClose,
  initialNodeId,
  drawerVisible,
}: {
  instanceId: string | null;
  onClose: () => void;
  initialNodeId?: string | null;
  drawerVisible?: boolean;
}) {
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [stepComment, setStepComment] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [decisionComment, setDecisionComment] = useState("");
  const [dialogNode, setDialogNode] = useState<{ node: FlowNode; index: number } | null>(null);

  const user = useAuthStore((s) => s.user);
  const companies = useAuthStore((s) => s.companies);
  const currentCompanyId = useAuthStore((s) => s.currentCompanyId);
  const roleKey = companies.find((c) => c.id === currentCompanyId)?.roleKey ?? "";

  const { data: instance } = useQuery({
    queryKey: ["instance", instanceId],
    queryFn: async () => (await api.get(`/instances/${instanceId}`)).data,
    enabled: !!instanceId,
    refetchInterval: 4000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["instance", instanceId] });
    queryClient.invalidateQueries({ queryKey: ["instances"] });
  };

  const decisionMutation = useMutation({
    mutationFn: async ({ taskId, decision, comment }: { taskId: string; decision: "approve" | "reject"; comment: string }) =>
      api.post(`/instances/${instanceId}/tasks/${taskId}/decision`, { decision, comment }),
    onSuccess: () => {
      setDecisionComment("");
      setDialogNode(null);
      setActionError(null);
      invalidate();
    },
    onError: (err: any) => setActionError(err?.response?.data?.error || "Azione non riuscita"),
  });

  const completeMutation = useMutation({
    mutationFn: async (taskId: string) => api.post(`/instances/${instanceId}/tasks/${taskId}/complete`),
    onSuccess: () => {
      setDialogNode(null);
      setActionError(null);
      invalidate();
    },
    onError: (err: any) => setActionError(err?.response?.data?.error || "Azione non riuscita"),
  });

  const formMutation = useMutation({
    mutationFn: async (taskId: string) => api.post(`/instances/${instanceId}/tasks/${taskId}/form`, { values: formValues }),
    onSuccess: () => {
      setFormValues({});
      setDialogNode(null);
      setActionError(null);
      invalidate();
    },
    onError: (err: any) => setActionError(err?.response?.data?.error || "Azione non riuscita"),
  });

  const commentMutation = useMutation({
    mutationFn: async () => api.post(`/instances/${instanceId}/comments`, { body: comment }),
    onSuccess: () => {
      setComment("");
      invalidate();
    },
  });

  const stepCommentMutation = useMutation({
    mutationFn: async (nodeId: string) => api.post(`/instances/${instanceId}/comments`, { body: stepComment, nodeId }),
    onSuccess: () => {
      setStepComment("");
      invalidate();
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ nodeId, fileName, mimeType, dataBase64 }: { nodeId: string; fileName: string; mimeType: string; dataBase64: string }) =>
      api.post(`/instances/${instanceId}/attachments`, { nodeId, fileName, mimeType, dataBase64 }),
    onSuccess: invalidate,
  });

  const nodes: FlowNode[] = useMemo(() => (instance ? JSON.parse(instance.workflowVersion.nodesJson) : []), [instance]);
  const edges = useMemo(() => (instance ? JSON.parse(instance.workflowVersion.edgesJson) : []), [instance]);
  const sequence = useMemo(() => computeMainSequence(nodes, edges), [nodes, edges]);

  function openStep(node: FlowNode, index: number) {
    setFormValues({});
    setDecisionComment("");
    setStepComment("");
    setActionError(null);
    setDialogNode({ node, index });
  }

  useEffect(() => {
    if (instance && initialNodeId) {
      const idx = sequence.findIndex((n) => n.id === initialNodeId);
      const node = sequence[idx];
      if (node) openStep(node, idx);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance?.id, initialNodeId]);

  const dialogIsActive = dialogNode && instance && instance.currentNodeId === dialogNode.node.id;
  const dialogTasks = dialogNode && instance ? instance.tasks.filter((t: any) => t.nodeId === dialogNode.node.id) : [];
  const openTask = dialogTasks.find((t: any) => t.status === "APERTO");
  const authorized = dialogNode && user && instance ? canActOnNode(dialogNode.node, user.id, roleKey, instance.createdById) : false;
  const readAllowed = dialogTasks.length === 0 || dialogTasks[0].canRead !== false;
  const cutoff = openTask ? null : dialogTasks[dialogTasks.length - 1]?.resolvedAt;
  const relevantAudit = instance ? instance.auditLogs.filter((l: any) => !cutoff || l.createdAt <= cutoff) : [];
  const stepComments = dialogNode && instance ? instance.comments.filter((c: any) => c.nodeId === dialogNode.node.id) : [];
  const stepAttachments = dialogNode && instance ? instance.attachments.filter((a: any) => a.nodeId === dialogNode.node.id) : [];

  return (
    <>
    <Drawer anchor="right" open={!!drawerVisible} onClose={onClose} PaperProps={{ sx: { width: 460 } }}>
      {instance && (
        <Box sx={{ p: 3, overflowY: "auto" }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="h6" className="mono">
                {instance.code}
              </Typography>
              <Chip size="small" label={instance.status} color={STATUS_COLOR[instance.status]} />
            </Stack>
            <IconButton size="small" onClick={onClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {instance.workflow.name}
          </Typography>

          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="overline" color="text.secondary">
              Timeline
            </Typography>
            <Stack spacing={1.2} sx={{ mt: 1, maxHeight: 220, overflowY: "auto" }}>
              {instance.auditLogs.map((log: any) => (
                <Box key={log.id} sx={{ borderLeft: "2px solid var(--blueprint-line)", pl: 1.5 }}>
                  <Typography variant="caption" color="text.secondary" className="mono">
                    {dayjs(log.createdAt).format("DD/MM HH:mm:ss")}
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
                <Divider sx={{ my: 1.5 }} />
                <Typography variant="overline" color="text.secondary">
                  Decisioni AI
                </Typography>
                <Stack spacing={1} sx={{ mt: 1 }}>
                  {instance.aiDecisions.map((d: any) => (
                    <Typography key={d.id} variant="body2" color="text.secondary">
                      {d.suggestion} — {Math.round(d.confidence * 100)}% ({d.autoApplied ? "automatica" : "inviata a un responsabile"})
                    </Typography>
                  ))}
                </Stack>
              </>
            )}
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Typography variant="overline" color="text.secondary">
              Commenti
            </Typography>
            <Stack spacing={1.2} sx={{ my: 1.2 }}>
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
              <ClearableTextField
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
      )}
    </Drawer>

      {/* Dialog dettaglio/azione step */}
      <Dialog open={!!dialogNode} onClose={() => setDialogNode(null)} fullWidth maxWidth="sm">
        {dialogNode && instance && (
          <>
            <DialogTitle>
              Passo {dialogNode.index + 1}: {dialogNode.node.data.label}
            </DialogTitle>
            <DialogContent>
              {!readAllowed && <Alert severity="warning">Non hai i permessi di lettura per questo passaggio.</Alert>}

              {readAllowed && (
                <>
                  {dialogNode.node.data.config?.description && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                      {dialogNode.node.data.config.description}
                    </Alert>
                  )}

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

                  <Accordion disableGutters sx={{ mb: 1.5, "&:before": { display: "none" } }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="overline" color="text.secondary">
                        Commenti su questo passo{stepComments.length > 0 ? ` (${stepComments.length})` : ""}
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Stack spacing={1} sx={{ mb: 1.5 }}>
                        {stepComments.map((c: any) => (
                          <Box key={c.id} sx={{ borderLeft: "2px solid rgba(127,184,217,0.3)", pl: 1.5 }}>
                            <Typography variant="caption" color="text.secondary">
                              {c.author.fullName} · {dayjs(c.createdAt).format("DD/MM HH:mm")}
                            </Typography>
                            <Box sx={{ fontSize: 14 }} dangerouslySetInnerHTML={{ __html: c.body }} />
                          </Box>
                        ))}
                        {stepComments.length === 0 && (
                          <Typography variant="body2" color="text.secondary">
                            Nessun commento su questo passo.
                          </Typography>
                        )}
                      </Stack>
                      <RichTextEditor key={`comment-${dialogNode.node.id}`} value={stepComment} onChange={setStepComment} placeholder="Scrivi un commento su questo passo..." />
                      <Button
                        size="small"
                        sx={{ mt: 1 }}
                        disabled={!stepComment || stepCommentMutation.isPending}
                        onClick={() => stepCommentMutation.mutate(dialogNode.node.id)}
                      >
                        Salva commento
                      </Button>
                    </AccordionDetails>
                  </Accordion>

                  <Accordion disableGutters sx={{ mb: 2, "&:before": { display: "none" } }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="overline" color="text.secondary">
                        Allegati di questo passo{stepAttachments.length > 0 ? ` (${stepAttachments.length})` : ""}
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <AttachmentDropzone
                        attachments={stepAttachments}
                        companyId={currentCompanyId ?? ""}
                        uploading={uploadMutation.isPending}
                        onUpload={(file) => uploadMutation.mutate({ nodeId: dialogNode.node.id, ...file })}
                      />
                    </AccordionDetails>
                  </Accordion>

                  <Divider sx={{ mb: 2 }} />

                  {!dialogIsActive && <Alert severity="info">Questo passo non e' quello attivo: solo consultabile.</Alert>}

                  {dialogIsActive && !authorized && (
                    <Alert severity="warning">Non accessibile: non sei tra i responsabili di questo passaggio.</Alert>
                  )}

                  {actionError && (
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>
                      {actionError}
                    </Alert>
                  )}

                  {dialogIsActive && authorized && openTask?.nodeType === "form" && (
                    <Stack spacing={2}>
                      {(dialogNode.node.data.config?.fields ?? []).map((f: any) =>
                        f.type === "anagrafica" ? (
                          <CustomerAutocomplete
                            key={f.id}
                            label={f.label}
                            value={formValues[f.id] ?? ""}
                            onChange={(name) => setFormValues((v) => ({ ...v, [f.id]: name }))}
                          />
                        ) : (
                          <ClearableTextField
                            key={f.id}
                            label={f.label}
                            multiline={f.type === "textarea"}
                            type={f.type === "numero" || f.type === "valuta" ? "number" : "text"}
                            value={formValues[f.id] ?? ""}
                            onChange={(e) => setFormValues((v) => ({ ...v, [f.id]: e.target.value }))}
                            fullWidth
                          />
                        )
                      )}
                    </Stack>
                  )}

                  {dialogIsActive && authorized && openTask?.nodeType === "upload" && (
                    <Typography variant="body2" color="text.secondary">
                      Simula il caricamento dell'allegato per completare questo passo.
                    </Typography>
                  )}

                  {dialogIsActive && authorized && (openTask?.nodeType === "approval" || openTask?.nodeType === "ai") && (
                    <ClearableTextField
                      label="Commento (obbligatorio)"
                      value={decisionComment}
                      onChange={(e) => setDecisionComment(e.target.value)}
                      fullWidth
                      multiline
                      minRows={2}
                    />
                  )}
                </>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDialogNode(null)}>Chiudi</Button>

              {readAllowed && dialogIsActive && authorized && openTask?.nodeType === "form" && (
                <Button variant="contained" onClick={() => formMutation.mutate(openTask.id)} disabled={formMutation.isPending}>
                  Invia form
                </Button>
              )}

              {readAllowed && dialogIsActive && authorized && openTask?.nodeType === "upload" && (
                <Button variant="contained" onClick={() => completeMutation.mutate(openTask.id)} disabled={completeMutation.isPending}>
                  Simula caricamento
                </Button>
              )}

              {readAllowed && dialogIsActive && authorized && (openTask?.nodeType === "approval" || openTask?.nodeType === "ai") && (
                <>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<CancelIcon />}
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
    </>
  );
}
