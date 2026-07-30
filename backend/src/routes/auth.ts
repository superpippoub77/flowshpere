import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { signToken } from "../lib/jwt.js";
import { requireAuth, AuthedRequest } from "../middleware/auth.js";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Email o password non validi" });

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: "Credenziali non valide" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Credenziali non valide" });

  const token = signToken({ userId: user.id, email: user.email, isSuperAdmin: user.isSuperAdmin });
  res.json({
    token,
    user: { id: user.id, email: user.email, fullName: user.fullName, isSuperAdmin: user.isSuperAdmin },
  });
});

// Aziende dell'utente + app abilitate per ciascuna (per il selettore post-login)
authRouter.get("/me/companies", requireAuth, async (req: AuthedRequest, res) => {
  if (req.user!.isSuperAdmin) {
    const companies = await prisma.company.findMany({ orderBy: { name: "asc" } });
    const applications = await prisma.application.findMany({ where: { enabled: true } });
    return res.json(
      companies.map((c) => ({
        id: c.id,
        name: c.name,
        role: "Super Amministratore",
        applications: applications.map((a) => ({ key: a.key, name: a.name })),
      }))
    );
  }

  const memberships = await prisma.userCompany.findMany({
    where: { userId: req.user!.id },
    include: {
      company: true,
      role: true,
      applications: { include: { application: true } },
    },
  });

  res.json(
    memberships.map((m) => ({
      id: m.company.id,
      name: m.company.name,
      role: m.role.name,
      applications: m.applications
        .filter((a) => a.application.enabled)
        .map((a) => ({ key: a.application.key, name: a.application.name })),
    }))
  );
});
