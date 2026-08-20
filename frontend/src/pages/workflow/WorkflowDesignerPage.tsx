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
  Menu,
  ListItemIcon,
  CircularProgress,
  Tooltip,
  FormControlLabel,
  Switch,
} from "@mui/material";
import UndoIcon from "@mui/icons-material/UndoOutlined";
import RedoIcon from "@mui/icons-material/RedoOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import SaveIcon from "@mui/icons-material/SaveOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopyOutlined";
import Magnet from "@mui/icons-material/GridOnOutlined";
import { api } from "../../api/client";
import { ClearableTextField } from "../../components/ClearableTextField";
import { useStatusStore } from "../../store/statusStore";
import { NODE_PALETTE, nodeTypes } from "./nodeTypes";

const FIELD_TYPES = ["text", "textarea", "numero", "valuta", "data", "checkbox", "select", "radio", "allegato", "firma", "anagrafica"];

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
  const [nodeMenu, setNodeMenu] = useState<{ mouseX: number; mouseY: number; nodeId: string } | null>(null);
  const [paneMenu, setPaneMenu] = useState<{ mouseX: number; mouseY: number } | null>(null);
  const [edgeMenu, setEdgeMenu] = useState<{ mouseX: number; mouseY: number; edgeId: string } | null>(null);

  const GRID_SIZE = 20;

  function duplicateNode(nodeId: string) {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const newId = `node_${Date.now()}_${nodeCounter.current++}`;
    setNodes((nds) =>
      nds.concat({ ...node, id: newId, selected: false, position: { x: node.position.x + 40, y: node.position.y + 40 } })
    );
    setNodeMenu(null);
  }

  function deleteNodeById(nodeId: string) {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    if (selectedId === nodeId) setSelectedId(null);
    setNodeMenu(null);
  }

  function deleteEdgeById(edgeId: string) {
    setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    setEdgeMenu(null);
  }

  function alignAllToGrid() {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        position: { x: Math.round(n.position.x / GRID_SIZE) * GRID_SIZE, y: Math.round(n.position.y / GRID_SIZE) * GRID_SIZE },
      }))
    );
    setPaneMenu(null);
  }
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

  const { data: allWorkflows } = useQuery({
    queryKey: ["workflows"],
    queryFn: async () => (await api.get("/workflows")).data,
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

  const setStatus = useStatusStore((s) => s.set);

  const saveMutation = useMutation({
    mutationFn: async () => {
      setStatus("saving", "Salvataggio bozza...");
      return api.put(`/workflows/${id}/draft`, {
        name,
        description,
        nodes: nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: n.data })),
        edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle })),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow", id] });
      setStatus("saved", "Bozza salvata");
    },
    onError: () => setStatus("error", "Errore nel salvataggio della bozza"),
  });

  // --- Salvataggio automatico (con flag persistito) ---
  const [autosave, setAutosave] = useState(() => localStorage.getItem("wf_designer_autosave") === "1");
  useEffect(() => {
    localStorage.setItem("wf_designer_autosave", autosave ? "1" : "0");
  }, [autosave]);

  useEffect(() => {
    if (!autosave || !workflow) return;
    const timer = setTimeout(() => saveMutation.mutate(), 2000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, name, description, autosave]);

  // --- Cronologia annulla/ripeti (almeno 100 passi indietro) ---
  const HISTORY_LIMIT = 100;
  const historyRef = useRef<{ nodes: any[]; edges: any[] }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isRestoringRef = useRef(false);
  const historyTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (isRestoringRef.current) {
      isRestoringRef.current = false;
      return;
    }
    if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    historyTimerRef.current = setTimeout(() => {
      setHistoryIndex((idx) => {
        const truncated = historyRef.current.slice(0, idx + 1);
        truncated.push({ nodes, edges });
        const overflow = truncated.length - HISTORY_LIMIT;
        historyRef.current = overflow > 0 ? truncated.slice(overflow) : truncated;
        return historyRef.current.length - 1;
      });
    }, 400);
    return () => clearTimeout(historyTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  function undo() {
    if (historyIndex <= 0) return;
    const snap = historyRef.current[historyIndex - 1];
    if (!snap) return;
    isRestoringRef.current = true;
    setNodes(snap.nodes);
    setEdges(snap.edges);
    setHistoryIndex(historyIndex - 1);
  }

  function redo() {
    if (historyIndex >= historyRef.current.length - 1) return;
    const snap = historyRef.current[historyIndex + 1];
    if (!snap) return;
    isRestoringRef.current = true;
    setNodes(snap.nodes);
    setEdges(snap.edges);
    setHistoryIndex(historyIndex + 1);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea" || (document.activeElement as HTMLElement)?.isContentEditable) return;
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.shiftKey && e.key.toLowerCase() === "z")) {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyIndex]);

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
          <ClearableTextField
            variant="standard"
            value={name}
            onChange={(e) => setName(e.target.value)}
            sx={{ minWidth: 220 }}
            InputProps={{ disableUnderline: true, style: { fontWeight: 700, fontSize: 16 } }}
          />
          {workflow && (
            <Chip size="small" label={workflow.status === "PUBLISHED" ? "Pubblicato" : "Bozza"} color={workflow.status === "PUBLISHED" ? "success" : "default"} />
          )}

          <Tooltip title="Annulla (Ctrl+Z)">
            <span>
              <IconButton size="small" onClick={undo} disabled={historyIndex <= 0}>
                <UndoIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Ripeti (Ctrl+Shift+Z)">
            <span>
              <IconButton size="small" onClick={redo} disabled={historyIndex >= historyRef.current.length - 1}>
                <RedoIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>

          <Box sx={{ flex: 1 }} />

          <FormControlLabel
            control={<Switch size="small" checked={autosave} onChange={(e) => setAutosave(e.target.checked)} />}
            label={<Typography variant="caption">Salvataggio automatico</Typography>}
            sx={{ mr: 1 }}
          />
          <Button
            size="small"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            startIcon={saveMutation.isPending ? <CircularProgress size={14} /> : undefined}
          >
            Salva bozza
          </Button>
          <Button
            size="small"
            variant="contained"
            color="secondary"
            onClick={() => publishMutation.mutate()}
            disabled={publishMutation.isPending}
            startIcon={publishMutation.isPending ? <CircularProgress size={14} color="inherit" /> : undefined}
          >
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
            onPaneClick={() => {
              setSelectedId(null);
              setNodeMenu(null);
              setPaneMenu(null);
              setEdgeMenu(null);
            }}
            onNodeContextMenu={(event, n) => {
              event.preventDefault();
              setPaneMenu(null);
              setEdgeMenu(null);
              setSelectedId(n.id);
              setNodeMenu({ mouseX: event.clientX, mouseY: event.clientY, nodeId: n.id });
            }}
            onEdgeContextMenu={(event, e) => {
              event.preventDefault();
              setNodeMenu(null);
              setPaneMenu(null);
              setEdgeMenu({ mouseX: event.clientX, mouseY: event.clientY, edgeId: e.id });
            }}
            onPaneContextMenu={(event) => {
              event.preventDefault();
              setNodeMenu(null);
              setEdgeMenu(null);
              setPaneMenu({ mouseX: (event as React.MouseEvent).clientX, mouseY: (event as React.MouseEvent).clientY });
            }}
            deleteKeyCode={["Backspace", "Delete"]}
            snapToGrid
            snapGrid={[GRID_SIZE, GRID_SIZE]}
            fitView
          >
            <Background gap={22} color="rgba(127,184,217,0.16)" />
            <Controls />
          </ReactFlow>

          <Menu
            open={!!nodeMenu}
            onClose={() => setNodeMenu(null)}
            anchorReference="anchorPosition"
            anchorPosition={nodeMenu ? { top: nodeMenu.mouseY, left: nodeMenu.mouseX } : undefined}
          >
            <MenuItem onClick={() => nodeMenu && duplicateNode(nodeMenu.nodeId)}>
              <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon>
              Duplica blocco
            </MenuItem>
            <MenuItem onClick={() => nodeMenu && deleteNodeById(nodeMenu.nodeId)}>
              <ListItemIcon><DeleteOutlineIcon fontSize="small" /></ListItemIcon>
              Elimina blocco
            </MenuItem>
          </Menu>

          <Menu
            open={!!edgeMenu}
            onClose={() => setEdgeMenu(null)}
            anchorReference="anchorPosition"
            anchorPosition={edgeMenu ? { top: edgeMenu.mouseY, left: edgeMenu.mouseX } : undefined}
          >
            <MenuItem onClick={() => edgeMenu && deleteEdgeById(edgeMenu.edgeId)}>
              <ListItemIcon><DeleteOutlineIcon fontSize="small" /></ListItemIcon>
              Elimina connessione
            </MenuItem>
          </Menu>

          <Menu
            open={!!paneMenu}
            onClose={() => setPaneMenu(null)}
            anchorReference="anchorPosition"
            anchorPosition={paneMenu ? { top: paneMenu.mouseY, left: paneMenu.mouseX } : undefined}
          >
            <MenuItem onClick={alignAllToGrid}>
              <ListItemIcon><Magnet fontSize="small" /></ListItemIcon>
              Allinea tutti i blocchi alla griglia
            </MenuItem>
          </Menu>
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
            <ClearableTextField
              label="Etichetta"
              size="small"
              value={selectedNode.data.label}
              onChange={(e) => updateSelected((d) => ({ ...d, label: e.target.value }))}
            />

            <ClearableTextField
              label="Descrizione del passo (mostrata a chi deve eseguirlo)"
              size="small"
              multiline
              minRows={2}
              value={selectedNode.data.config?.description ?? ""}
              onChange={(e) => updateSelected((d) => ({ ...d, config: { ...d.config, description: e.target.value } }))}
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
              <ClearableTextField
                label="Testo notifica"
                size="small"
                multiline
                minRows={3}
                value={selectedNode.data.config?.template ?? ""}
                onChange={(e) => updateSelected((d) => ({ ...d, config: { ...d.config, template: e.target.value } }))}
              />
            )}

            {selectedNode.type === "end" && (
              <Stack spacing={0.5}>
                <TextField
                  select
                  label="Workflow successivo (opzionale)"
                  size="small"
                  value={selectedNode.data.config?.nextWorkflowId ?? ""}
                  onChange={(e) => updateSelected((d) => ({ ...d, config: { ...d.config, nextWorkflowId: e.target.value || undefined } }))}
                >
                  <MenuItem value="">Nessuno: il processo termina qui</MenuItem>
                  {(allWorkflows ?? [])
                    .filter((w: any) => w.id !== id && w.status === "PUBLISHED")
                    .map((w: any) => (
                      <MenuItem key={w.id} value={w.id}>
                        {w.name}
                      </MenuItem>
                    ))}
                </TextField>
                <Typography variant="caption" color="text.secondary">
                  Quando questo processo si conclude, ne viene avviato automaticamente uno nuovo su quel workflow.
                </Typography>
              </Stack>
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
          <ClearableTextField
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
          <ClearableTextField
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
      <ClearableTextField
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
      <ClearableTextField size="small" label="Valore" value={rule.value} onChange={(e) => onChange({ ...rule, value: e.target.value })} />
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
