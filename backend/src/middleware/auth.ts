import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";

export interface AuthedRequest extends Request {
  user?: { id: string; email: string; isSuperAdmin: boolean };
  companyId?: string;
  roleKey?: string;
}

// Verifica il token JWT e popola req.user
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token mancante" });
  }
  try {
    const payload = verifyToken(header.slice("Bearer ".length));
    req.user = { id: payload.userId, email: payload.email, isSuperAdmin: payload.isSuperAdmin };
    next();
  } catch {
    return res.status(401).json({ error: "Token non valido o scaduto" });
  }
}

// Risolve l'azienda corrente dall'header X-Company-Id e verifica che
// l'utente vi appartenga (separazione dati multi-tenant).
export async function requireCompany(req: AuthedRequest, res: Response, next: NextFunction) {
  const companyId = req.header("X-Company-Id");
  if (!companyId) return res.status(400).json({ error: "Azienda non specificata" });

  if (req.user?.isSuperAdmin) {
    req.companyId = companyId;
    req.roleKey = "SUPER_ADMIN";
    return next();
  }

  const membership = await prisma.userCompany.findUnique({
    where: { userId_companyId: { userId: req.user!.id, companyId } },
    include: { role: true },
  });
  if (!membership) return res.status(403).json({ error: "Nessun accesso a questa azienda" });

  req.companyId = companyId;
  req.roleKey = membership.role.key;
  next();
}

export function requireRole(...allowed: string[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (req.roleKey === "SUPER_ADMIN" || (req.roleKey && allowed.includes(req.roleKey))) {
      return next();
    }
    return res.status(403).json({ error: "Permessi insufficienti per questa azione" });
  };
}
