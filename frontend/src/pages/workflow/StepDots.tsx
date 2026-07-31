import { Box, Stack, Tooltip, Typography } from "@mui/material";

export interface FlowNode {
  id: string;
  type: string;
  data: { label: string; config?: any };
}
export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
}
export interface TaskInfo {
  id: string;
  nodeId: string;
  nodeType: string;
  status: string; // APERTO | APPROVATO | RIFIUTATO | COMPLETATO
  createdAt: string;
  resolvedAt: string | null;
  assignedTo: { fullName: string } | null;
}

export type StepStatus = "done" | "active" | "rejected" | "pending";

// Ricostruisce il percorso "principale" del workflow seguendo gli archi non
// di rifiuto, dal nodo Start fino alla Fine.
export function computeMainSequence(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] {
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const start = nodes.find((n) => n.type === "start");
  if (!start) return nodes;

  const sequence: FlowNode[] = [start];
  const visited = new Set([start.id]);
  let current: FlowNode | undefined = start;

  while (current && current.type !== "end") {
    const outs = edges.filter((e) => e.source === current!.id);
    const next = outs.find((e) => e.sourceHandle === "approve") ?? outs.find((e) => !e.sourceHandle) ?? outs[0];
    if (!next || visited.has(next.target)) break;
    const nextNode = byId[next.target];
    if (!nextNode) break;
    sequence.push(nextNode);
    visited.add(nextNode.id);
    current = nextNode;
  }
  return sequence;
}

export function computeStepStatuses(
  sequence: FlowNode[],
  tasks: TaskInfo[],
  currentNodeId: string | null,
  instanceStatus: string
): StepStatus[] {
  const currentIndex = sequence.findIndex((n) => n.id === currentNodeId);

  return sequence.map((node, idx) => {
    const nodeTasks = tasks.filter((t) => t.nodeId === node.id);
    const last = nodeTasks[nodeTasks.length - 1];
    if (last) {
      if (last.status === "APERTO") return "active";
      if (last.status === "RIFIUTATO") return "rejected";
      return "done"; // APPROVATO / COMPLETATO
    }
    if (instanceStatus === "COMPLETATO") return "done";
    if (currentIndex === -1) return idx === 0 ? "active" : "pending";
    if (idx < currentIndex) return "done";
    if (idx === currentIndex) return "active";
    return "pending";
  });
}

export function StepDots({
  sequence,
  statuses,
  onSelect,
  compact,
  badges,
}: {
  sequence: FlowNode[];
  statuses: StepStatus[];
  onSelect?: (node: FlowNode, index: number) => void;
  compact?: boolean;
  badges?: { hasComment: boolean; hasAttachment: boolean }[];
}) {
  return (
    <Stack direction="row" alignItems="center" sx={{ overflowX: "auto", py: compact ? 0 : 1 }}>
      {sequence.map((node, idx) => (
        <Box
          key={node.id}
          sx={{ display: "flex", alignItems: "center", flex: idx < sequence.length - 1 ? 1 : "none", minWidth: compact ? 18 : undefined }}
        >
          <Tooltip title={node.data.label}>
            <Box sx={{ position: "relative" }}>
              <Box
                className={`step-dot ${statuses[idx]}${compact ? " compact" : ""}`}
                onClick={onSelect ? () => onSelect(node, idx) : undefined}
                sx={onSelect ? undefined : { cursor: "default" }}
              >
                {compact ? "" : idx + 1}
              </Box>
              {badges?.[idx]?.hasComment && <Box className={`step-badge comment${compact ? " compact" : ""}`} />}
              {badges?.[idx]?.hasAttachment && <Box className={`step-badge attachment${compact ? " compact" : ""}`} />}
            </Box>
          </Tooltip>
          {idx < sequence.length - 1 && <Box className={`step-dot-connector${compact ? " compact" : ""}`} />}
        </Box>
      ))}
    </Stack>
  );
}

export function stepStatusLabel(status: StepStatus): string {
  switch (status) {
    case "done": return "Approvato";
    case "active": return "In fase di approvazione";
    case "rejected": return "Rigettato";
    default: return "Non ancora raggiunto";
  }
}
