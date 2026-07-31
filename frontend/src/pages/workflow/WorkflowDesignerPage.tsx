import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ReactFlow, {
  Background,
  Controls,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  Connection,
  Edge,
  Node,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  Box,
  Stack,
  Typography,
  Button,
  TextField,
  MenuItem,
  IconButton,
  Divider,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import SaveIcon from "@mui/icons-material/SaveOutlined";
import { api } from "../../api/client";
import { NODE_PALETTE, nodeTypes } from "./nodeTypes";

const FIELD_TYPES = ["text", "textarea", "numero", "valuta", "data", "checkbox", "select", "radio", "allegato", "firma"];

function DesignerInner() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { project } = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [templateDialog, setTemplateDialog] = useState<{ open: boolean; label: string }>({ open: false, label: "" });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const nodeCounter = useRef(1);

  const { data: workflow } = useQuery({
    queryKey: ["workflow", id],
    queryFn: async () => (await api.get(`/workflows/${id}`)).data,
    enabled: !!id,
  });

  const { data: companyUsers } = useQuery({
    queryKey: ["company-users"],
    queryFn: async () => (await api.get("/companies/users")).data,
  });

  const { data: nodeTemplates } = useQuery({
    queryKey: ["node-templates"],
    queryFn: async () => (await api.get("/node-templates")).data,
  });

  useEffect(() => {
    if (!workflow) return;
    setName(workflow.name);
    setDescription(workflow.description ?? "");
    const latest = workflow.versions[0];
    if (latest) {
      const rawNodes = JSON.parse(latest.nodesJson);
      // Ripara eventuali nodi salvati senza "position" (bug di una versione precedente)
      const fixedNodes = rawNodes.map((n: any, i: number) => ({
        ...n,
        position: n.position && typeof n.position.x === "number" ? n.position : { x: 250, y: 60 + i * 120 },
      }));
      setNodes(fixedNodes);
      setEdges(JSON.parse(latest.edgesJson));
      nodeCounter.current = rawNodes.length + 1;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow]);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge({ ...connection, animated: false }, eds)),
    [setEdges]
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const bounds = wrapperRef.current!.getBoundingClientRect();
      const position = project({ x: event.clientX - bounds.left, y: event.clientY - bounds.top });
      const newId = `node_${Date.now()}_${nodeCounter.current++}`;

      const templateId = event.dataTransfer.getData("application/wf-template-id");
      if (templateId) {
        const template = (nodeTemplates ?? []).find((t: any) => t.id === templateId);
        if (!template) return;
        const newNode: Node = { id: newId, type: template.nodeType, position, data: { label: template.label, config: template.config } };
        setNodes((nds) => nds.concat(newNode));
        return;
      }

      const kind = event.dataTransfer.getData("application/wf-node-kind");
      if (!kind) return;
      const meta = NODE_PALETTE.find((m) => m.kind === kind)!;
      const newNode: Node = {
        id: newId,
        type: kind,
        position,
        data: { label: meta.label, config: kind === "form" ? { fields: [] } : {} },
      };
      setNodes((nds) => nds.concat(newNode));
    },
    [project, setNodes, nodeTemplates]
  );

  const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedId), [nodes, selectedId]);

  function updateSelected(patch: (data: any) => any) {
    setNodes((nds) => nds.map((n) => (n.id === selectedId ? { ...n, data: patch(n.data) } : n)));
  }

  function deleteSelected() {
    setNodes((nds) => nds.filter((n) => n.id !== selectedId));
    setEdges((eds) => eds.filter((e) => e.source !== selectedId && e.target !== selectedId));
    setSelectedId(null);
  }

  const saveMutation = useMutation({
    mutationFn: async () =>
      api.put(`/workflows/${id}/draft`, {
        name,
        description,
        nodes: nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: n.data })),
        edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle })),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workflow", id] }),
  });

  const publishMutation = useMutation({
    mutationFn: async () => api.post(`/workflows/${id}/publish`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workflows"] }),
  });

  const saveTemplateMutation = useMutation({
    mutationFn: async (payload: { nodeType: string; label: string; config: any }) => api.post("/node-templates", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["node-templates"] });
      setTemplateDialog({ open: false, label: "" });
    },
  });

  return (
    <Box sx={{ display: "flex", height: "100%" }}>
      {/* Palette nodi */}
      <Box sx={{ width: 190, borderRight: "1px solid rgba(127,184,217,0.14)", p: 1.5, overflowY: "auto" }}>
        <Typography variant="overline" color="text.secondary" sx={{ px: 0.5 }}>
          Palette
        </Typography>
        <Stack spacing={1} sx={{ mt: 1 }}>
          {NODE_PALETTE.filter((m) => m.kind !== "start" || !nodes.some((n) => n.type === "start")).map((meta) => (
            <Box
              key={meta.kind}
              draggable
              onDragStart={(e) => e.dataTransfer.setData("application/wf-node-kind", meta.kind)}
              sx={{
                border: "1px solid rgba(127,184,217,0.3)",
                borderLeft: `4px solid ${meta.stripe}`,
                borderRadius: 1,
                px: 1.2,
                py: 0.9,
                fontSize: 12.5,
                cursor: "grab",
                userSelect: "none",
                "&:hover": { background: "rgba(127,184,217,0.08)" },
              }}
            >
              {meta.label}
            </Box>
          ))}
        </Stack>

        {(nodeTemplates ?? []).length > 0 && (
          <>
            <Typography variant="overline" color="text.secondary" sx={{ px: 0.5, display: "block", mt: 2.5 }}>
              Blocchi personalizzati
            </Typography>
            <Stack spacing={1} sx={{ mt: 1 }}>
              {(nodeTemplates ?? []).map((tmpl: any) => (
                <Box
                  key={tmpl.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("application/wf-template-id", tmpl.id)}
                  sx={{
                    border: "1px dashed rgba(232,163,61,0.5)",
                    borderRadius: 1,
                    px: 1.2,
                    py: 0.9,
                    fontSize: 12.5,
                    cursor: "grab",
                    userSelect: "none",
                    "&:hover": { background: "rgba(232,163,61,0.08)" },
                  }}
                >
                  {tmpl.label}
                </Box>
              ))}
            </Stack>
          </>
        )}
      </Box>

      {/* Canvas */}
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 2, py: 1, borderBottom: "1px solid rgba(127,184,217,0.14)" }}>
          <IconButton size="small" onClick={() => navigate("/workflow/designer")}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <TextField
            variant="standard"
            value={name}
            onChange={(e) => setName(e.target.value)}
            sx={{ minWidth: 220 }}
            InputProps={{ disableUnderline: true, style: { fontWeight: 700, fontSize: 16 } }}
          />
          {workflow && (
            <Chip size="small" label={workflow.status === "PUBLISHED" ? "Pubblicato" : "Bozza"} color={workflow.status === "PUBLISHED" ? "success" : "default"} />
          )}
          <Box sx={{ flex: 1 }} />
          <Button size="small" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            Salva bozza
          </Button>
          <Button size="small" variant="contained" color="secondary" onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending}>
            Pubblica
          </Button>
        </Stack>

        <Box ref={wrapperRef} sx={{ flex: 1 }} onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
          <ReactFlow
            className="blueprint-canvas"
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onNodeClick={(_, n) => setSelectedId(n.id)}
            onPaneClick={() => setSelectedId(null)}
            fitView
          >
            <Background gap={22} color="rgba(127,184,217,0.16)" />
            <Controls />
          </ReactFlow>
        </Box>
      </Box>

      {/* Pannello proprieta' */}
      <Box sx={{ width: 280, borderLeft: "1px solid rgba(127,184,217,0.14)", p: 2, overflowY: "auto" }}>
        <Typography variant="overline" color="text.secondary">
          Proprieta'
        </Typography>
        {!selectedNode && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Seleziona un nodo per modificarlo, oppure trascina un elemento dalla palette sul canvas.
          </Typography>
        )}
        {selectedNode && (
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField
              label="Etichetta"
              size="small"
              value={selectedNode.data.label}
              onChange={(e) => updateSelected((d) => ({ ...d, label: e.target.value }))}
            />

            {["form", "upload", "approval", "ai"].includes(selectedNode.type ?? "") && (
              <>
                <ResponsibleUsersEditor
                  users={companyUsers ?? []}
                  selected={selectedNode.data.config?.responsibleUserIds ?? []}
                  onChange={(ids) => updateSelected((d) => ({ ...d, config: { ...d.config, responsibleUserIds: ids } }))}
                  allowAI={["approval", "upload"].includes(selectedNode.type ?? "")}
                />
                <ReaderUsersEditor
                  users={companyUsers ?? []}
                  selected={selectedNode.data.config?.readerUserIds ?? []}
                  onChange={(ids) => updateSelected((d) => ({ ...d, config: { ...d.config, readerUserIds: ids } }))}
                />
              </>
            )}

            {selectedNode.type === "form" && (
              <FormFieldsEditor
                fields={selectedNode.data.config?.fields ?? []}
                onChange={(fields) => updateSelected((d) => ({ ...d, config: { ...d.config, fields } }))}
              />
            )}

            {selectedNode.type === "autoDecision" && (
              <RuleEditor
                rule={selectedNode.data.config?.rule ?? { field: "", operator: "gt", value: "" }}
                onChange={(rule) => updateSelected((d) => ({ ...d, config: { ...d.config, rule } }))}
              />
            )}

            {selectedNode.type === "email" && (
              <TextField
                label="Testo notifica"
                size="small"
                multiline
                minRows={3}
                value={selectedNode.data.config?.template ?? ""}
                onChange={(e) => updateSelected((d) => ({ ...d, config: { ...d.config, template: e.target.value } }))}
              />
            )}

            <Divider />
            {["form", "upload", "approval", "ai"].includes(selectedNode.type ?? "") && (
              <Button size="small" startIcon={<SaveIcon />} onClick={() => setTemplateDialog({ open: true, label: selectedNode.data.label })}>
                Salva come blocco personalizzato
              </Button>
            )}
            <Button size="small" color="error" startIcon={<DeleteOutlineIcon />} onClick={deleteSelected}>
              Elimina nodo
            </Button>
          </Stack>
        )}
      </Box>

      <Dialog open={templateDialog.open} onClose={() => setTemplateDialog({ open: false, label: "" })} fullWidth maxWidth="xs">
        <DialogTitle>Salva come blocco personalizzato</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Il blocco sara' disponibile nella palette per tutti quelli che progettano workflow in questa azienda.
          </Typography>
          <TextField
            label="Nome del blocco"
            fullWidth
            autoFocus
            value={templateDialog.label}
            onChange={(e) => setTemplateDialog((s) => ({ ...s, label: e.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemplateDialog({ open: false, label: "" })}>Annulla</Button>
          <Button
            variant="contained"
            disabled={!templateDialog.label || saveTemplateMutation.isPending}
            onClick={() =>
              selectedNode &&
              saveTemplateMutation.mutate({ nodeType: selectedNode.type!, label: templateDialog.label, config: selectedNode.data.config ?? {} })
            }
          >
            Salva
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function ReaderUsersEditor({
  users,
  selected,
  onChange,
}: {
  users: { id: string; fullName: string; role: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="caption" color="text.secondary">
        Lettori (chi puo' vedere questo step)
      </Typography>
      <TextField
        select
        size="small"
        SelectProps={{
          multiple: true,
          value: selected,
          onChange: (e) => onChange(e.target.value as string[]),
          renderValue: (value) =>
            (value as string[]).map((id) => users.find((u) => u.id === id)?.fullName ?? id).join(", "),
        }}
        value={selected}
      >
        {users.map((u) => (
          <MenuItem key={u.id} value={u.id}>
            {u.fullName} — {u.role}
          </MenuItem>
        ))}
      </TextField>
      <Typography variant="caption" color="text.secondary">
        {selected.length === 0
          ? "Nessuna restrizione: lo storico di questo step e' visibile a tutti quelli con accesso all'azienda."
          : `Solo ${selected.length} persona/e (piu' i responsabili) potranno vederne lo storico.`}
      </Typography>
    </Stack>
  );
}

function ResponsibleUsersEditor({
  users,
  selected,
  onChange,
  allowAI,
}: {
  users: { id: string; fullName: string; role: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  allowAI?: boolean;
}) {
  function handleChange(value: string[]) {
    const aiJustPicked = value.includes("AI") && !selected.includes("AI");
    if (aiJustPicked) {
      onChange(["AI"]); // l'AI risolve tutto da sola: non ha senso combinarla con altre persone
      return;
    }
    onChange(value.filter((v) => v !== "AI"));
  }

  return (
    <Stack spacing={0.5}>
      <Typography variant="caption" color="text.secondary">
        Responsabili (chi puo' agire su questo step)
      </Typography>
      <TextField
        select
        size="small"
        SelectProps={{
          multiple: true,
          value: selected,
          onChange: (e) => handleChange(e.target.value as string[]),
          renderValue: (value) =>
            (value as string[])
              .map((id) => (id === "AI" ? "🤖 Intelligenza Artificiale" : users.find((u) => u.id === id)?.fullName ?? id))
              .join(", "),
        }}
        value={selected}
      >
        {allowAI && (
          <MenuItem value="AI">🤖 Intelligenza Artificiale (risolve il passo da sola)</MenuItem>
        )}
        {users.map((u) => (
          <MenuItem key={u.id} value={u.id}>
            {u.fullName} — {u.role}
          </MenuItem>
        ))}
      </TextField>
      <Typography variant="caption" color="text.secondary">
        {selected.length === 1 && selected[0] === "AI"
          ? "L'AI decidera' da sola su questo passo, senza intervento umano."
          : selected.length === 0
          ? "Nessuno assegnato: potranno agire Amministratore/Supervisore (o chi ha creato l'istanza, per i passi di raccolta dati)."
          : `${selected.length} responsabile/i assegnato/i.`}
      </Typography>
    </Stack>
  );
}

function FormFieldsEditor({ fields, onChange }: { fields: any[]; onChange: (f: any[]) => void }) {
  return (
    <Stack spacing={1}>
      <Typography variant="caption" color="text.secondary">
        Campi del form
      </Typography>
      {fields.map((f, i) => (
        <Stack key={i} direction="row" spacing={0.5} alignItems="center">
          <TextField
            size="small"
            placeholder="etichetta"
            value={f.label}
            onChange={(e) => {
              const next = [...fields];
              next[i] = { ...f, label: e.target.value, id: f.id || e.target.value.toLowerCase().replace(/\s+/g, "_") };
              onChange(next);
            }}
            sx={{ flex: 1 }}
          />
          <TextField
            size="small"
            select
            value={f.type}
            onChange={(e) => {
              const next = [...fields];
              next[i] = { ...f, type: e.target.value };
              onChange(next);
            }}
            sx={{ width: 100 }}
          >
            {FIELD_TYPES.map((t) => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </TextField>
          <IconButton size="small" onClick={() => onChange(fields.filter((_, idx) => idx !== i))}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Stack>
      ))}
      <Button
        size="small"
        startIcon={<AddIcon />}
        onClick={() => onChange([...fields, { id: `campo_${fields.length + 1}`, label: "", type: "text" }])}
      >
        Aggiungi campo
      </Button>
    </Stack>
  );
}

function RuleEditor({ rule, onChange }: { rule: any; onChange: (r: any) => void }) {
  return (
    <Stack spacing={1}>
      <Typography variant="caption" color="text.secondary">
        Regola (percorso "approve" se vera)
      </Typography>
      <TextField
        size="small"
        label="Campo (id del form)"
        value={rule.field}
        onChange={(e) => onChange({ ...rule, field: e.target.value })}
      />
      <TextField size="small" select label="Operatore" value={rule.operator} onChange={(e) => onChange({ ...rule, operator: e.target.value })}>
        {["gt", "gte", "lt", "lte", "eq"].map((op) => (
          <MenuItem key={op} value={op}>
            {op}
          </MenuItem>
        ))}
      </TextField>
      <TextField size="small" label="Valore" value={rule.value} onChange={(e) => onChange({ ...rule, value: e.target.value })} />
    </Stack>
  );
}

export function WorkflowDesignerPage() {
  return (
    <ReactFlowProvider>
      <DesignerInner />
    </ReactFlowProvider>
  );
}
