# Workflow Platform — MVP

Prima applicazione ("Workflow Management") della piattaforma aziendale multi-progetto,
gia' predisposta come Application Hub per i moduli futuri (Timesheet, CRM, Ticket, ...).

## Struttura

```
workflow-platform/
├── backend/     Node.js + Express + Prisma + SQLite
└── frontend/    React + TypeScript + Vite + MUI + React Flow
```

## Avvio backend

```bash
cd backend
npm install
npx prisma migrate dev --name init   # crea il database SQLite e le tabelle
npm run seed                          # azienda demo + utenti + 2 workflow di esempio
npm run dev                           # http://localhost:4000
```

Utenti demo (password per tutti: `password123`):

- `admin@demo.it` — Amministratore Aziendale (crea/pubblica workflow)
- `supervisore@demo.it` — Supervisore (vede tutti i processi, puo' approvare)
- `operatore@demo.it` — Operatore (vede solo i propri task)
- `superadmin@platform.it` — Super Amministratore (vede tutte le aziende)

## Avvio frontend

```bash
cd frontend
npm install
npm run dev    # http://localhost:5173
```

Il frontend gira in proxy verso il backend su `/api` (vedi `vite.config.ts`).

## Cosa funziona gia'

- Login unificato + selettore applicazioni (multi-tenant, multi-app)
- Designer drag & drop dei workflow (React Flow) con tutti i tipi di nodo previsti
  dalle specifiche: Start, Form, Approvazione, Decisione Automatica, Nodo AI,
  Invio Email, Webhook/API, Upload Documenti, Commento, Fine Processo
- Pubblicazione workflow (versionamento automatico)
- Motore di esecuzione: avanza da solo sui nodi automatici e si ferma sui nodi che
  richiedono un umano (form, approvazione, upload)
- Istanze di processo con codice progressivo ("Richiesta #2458"), stato, timeline/audit
  log completo (nessuna azione viene mai cancellata), commenti
- Nodo AI con percentuale di confidenza: sopra il 90% procede da solo, altrimenti
  assegna a un responsabile (esattamente come da specifica)
- Dashboard con i KPI richiesti (attivi, conclusi, tempo medio, % approvazioni,
  decisioni AI)

## Cosa manca ancora (prossimi passi naturali)

- Gestione utenti/ruoli/aziende da interfaccia (oggi solo da seed/DB)
- Upload reale degli allegati (oggi simulato) e versionamento file
- Notifiche email reali (oggi solo salvate a DB) e canali futuri (WhatsApp/Teams/Slack)
- MFA e OAuth sul login
- Applicazioni successive del hub (Timesheet, CRM, Ticket, ...) — il modello dati e
  il selettore app sono gia' pronti ad ospitarle
