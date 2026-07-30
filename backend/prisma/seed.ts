import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding...");

  // ---- Applicazioni della piattaforma (hub futuro) ----
  const apps = await Promise.all(
    [
      { key: "workflow", name: "Workflow Management", enabled: true },
      { key: "timesheet", name: "Timesheet Dipendenti", enabled: false },
      { key: "ticket", name: "Gestione Ticket", enabled: false },
      { key: "crm", name: "CRM", enabled: false },
    ].map((a) =>
      prisma.application.upsert({ where: { key: a.key }, update: {}, create: a })
    )
  );
  const workflowApp = apps.find((a) => a.key === "workflow")!;

  // ---- Azienda demo ----
  const company = await prisma.company.upsert({
    where: { slug: "demo-spa" },
    update: {},
    create: { name: "Demo S.p.A.", slug: "demo-spa" },
  });

  // ---- Ruoli di sistema ----
  const roleDefs = [
    { key: "ADMIN", name: "Amministratore Aziendale" },
    { key: "SUPERVISOR", name: "Supervisore" },
    { key: "OPERATOR", name: "Operatore" },
  ];
  const roles: Record<string, string> = {};
  for (const r of roleDefs) {
    const role = await prisma.role.upsert({
      where: { companyId_key: { companyId: company.id, key: r.key } },
      update: {},
      create: { companyId: company.id, key: r.key, name: r.name, isSystem: true },
    });
    roles[r.key] = role.id;
  }

  // ---- Utenti demo (password uguale per tutti, solo per demo locale) ----
  const passwordHash = await bcrypt.hash("password123", 10);
  const usersDef = [
    { email: "admin@demo.it", fullName: "Anna Amministratore", roleKey: "ADMIN" },
    { email: "supervisore@demo.it", fullName: "Sara Supervisore", roleKey: "SUPERVISOR" },
    { email: "operatore@demo.it", fullName: "Omar Operatore", roleKey: "OPERATOR" },
  ];

  for (const u of usersDef) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { email: u.email, fullName: u.fullName, passwordHash },
    });
    const userCompany = await prisma.userCompany.upsert({
      where: { userId_companyId: { userId: user.id, companyId: company.id } },
      update: {},
      create: { userId: user.id, companyId: company.id, roleId: roles[u.roleKey] },
    });
    await prisma.userCompanyApplication.upsert({
      where: { userCompanyId_applicationId: { userCompanyId: userCompany.id, applicationId: workflowApp.id } },
      update: {},
      create: { userCompanyId: userCompany.id, applicationId: workflowApp.id },
    });
  }

  // Super admin globale (vede tutte le aziende)
  await prisma.user.upsert({
    where: { email: "superadmin@platform.it" },
    update: {},
    create: { email: "superadmin@platform.it", fullName: "Super Admin", passwordHash, isSuperAdmin: true },
  });

  // ---- Workflow di esempio 1: Richiesta Acquisto ----
  const nodes1 = [
    { id: "n1", type: "start", data: { label: "Inizio Processo" } },
    {
      id: "n2",
      type: "form",
      data: {
        label: "Richiesta Acquisto",
        config: {
          fields: [
            { id: "cliente", label: "Nome Cliente", type: "text" },
            { id: "importo", label: "Importo", type: "valuta" },
            { id: "descrizione", label: "Descrizione", type: "textarea" },
          ],
        },
      },
    },
    { id: "n3", type: "autoDecision", data: { label: "Importo > 1000€?", config: { rule: { field: "importo", operator: "gt", value: 1000 } } } },
    { id: "n4", type: "approval", data: { label: "Approvazione Responsabile" } },
    { id: "n5", type: "email", data: { label: "Notifica esito", config: { template: "La tua richiesta di acquisto e' stata elaborata." } } },
    { id: "n6", type: "end", data: { label: "Fine Processo" } },
  ];
  const edges1 = [
    { id: "e1", source: "n1", target: "n2" },
    { id: "e2", source: "n2", target: "n3" },
    { id: "e3", source: "n3", target: "n4", sourceHandle: "approve" },
    { id: "e4", source: "n3", target: "n5", sourceHandle: "reject" },
    { id: "e5", source: "n4", target: "n5", sourceHandle: "approve" },
    { id: "e6", source: "n4", target: "n5", sourceHandle: "reject" },
    { id: "e7", source: "n5", target: "n6" },
  ];

  const wf1 = await prisma.workflow.create({
    data: {
      companyId: company.id,
      name: "Richiesta Acquisto",
      description: "Approvazione automatica sotto 1000€, oltre richiede il responsabile.",
      status: "PUBLISHED",
      versions: {
        create: { version: 1, nodesJson: JSON.stringify(nodes1), edgesJson: JSON.stringify(edges1), formsJson: "{}" },
      },
    },
  });

  // ---- Workflow di esempio 2: Valutazione Fornitore con AI ----
  const nodes2 = [
    { id: "m1", type: "start", data: { label: "Inizio Processo" } },
    {
      id: "m2",
      type: "form",
      data: {
        label: "Dati Fornitore",
        config: {
          fields: [
            { id: "fornitore", label: "Nome Fornitore", type: "text" },
            { id: "punteggio", label: "Punteggio Affidabilita'", type: "numero" },
          ],
        },
      },
    },
    { id: "m3", type: "ai", data: { label: "Valutazione AI Fornitore" } },
    { id: "m4", type: "approval", data: { label: "Revisione Responsabile Acquisti" } },
    { id: "m5", type: "end", data: { label: "Fine Processo" } },
  ];
  const edges2 = [
    { id: "f1", source: "m1", target: "m2" },
    { id: "f2", source: "m2", target: "m3" },
    { id: "f3", source: "m3", target: "m5", sourceHandle: "approve" },
    { id: "f4", source: "m3", target: "m4", sourceHandle: "reject" },
    { id: "f5", source: "m4", target: "m5", sourceHandle: "approve" },
    { id: "f6", source: "m4", target: "m5", sourceHandle: "reject" },
  ];

  await prisma.workflow.create({
    data: {
      companyId: company.id,
      name: "Valutazione Fornitore con AI",
      description: "L'AI valuta il fornitore; sotto una certa confidenza interviene il responsabile.",
      status: "PUBLISHED",
      versions: {
        create: { version: 1, nodesJson: JSON.stringify(nodes2), edgesJson: JSON.stringify(edges2), formsJson: "{}" },
      },
    },
  });

  console.log("Seed completato.");
  console.log("Utenti demo (password: password123):");
  usersDef.forEach((u) => console.log(` - ${u.email} (${u.roleKey})`));
  console.log(" - superadmin@platform.it (SUPER ADMIN)");
  console.log(`Azienda: ${company.name} (id: ${company.id})`);
  console.log(`Workflow pubblicato: "${wf1.name}"`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
