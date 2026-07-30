import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { logAudit } from "../lib/audit.js";
import { requireAuth, requireCompany, requireRole, AuthedRequest } from "../middleware/auth.js";

export const workflowRouter = Router();
workflowRouter.use(requireAuth, requireCompany);

workflowRouter.get("/", async (req: AuthedRequest, res) => {
  const workflows = await prisma.workflow.findMany({
    where: { companyId: req.companyId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { instances: true } }, versions: { select: { version: true }, orderBy: { version: "desc" }, take: 1 } },
  });
  res.json(
    workflows.map((w) => ({
      id: w.id,
      name: w.name,
      description: w.description,
      status: w.status,
      instanceCount: w._count.instances,
      latestVersion: w.versions[0]?.version ?? null,
      updatedAt: w.updatedAt,
    }))
  );
});

workflowRouter.get("/:id", async (req: AuthedRequest, res) => {
  const workflow = await prisma.workflow.findFirst({
    where: { id: req.params.id, companyId: req.companyId },
    include: { versions: { orderBy: { version: "desc" } } },
  });
  if (!workflow) return res.status(404).json({ error: "Workflow non trovato" });
  res.json(workflow);
});

const upsertSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  nodes: z.array(z.any()),
  edges: z.array(z.any()),
  forms: z.record(z.any()).optional(),
});

workflowRouter.post("/", requireRole("ADMIN"), async (req: AuthedRequest, res) => {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const workflow = await prisma.workflow.create({
    data: {
      companyId: req.companyId!,
      name: parsed.data.name,
      description: parsed.data.description,
      status: "DRAFT",
      versions: {
        create: {
          version: 1,
          nodesJson: JSON.stringify(parsed.data.nodes),
          edgesJson: JSON.stringify(parsed.data.edges),
          formsJson: JSON.stringify(parsed.data.forms ?? {}),
        },
      },
    },
    include: { versions: true },
  });

  await logAudit({ companyId: req.companyId!, userId: req.user!.id, action: `Workflow creato: "${workflow.name}"` });
  res.status(201).json(workflow);
});

// Salva una nuova bozza (nodi/edges) senza pubblicare
workflowRouter.put("/:id/draft", requireRole("ADMIN"), async (req: AuthedRequest, res) => {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const workflow = await prisma.workflow.findFirst({
    where: { id: req.params.id, companyId: req.companyId },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });
  if (!workflow) return res.status(404).json({ error: "Workflow non trovato" });

  const nextVersion = (workflow.versions[0]?.version ?? 0) + 1;
  const version = await prisma.workflowVersion.create({
    data: {
      workflowId: workflow.id,
      version: nextVersion,
      nodesJson: JSON.stringify(parsed.data.nodes),
      edgesJson: JSON.stringify(parsed.data.edges),
      formsJson: JSON.stringify(parsed.data.forms ?? {}),
    },
  });
  await prisma.workflow.update({
    where: { id: workflow.id },
    data: { name: parsed.data.name, description: parsed.data.description },
  });
  await logAudit({ companyId: req.companyId!, userId: req.user!.id, action: `Bozza salvata per "${workflow.name}" (v${nextVersion})` });
  res.json(version);
});

workflowRouter.post("/:id/publish", requireRole("ADMIN"), async (req: AuthedRequest, res) => {
  const workflow = await prisma.workflow.findFirst({ where: { id: req.params.id, companyId: req.companyId } });
  if (!workflow) return res.status(404).json({ error: "Workflow non trovato" });

  await prisma.workflow.update({ where: { id: workflow.id }, data: { status: "PUBLISHED" } });
  await logAudit({ companyId: req.companyId!, userId: req.user!.id, action: `Workflow pubblicato: "${workflow.name}"` });
  res.json({ ok: true });
});
