import { prisma } from "./prisma.js";

interface AuditEntry {
  companyId: string;
  userId?: string | null;
  instanceId?: string | null;
  action: string;
  previousValue?: unknown;
  newValue?: unknown;
  ip?: string | null;
}

export async function logAudit(entry: AuditEntry) {
  return prisma.auditLog.create({
    data: {
      companyId: entry.companyId,
      userId: entry.userId ?? null,
      instanceId: entry.instanceId ?? null,
      action: entry.action,
      previousValue: entry.previousValue ? JSON.stringify(entry.previousValue) : null,
      newValue: entry.newValue ? JSON.stringify(entry.newValue) : null,
      ip: entry.ip ?? null,
    },
  });
}
