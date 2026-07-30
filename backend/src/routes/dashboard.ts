import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireCompany, AuthedRequest } from "../middleware/auth.js";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth, requireCompany);

dashboardRouter.get("/kpi", async (req: AuthedRequest, res) => {
  const where = { workflow: { companyId: req.companyId } };
  const [attivi, conclusi, bloccati, tutti, aiDecisions] = await Promise.all([
    prisma.workflowInstance.count({ where: { ...where, status: { in: ["IN_CORSO", "IN_ATTESA", "BOZZA"] } } }),
    prisma.workflowInstance.count({ where: { ...where, status: "COMPLETATO" } }),
    prisma.workflowInstance.count({ where: { ...where, status: "ANNULLATO" } }),
    prisma.workflowInstance.findMany({ where, select: { createdAt: true, updatedAt: true, status: true } }),
    prisma.aiDecision.findMany({ where: { instance: where } }),
  ]);

  const completed = tutti.filter((i) => i.status === "COMPLETATO");
  const avgMs =
    completed.length > 0
      ? completed.reduce((sum, i) => sum + (i.updatedAt.getTime() - i.createdAt.getTime()), 0) / completed.length
      : 0;

  const approvals = tutti.filter((i) => i.status === "APPROVATO" || i.status === "COMPLETATO").length;
  const approvalRate = tutti.length > 0 ? Math.round((approvals / tutti.length) * 100) : 0;

  res.json({
    attivi,
    conclusi,
    bloccati,
    tempoMedioOre: Math.round((avgMs / 3600000) * 10) / 10,
    percentualeApprovazioni: approvalRate,
    decisioniAi: aiDecisions.length,
    decisioniAiAutomatiche: aiDecisions.filter((d) => d.autoApplied).length,
  });
});
