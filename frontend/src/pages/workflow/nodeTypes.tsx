import { Handle, Position, NodeProps } from "reactflow";
import { Box, Typography } from "@mui/material";

export interface NodeMeta {
  kind: string;
  label: string;
  cornerTag: string;
  stripe: string;
  hasTarget: boolean;
  hasBranches: boolean; // due uscite: approve / reject
  hasSource: boolean; // una sola uscita
}

export const NODE_PALETTE: NodeMeta[] = [
  { kind: "start", label: "Inizio Processo", cornerTag: "IN", stripe: "var(--verdigris)", hasTarget: false, hasBranches: false, hasSource: true },
  { kind: "form", label: "Form", cornerTag: "FORM", stripe: "var(--blueprint-line)", hasTarget: true, hasBranches: false, hasSource: true },
  { kind: "approval", label: "Approvazione", cornerTag: "DEC", stripe: "var(--signal-amber)", hasTarget: true, hasBranches: true, hasSource: false },
  { kind: "autoDecision", label: "Decisione Automatica", cornerTag: "AUTO", stripe: "var(--signal-amber)", hasTarget: true, hasBranches: true, hasSource: false },
  { kind: "ai", label: "Nodo AI", cornerTag: "AI", stripe: "var(--signal-amber)", hasTarget: true, hasBranches: true, hasSource: false },
  { kind: "email", label: "Invio Email", cornerTag: "MAIL", stripe: "#9fb3c8", hasTarget: true, hasBranches: false, hasSource: true },
  { kind: "webhook", label: "Webhook/API", cornerTag: "API", stripe: "#9fb3c8", hasTarget: true, hasBranches: false, hasSource: true },
  { kind: "upload", label: "Upload Documenti", cornerTag: "DOC", stripe: "var(--blueprint-line)", hasTarget: true, hasBranches: false, hasSource: true },
  { kind: "comment", label: "Commento", cornerTag: "NOTE", stripe: "var(--blueprint-line)", hasTarget: true, hasBranches: false, hasSource: true },
  { kind: "end", label: "Fine Processo", cornerTag: "END", stripe: "var(--rust)", hasTarget: true, hasBranches: false, hasSource: false },
];

const metaByKind = Object.fromEntries(NODE_PALETTE.map((m) => [m.kind, m]));

function SchematicNode({ id, type, data, selected }: NodeProps) {
  const meta = metaByKind[type as string];
  if (!meta) return null;

  return (
    <Box className={`schematic-node${selected ? " selected" : ""}`}>
      <span className="corner-tag">{meta.cornerTag}</span>
      <Box className="stripe" sx={{ background: meta.stripe }} />
      <Box className="body">
        <span className="eyebrow">{id}</span>
        <Typography className="label">{data.label || meta.label}</Typography>
      </Box>

      {meta.hasTarget && <Handle type="target" position={Position.Top} />}

      {meta.hasSource && <Handle type="source" position={Position.Bottom} />}

      {meta.hasBranches && (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="approve"
            style={{ left: "30%", background: "var(--verdigris)" }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="reject"
            style={{ left: "70%", background: "var(--rust)" }}
          />
        </>
      )}
    </Box>
  );
}

export const nodeTypes = Object.fromEntries(NODE_PALETTE.map((m) => [m.kind, SchematicNode]));
