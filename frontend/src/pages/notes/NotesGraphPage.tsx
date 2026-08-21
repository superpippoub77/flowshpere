import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import ReactFlow, { Background, Controls, Node, Edge } from "reactflow";
import "reactflow/dist/style.css";
import { Box, Stack, Typography, Button, Paper, CircularProgress } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { api } from "../../api/client";
import { CompanySelector } from "../../components/CompanySelector";

// Disposizione semplice a cerchio: senza una vera libreria di force-layout,
// distribuire i nodi su una circonferenza da' comunque una lettura chiara
// dei collegamenti, come una prima "graph view" essenziale.
function circleLayout(count: number, radius: number): { x: number; y: number }[] {
  const positions = [];
  for (let i = 0; i < count; i++) {
    const angle = (2 * Math.PI * i) / Math.max(count, 1);
    positions.push({ x: radius + radius * Math.cos(angle), y: radius + radius * Math.sin(angle) });
  }
  return positions;
}

export function NotesGraphPage() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["notes-graph"],
    queryFn: async () => (await api.get("/notes/graph")).data,
  });

  const { nodes, edges } = useMemo(() => {
    const rawNodes = data?.nodes ?? [];
    const rawEdges = data?.edges ?? [];
    const radius = Math.max(180, rawNodes.length * 22);
    const positions = circleLayout(rawNodes.length, radius);

    const linkCounts: Record<string, number> = {};
    rawEdges.forEach((e: any) => {
      linkCounts[e.source] = (linkCounts[e.source] ?? 0) + 1;
      linkCounts[e.target] = (linkCounts[e.target] ?? 0) + 1;
    });

    const nodes: Node[] = rawNodes.map((n: any, i: number) => ({
      id: n.id,
      position: positions[i] ?? { x: 0, y: 0 },
      data: { label: n.title },
      style: {
        borderRadius: 999,
        padding: "8px 14px",
        fontSize: 12.5,
        border: "1px solid rgba(127,184,217,0.4)",
        background: (linkCounts[n.id] ?? 0) > 0 ? "rgba(196,127,31,0.16)" : "rgba(127,184,217,0.1)",
      },
    }));

    const edges: Edge[] = rawEdges.map((e: any, i: number) => ({
      id: `e${i}`,
      source: e.source,
      target: e.target,
      animated: false,
      style: { stroke: "rgba(127,184,217,0.5)" },
    }));

    return { nodes, edges };
  }, [data]);

  return (
    <Box sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column" }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/notes/list")}>
            Tutte le note
          </Button>
          <Stack spacing={0.2}>
            <Typography variant="overline" color="primary">
              NOTE
            </Typography>
            <Typography variant="h6">Vista a grafo</Typography>
          </Stack>
        </Stack>
        <CompanySelector appKey="notes" />
      </Stack>

      <Paper sx={{ flex: 1, minHeight: 0, position: "relative" }}>
        {isLoading ? (
          <Box sx={{ height: "100%", display: "grid", placeItems: "center" }}>
            <CircularProgress size={28} />
          </Box>
        ) : nodes.length === 0 ? (
          <Box sx={{ height: "100%", display: "grid", placeItems: "center" }}>
            <Typography color="text.secondary">Nessuna nota ancora creata.</Typography>
          </Box>
        ) : (
          <ReactFlow nodes={nodes} edges={edges} onNodeClick={(_, node) => navigate(`/notes/${node.id}`)} fitView proOptions={{ hideAttribution: true }}>
            <Background />
            <Controls showInteractive={false} />
          </ReactFlow>
        )}
      </Paper>
    </Box>
  );
}
