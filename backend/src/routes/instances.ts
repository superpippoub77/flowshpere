import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { logAudit } from "../lib/audit.js";
import { advanceInstance } from "../lib/engine.js";
import { requireAuth, requireCompany, AuthedRequest } from "../middleware/auth.js";

export const instanceRouter = Router();
instanceRouter.use(requireAuth, requireCompany);

instanceRouter.get("/", async (req: AuthedRequest, res) => {
  const isOperator = req.roleKey === "OPERATOR";
  const where = {
    workflow: { companyId: req.companyId },
    ...(isOperator
      ? { OR: [{ createdById: req.user!.id }, { tasks: { some: { assignedToId: req.user!.id } } }] }
      : {}),
  };

  const instances = await prisma.workflowInstance.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: { workflow: { select: { name: true } } },
  });
  res.json(instances);
});

const createSchema = z.object({ workflowId: z.string(), data: z.record(z.any()).optional() });

instanceRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const workflow = await prisma.workflow.findFirst({
    where: { id: parsed.data.workflowId, companyId: req.companyId, status: "PUBLISHED" },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });
  if (!workflow || !workflow.versions[0]) return res.status(404).json({ error: "Workflow pubblicato non trovato" });

  const count = await prisma.workflowInstance.count({ where: { workflow: { companyId: req.companyId } } });
  const code = `Richiesta #${1000 + count + 1}`;

  const instance = await prisma.workflowInstance.create({
    data: {
      workflowId: workflow.id,
      workflowVersionId: workflow.versions[0].id,
      code,
      dataJson: JSON.stringify(parsed.data.data ?? {}),
      createdById: req.user!.id,
      status: "BOZZA",
    },
  });

  await logAudit({ companyId: req.companyId!, userId: req.user!.id, instanceId: instance.id, action: `Creazione istanza "${code}"` });
  await advanceInstance(instance.id);
  const full = await prisma.workflowInstance.findUnique({ where: { id: instance.id } });
  res.status(201).json(full);
});

instanceRouter.get("/:id", async (req: AuthedRequest, res) => {
  const instance = await prisma.workflowInstance.findFirst({
    where: { id: req.params.id, workflow: { companyId: req.companyId } },
    include: {
      workflow: true,
      workflowVersion: true,
      tasks: { orderBy: { createdAt: "asc" }, include: { assignedTo: { select: { fullName: true } } } },
      comments: { orderBy: { createdAt: "asc" }, include: { author: { select: { fullName: true } } } },
      aiDecisions: { orderBy: { createdAt: "asc" } },
      auditLogs: { orderBy: { createdAt: "asc" }, include: { user: { select: { fullName: true } } } },
    },
  });
  if (!instance) return res.status(404).json({ error: "Istanza non trovata" });
  res.json(instance);
});

// Compila il form del nodo corrente e fa avanzare il workflow
const formSubmitSchema = z.object({ values: z.record(z.any()) });
instanceRouter.post("/:id/tasks/:taskId/form", async (req: AuthedRequest, res) => {
  const parsed = formSubmitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const instance = await prisma.workflowInstance.findFirst({ where: { id: req.params.id, workflow: { companyId: req.companyId } } });
  if (!instance) return res.status(404).json({ error: "Istanza non trovata" });

  const data = { ...JSON.parse(instance.dataJson), ...parsed.data.values };
  await prisma.workflowInstance.update({ where: { id: instance.id }, data: { dataJson: JSON.stringify(data) } });
  const task = await prisma.workflowTask.update({
    where: { id: req.params.taskId },
    data: { status: "COMPLETATO", resolvedAt: new Date() },
  });
  await logAudit({ companyId: req.companyId!, userId: req.user!.id, instanceId: instance.id, action: "Form compilato", newValue: parsed.data.values });

  // il nodo form e' risolto: avanza al prossimo nodo del grafo a partire da quel nodo
  await advanceFrom(instance.id, task.nodeId, undefined);
  res.json({ ok: true });
});

// Completa un task "di passaggio" senza decisione (es. upload documento simulato)
instanceRouter.post("/:id/tasks/:taskId/complete", async (req: AuthedRequest, res) => {
  const instance = await prisma.workflowInstance.findFirst({ where: { id: req.params.id, workflow: { companyId: req.companyId } } });
  if (!instance) return res.status(404).json({ error: "Istanza non trovata" });

  const task = await prisma.workflowTask.update({
    where: { id: req.params.taskId },
    data: { status: "COMPLETATO", resolvedAt: new Date(), assignedToId: req.user!.id },
  });
  await logAudit({ companyId: req.companyId!, userId: req.user!.id, instanceId: instance.id, action: `Attivita' completata: "${task.nodeLabel}"` });
  await advanceFrom(instance.id, task.nodeId, undefined);
  res.json({ ok: true });
});

// Decisione manuale (approvazione) su un task
const decisionSchema = z.object({ decision: z.enum(["approve", "reject"]) });
instanceRouter.post("/:id/tasks/:taskId/decision", async (req: AuthedRequest, res) => {
  const parsed = decisionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const instance = await prisma.workflowInstance.findFirst({ where: { id: req.params.id, workflow: { companyId: req.companyId } } });
  if (!instance) return res.status(404).json({ error: "Istanza non trovata" });

  const task = await prisma.workflowTask.update({
    where: { id: req.params.taskId },
    data: { status: parsed.data.decision === "approve" ? "APPROVATO" : "RIFIUTATO", resolvedAt: new Date(), assignedToId: req.user!.id },
  });

  await logAudit({
    companyId: req.companyId!,
    userId: req.user!.id,
    instanceId: instance.id,
    action: `Decisione "${task.nodeLabel}": ${parsed.data.decision === "approve" ? "Approvato" : "Rifiutato"}`,
  });

  await advanceAfterDecision(instance.id, task.nodeId, parsed.data.decision);
  res.json({ ok: true });
});

instanceRouter.post("/:id/comments", async (req: AuthedRequest, res) => {
  const body = z.object({ body: z.string().min(1) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Commento vuoto" });

  const instance = await prisma.workflowInstance.findFirst({ where: { id: req.params.id, workflow: { companyId: req.companyId } } });
  if (!instance) return res.status(404).json({ error: "Istanza non trovata" });

  const comment = await prisma.workflowComment.create({
    data: { instanceId: instance.id, authorId: req.user!.id, body: body.data.body },
  });
  await logAudit({ companyId: req.companyId!, userId: req.user!.id, instanceId: instance.id, action: "Commento aggiunto" });
  res.status(201).json(comment);
});

// --- helper interni che collegano i task risolti al motore di avanzamento ---


async function advanceAfterDecision(instanceId: string, nodeId: string, decision: "approve" | "reject") {
  await advanceFrom(instanceId, nodeId, decision);
}

async function advanceFrom(instanceId: string, nodeId: string | null, handle: "approve" | "reject" | undefined) {
  const instance = await prisma.workflowInstance.findUniqueOrThrow({ where: { id: instanceId }, include: { workflowVersion: true } });
  const edges = JSON.parse(instance.workflowVersion.edgesJson) as { source: string; target: string; sourceHandle?: string | null }[];
  if (!nodeId) return advanceInstance(instanceId);
  const next = handle
    ? edges.find((e) => e.source === nodeId && e.sourceHandle === handle) ?? edges.find((e) => e.source === nodeId)
    : edges.find((e) => e.source === nodeId);
  await prisma.workflowInstance.update({ where: { id: instanceId }, data: { currentNodeId: next?.target ?? null } });
  await advanceInstance(instanceId);
}
