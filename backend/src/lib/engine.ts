import { prisma } from "./prisma.js";
import { logAudit } from "./audit.js";

export interface FlowNode {
  id: string;
  type: string; // start | form | approval | autoDecision | ai | email | webhook | upload | comment | end
  data: {
    label: string;
    config?: Record<string, unknown>;
  };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null; // "approve" | "reject" | "review" | null
}

function findOutgoing(edges: FlowEdge[], nodeId: string, handle?: string) {
  if (handle) {
    return edges.find((e) => e.source === nodeId && e.sourceHandle === handle) ?? edges.find((e) => e.source === nodeId);
  }
  return edges.find((e) => e.source === nodeId);
}

// Valuta una regola semplice tipo { field, operator, value } sui dati raccolti dal form
function evaluateRule(rule: any, data: Record<string, unknown>): boolean {
  if (!rule?.field) return true;
  const value = Number(data[rule.field]);
  const target = Number(rule.value);
  switch (rule.operator) {
    case "gt":
      return value > target;
    case "gte":
      return value >= target;
    case "lt":
      return value < target;
    case "lte":
      return value <= target;
    case "eq":
      return value === target;
    default:
      return true;
  }
}

// Esegue automaticamente tutti i nodi "di passaggio" (start, autoDecision, ai, email,
// webhook, comment) finche' non trova un nodo che richiede intervento umano
// (form, approval, upload) o la fine del processo.
export async function advanceInstance(instanceId: string) {
  const instance = await prisma.workflowInstance.findUniqueOrThrow({
    where: { id: instanceId },
    include: { workflowVersion: true, workflow: true },
  });

  const nodes: FlowNode[] = JSON.parse(instance.workflowVersion.nodesJson);
  const edges: FlowEdge[] = JSON.parse(instance.workflowVersion.edgesJson);
  const data: Record<string, unknown> = JSON.parse(instance.dataJson);

  let currentId = instance.currentNodeId ?? nodes.find((n) => n.type === "start")?.id ?? null;
  let guard = 0;

  while (currentId && guard < 50) {
    guard++;
    const node = nodes.find((n) => n.id === currentId);
    if (!node) break;

    if (node.type === "start") {
      const next = findOutgoing(edges, node.id);
      currentId = next?.target ?? null;
      continue;
    }

    if (node.type === "form") {
      await ensureTask(instance.id, node, "APERTO");
      await setCurrentNode(instance.id, node.id, "IN_CORSO");
      return; // attende la compilazione del form da parte dell'utente
    }

    if (node.type === "upload") {
      await ensureTask(instance.id, node, "APERTO");
      await setCurrentNode(instance.id, node.id, "IN_ATTESA");
      return; // attende il caricamento dell'allegato
    }

    if (node.type === "approval") {
      await ensureTask(instance.id, node, "APERTO");
      await setCurrentNode(instance.id, node.id, "IN_ATTESA");
      return; // attende la decisione manuale
    }

    if (node.type === "autoDecision") {
      const rule = node.data.config?.rule;
      const passes = evaluateRule(rule, data);
      await logAudit({
        companyId: instance.workflow.companyId,
        instanceId: instance.id,
        action: `Decisione automatica "${node.data.label}": ${passes ? "condizione vera" : "condizione falsa"}`,
      });
      const next = findOutgoing(edges, node.id, passes ? "approve" : "reject");
      currentId = next?.target ?? null;
      continue;
    }

    if (node.type === "ai") {
      const confidence = Math.round((0.7 + Math.random() * 0.3) * 100) / 100;
      const suggestion = confidence > 0.5 ? "APPROVA" : "RICHIEDI_REVISIONE";
      const autoApplied = confidence > 0.9;
      await prisma.aiDecision.create({
        data: {
          instanceId: instance.id,
          nodeId: node.id,
          suggestion,
          confidence,
          autoApplied,
          reasoning: `Valutazione automatica basata sui dati raccolti (demo).`,
        },
      });
      await logAudit({
        companyId: instance.workflow.companyId,
        instanceId: instance.id,
        action: `AI valuta "${node.data.label}": ${suggestion} (confidenza ${Math.round(confidence * 100)}%)`,
      });
      if (autoApplied) {
        const next = findOutgoing(edges, node.id, "approve");
        currentId = next?.target ?? null;
        continue;
      }
      await ensureTask(instance.id, node, "APERTO");
      await setCurrentNode(instance.id, node.id, "IN_ATTESA");
      return; // confidenza insufficiente: passa a un responsabile umano
    }

    if (node.type === "email") {
      await prisma.notification.create({
        data: {
          companyId: instance.workflow.companyId,
          userId: instance.createdById,
          channel: "email",
          title: node.data.label,
          body: (node.data.config?.template as string) || "Aggiornamento sul processo in corso.",
        },
      });
      await logAudit({ companyId: instance.workflow.companyId, instanceId: instance.id, action: `Email inviata: "${node.data.label}"` });
      const next = findOutgoing(edges, node.id);
      currentId = next?.target ?? null;
      continue;
    }

    if (node.type === "webhook") {
      await logAudit({
        companyId: instance.workflow.companyId,
        instanceId: instance.id,
        action: `Chiamata webhook simulata: "${node.data.label}"`,
      });
      const next = findOutgoing(edges, node.id);
      currentId = next?.target ?? null;
      continue;
    }

    if (node.type === "comment") {
      const next = findOutgoing(edges, node.id);
      currentId = next?.target ?? null;
      continue;
    }

    if (node.type === "end") {
      await prisma.workflowInstance.update({
        where: { id: instance.id },
        data: { status: "COMPLETATO", currentNodeId: node.id },
      });
      await logAudit({ companyId: instance.workflow.companyId, instanceId: instance.id, action: "Processo completato" });
      return;
    }

    break;
  }
}

async function ensureTask(instanceId: string, node: FlowNode, status: "APERTO") {
  const existing = await prisma.workflowTask.findFirst({ where: { instanceId, nodeId: node.id } });
  if (existing) return existing;
  return prisma.workflowTask.create({
    data: { instanceId, nodeId: node.id, nodeType: node.type, nodeLabel: node.data.label, status },
  });
}

async function setCurrentNode(instanceId: string, nodeId: string, status: any) {
  await prisma.workflowInstance.update({ where: { id: instanceId }, data: { currentNodeId: nodeId, status } });
}
