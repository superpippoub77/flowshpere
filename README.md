# FlowSphere — Workflow Platform (MVP)

Prima applicazione ("Workflow Management") della piattaforma aziendale multi-progetto,
gia' predisposta come Application Hub per i moduli futuri (Timesheet, CRM, Ticket, ...).

## Struttura

```
workflow-platform/
├── frontend/       React + TypeScript + Vite + MUI + React Flow
├── backend-php/    Backend PHP + SQLite — QUESTO va su Aruba (hosting condiviso, solo FTP/PHP)
└── backend/        Backend Node/Express/Prisma — alternativa per chi ha un hosting con Node persistente
```

Aruba hosting condiviso classico non fa girare processi Node persistenti (nessun
daemon, nessuna porta propria): per questo il backend "ufficiale" da deployare e'
**`backend-php/`**, un'unica app PHP + SQLite senza dipendenze esterne (nessun composer,
nessun accesso SSH necessario). Il backend Node resta disponibile se in futuro
passi a un hosting che supporta Node (VPS, Render, Railway...).

## Avvio in locale

```bash
# Backend PHP
cd backend-php
php seed.php                          # crea il DB SQLite + azienda demo + 2 workflow
php -S localhost:8000 api.php         # http://localhost:8000

# Frontend (in un altro terminale)
cd frontend
npm install
npm run dev                           # http://localhost:5173 (proxy verso :8000 gia' configurato)
```

Utenti demo (password per tutti: `password123`):

- `admin@demo.it` — Amministratore Aziendale (crea/pubblica workflow)
- `supervisore@demo.it` — Supervisore (vede tutti i processi, puo' approvare)
- `operatore@demo.it` — Operatore (vede solo i propri task)
- `superadmin@platform.it` — Super Amministratore (vede tutte le aziende)

## Deploy su Aruba

Il workflow `.github/workflows/deploy-aruba.yml` fa tutto da solo ad ogni push su `main`:

1. builda il frontend (con `VITE_API_BASE=/projects/flowsphere/api`, da adattare al path scelto)
2. carica `frontend/dist/` via FTP su `.../projects/flowsphere/`
3. carica `backend-php/` via FTP su `.../projects/flowsphere/api/` (esclude sempre il file
   `.sqlite`, cosi' non sovrascrive mai il database gia' in produzione)

Servono i secrets GitHub `FTP_USERNAME` e `FTP_PASSWORD` (le stesse credenziali FTP di Aruba).

**Al primo deploy soltanto**, vai una volta con il browser su
`https://www.filippomorano.com/projects/flowsphere/api/seed.php` per popolare il database
(azienda demo, utenti, 2 workflow di esempio), poi rinomina o elimina `seed.php` dal server
per sicurezza (evita che chiunque possa rieseguirlo).

Verifica anche che il file `backend-php/data/.htaccess` sia stato caricato: nega l'accesso
diretto al database SQLite da browser (senza sarebbe scaricabile da chiunque conosca l'URL).

## Cosa funziona gia'

- Login unificato + selettore applicazioni (multi-tenant, multi-app)
- Designer drag & drop dei workflow (React Flow) con tutti i tipi di nodo previsti:
  Start, Form, Approvazione, Decisione Automatica, Nodo AI, Invio Email, Webhook/API,
  Upload Documenti, Commento, Fine Processo
- Pubblicazione workflow (versionamento automatico)
- Motore di esecuzione: avanza da solo sui nodi automatici e si ferma sui nodi che
  richiedono un umano (form, approvazione, upload)
- Istanze di processo con codice progressivo ("Richiesta #2458"), stato, timeline/audit
  log completo (nessuna azione viene mai cancellata), commenti
- Nodo AI con percentuale di confidenza: sopra il 90% procede da solo, altrimenti
  assegna a un responsabile
- Dashboard con i KPI richiesti (attivi, conclusi, tempo medio, % approvazioni, decisioni AI)

## Cosa manca ancora (prossimi passi naturali)

- Gestione utenti/ruoli/aziende da interfaccia (oggi solo da seed/DB)
- Upload reale degli allegati (oggi simulato) e versionamento file
- Notifiche email reali (oggi solo salvate a DB) e canali futuri (WhatsApp/Teams/Slack)
- MFA e OAuth sul login
- Applicazioni successive del hub (Timesheet, CRM, Ticket, ...) — il modello dati e
  il selettore app sono gia' pronti ad ospitarle
