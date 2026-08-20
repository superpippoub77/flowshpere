import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Stack,
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  MobileStepper,
  IconButton,
} from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CloseIcon from "@mui/icons-material/Close";
import KeyboardArrowLeft from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRight from "@mui/icons-material/KeyboardArrowRight";

interface HelpSlide {
  title: string;
  intro?: string;
  bullets: string[];
}

const WORKFLOW_SLIDES: HelpSlide[] = [
  {
    title: "Panoramica",
    intro: "L'app Workflow gestisce processi aziendali: disegni un flusso una volta (il \"workflow\"), poi ogni caso concreto che lo percorre e' una \"istanza\" (es. una richiesta di acquisto specifica).",
    bullets: [
      "Dashboard: indicatori di sintesi su tutti i processi (attivi, conclusi, tempo medio, % approvazioni, decisioni AI)",
      "Designer workflow: dove si progetta un processo (visibile solo ad Amministratore e Super Amministratore)",
      "Istanze: dove si avviano e si seguono i casi concreti (visibile a tutti i ruoli)",
      "Token API: per collegare sistemi esterni che inviano ordini automaticamente (visibile solo ad Amministratore e Super Amministratore)",
    ],
  },
  {
    title: "Ruoli: chi può fare cosa",
    bullets: [
      "Operatore: vede e agisce solo sulle istanze che ha creato lui o su cui è stato reso responsabile di un passo attivo; non può aprire il Designer né i Token API",
      "Supervisore: come l'Operatore ma può sempre agire su qualsiasi passo di qualsiasi istanza, anche se non è tra i responsabili assegnati (livello \"super\" solo dentro la sua azienda)",
      "Amministratore: può creare/modificare/pubblicare workflow, gestire i Token API, e come il Supervisore agire su tutto — ma solo per la propria azienda",
      "Super Amministratore: come l'Amministratore ma su tutte le aziende, più l'accesso alla sezione Amministrazione (Aziende/Utenti/Permessi) per creare aziende, utenti e assegnare chi vede cosa",
    ],
  },
  {
    title: "Creare un workflow — Elenco",
    bullets: [
      "\"Nuovo workflow\": apre subito il Designer con un blocco Inizio già pronto",
      "Colonna Azienda: solo il Super Amministratore può cambiarla con l'icona di modifica (sposta il workflow su un'altra azienda)",
      "\"Apri designer\": modifica un workflow esistente",
      "\"Pubblica\": rende il workflow disponibile per avviare nuove istanze — senza pubblicarlo, in Istanze non comparirà tra i workflow selezionabili",
    ],
  },
  {
    title: "Il Designer — i blocchi (palette a sinistra)",
    bullets: [
      "Inizio Processo: il punto di partenza, uno solo per workflow",
      "Form: raccoglie dati dall'utente (testo, numero, valuta, data, checkbox, allegato, firma, anagrafica cliente con ricerca automatica)",
      "Approvazione: qualcuno deve approvare o rifiutare, con un commento obbligatorio",
      "Decisione Automatica: prosegue da sola in base a una regola sui dati raccolti (es. importo > 1000)",
      "Nodo AI: valutazione automatica con percentuale di confidenza",
      "Invio Email / Webhook: notifiche automatiche o chiamate verso sistemi esterni (simulate)",
      "Upload Documenti / Commento: passi di raccolta allegati o semplice annotazione",
      "Fine Processo: chiude l'istanza; puoi collegarla a un altro workflow che parte subito dopo",
      "Blocchi personalizzati: se qualcuno ha salvato un blocco pronto, appare in basso nella palette con bordo tratteggiato — trascinalo come gli altri",
    ],
  },
  {
    title: "Il Designer — pannello proprietà (a destra)",
    intro: "Seleziona un blocco per modificarlo. Ogni blocco ha:",
    bullets: [
      "Etichetta e Descrizione del passo: la descrizione compare a chi deve eseguire quel passo, per spiegargli cosa fare",
      "Responsabili: chi può agire su quel passo (vuoto = agiscono Amministratore/creatore); puoi anche scegliere \"🤖 Intelligenza Artificiale\" perché il passo si risolva da solo",
      "Lettori: chi può vedere lo storico di quel passo (vuoto = lo vedono tutti quelli con accesso all'azienda)",
      "Per il Form: elenco campi con etichetta e tipo",
      "Per la Decisione Automatica: la regola (campo, operatore, valore)",
      "\"Salva come blocco personalizzato\": lo rende riutilizzabile da tutti nella palette",
      "\"Elimina nodo\": rimuove il blocco selezionato",
    ],
  },
  {
    title: "Il Designer — barra degli strumenti",
    bullets: [
      "Annulla / Ripeti (o Ctrl+Z / Ctrl+Shift+Z): fino a 100 modifiche indietro",
      "Salvataggio automatico: interruttore che, se attivo, salva la bozza da solo 2 secondi dopo l'ultima modifica",
      "Salva bozza: salva manualmente senza pubblicare",
      "Pubblica: rende disponibile la versione corrente per nuove istanze",
      "Tasto destro su un blocco: Duplica blocco / Elimina blocco",
      "Tasto destro su una connessione: Elimina connessione",
      "Tasto destro sul canvas vuoto: Allinea tutti i blocchi alla griglia",
      "Tasto Canc (o Backspace): elimina il blocco o la connessione selezionata",
    ],
  },
  {
    title: "Istanze — avviare e filtrare",
    bullets: [
      "\"Nuova istanza\": scegli un workflow pubblicato e parte subito, fermandosi al primo passo da compilare",
      "Filtro Aperti/Chiusi/Tutti in alto: di default vedi solo le istanze ancora in corso",
      "Filtri: numero ordine, workflow, stato, anagrafica (cerca nei dati inseriti), intervallo di date",
      "Colonna Andamento: un pallino per ogni passo — verde approvato, giallo lampeggiante passo attivo, rosso rigettato, grigio non ancora raggiunto",
      "Colonna Chi tocca: chi può agire ora sul passo attivo (\"Tutti\" se non è stato assegnato nessuno in particolare)",
    ],
  },
  {
    title: "Istanze — agire su un passo",
    bullets: [
      "Clicca un pallino: apre la scheda del passo — se è quello attivo e sei autorizzato, puoi compilare il form, approvare/rifiutare (con commento obbligatorio) o completare un upload",
      "Se non sei autorizzato, vedi un messaggio chiaro invece del modulo di azione",
      "Ogni passo ha due sezioni pieghevoli: Commenti (con un piccolo editor) e Allegati (trascina un file o clicca per sceglierlo)",
      "Icona Timeline sulla riga: apre una scheda a destra con la cronologia completa dell'istanza, le decisioni dell'AI e i commenti generali",
    ],
  },
  {
    title: "Token API e ordini esterni",
    bullets: [
      "\"Nuovo token\": genera una chiave da consegnare a un sistema esterno (mostrata per intero solo in quel momento)",
      "Puoi vincolare un token a un solo workflow, oppure lasciarlo libero (il sistema esterno indica quale usare a ogni chiamata)",
      "\"Disattiva\": sospende il token senza cancellarlo; il cestino lo elimina in modo definitivo",
      "Il sistema esterno chiama /api/orders.php con il token; se i dati inviati coprono già il primo form, l'istanza salta quel passo da sola",
    ],
  },
  {
    title: "Amministrazione (solo Super Amministratore)",
    bullets: [
      "Aziende: crea/rinomina/elimina aziende (l'eliminazione è bloccata se ci sono workflow collegati)",
      "Utenti: crea/modifica/elimina utenti, con foto profilo, telefono, ruolo/posizione e tipo (Utente/Amministratore/Super Amministratore)",
      "Permessi: per ogni utente, scegli quali aziende vede e con quale ruolo per ciascuna applicazione — indipendente dal tipo utente generale",
    ],
  },
];

const TICKET_SLIDES: HelpSlide[] = [
  {
    title: "Panoramica",
    intro: "L'app Ticket gestisce le richieste di assistenza, organizzate per \"rami\" (categorie come Tecnico, Amministrativo, Commerciale), ciascuno con un responsabile predefinito.",
    bullets: [
      "Ticket: l'elenco di tutte le richieste, filtrabile per ramo, stato e priorità",
      "Rami di gestione: dove si definiscono le categorie e chi le segue (visibile solo ad Amministratore e Super Amministratore)",
    ],
  },
  {
    title: "Rami di gestione",
    bullets: [
      "Ogni ramo ha un nome, una descrizione e un responsabile predefinito",
      "Quando arriva un nuovo ticket in quel ramo (creato internamente o da un modulo esterno), viene assegnato in automatico al responsabile predefinito",
      "L'eliminazione di un ramo è bloccata se ci sono ticket collegati",
    ],
  },
  {
    title: "Creare e gestire un ticket",
    bullets: [
      "\"Nuovo ticket\": oggetto, ramo, priorità (Bassa/Media/Alta/Urgente) e descrizione",
      "Aprendo un ticket puoi cambiarne lo stato (Aperto → In lavorazione → Risolto → Chiuso) e riassegnarlo a un'altra persona in qualsiasi momento",
      "La sezione Commenti tiene traccia di tutti gli scambi legati al ticket, in ordine cronologico",
    ],
  },
  {
    title: "Apertura ticket dall'esterno",
    bullets: [
      "In Token API puoi generare un token vincolato a un ramo specifico (o lasciarlo libero)",
      "Il token genera anche un link a un modulo web pronto da condividere: chi lo apre non ha bisogno di un account per aprire un ticket",
      "Il ticket aperto dall'esterno riporta nome ed email di chi lo ha scritto, e finisce comunque nel ramo giusto con l'assegnazione automatica",
    ],
  },
];

const APP_CONTENT: Record<string, HelpSlide[] | null> = {
  workflow: WORKFLOW_SLIDES,
  timesheet: null,
  ticket: TICKET_SLIDES,
  crm: null,
};

const APP_LABELS: Record<string, string> = {
  workflow: "Workflow",
  timesheet: "Timesheet Dipendenti",
  ticket: "Gestione Ticket",
  crm: "CRM",
};

export function HelpWizard({ open, onClose, appKey }: { open: boolean; onClose: () => void; appKey: string }) {
  const [step, setStep] = useState(0);
  const slides = APP_CONTENT[appKey];

  function handleClose() {
    setStep(0);
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        Guida — {APP_LABELS[appKey] ?? appKey}
        <IconButton size="small" onClick={handleClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {!slides ? (
          <Typography color="text.secondary">
            Questa applicazione non è ancora disponibile: la guida arriverà insieme al modulo.
          </Typography>
        ) : (
          <Box>
            <Typography variant="h6" sx={{ mb: 1 }}>
              {slides[step].title}
            </Typography>
            {slides[step].intro && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                {slides[step].intro}
              </Typography>
            )}
            <List dense>
              {slides[step].bullets.map((b, i) => (
                <ListItem key={i} disableGutters alignItems="flex-start">
                  <ListItemIcon sx={{ minWidth: 30, mt: 0.4 }}>
                    <CheckCircleOutlineIcon fontSize="small" color="primary" />
                  </ListItemIcon>
                  <ListItemText primary={b} />
                </ListItem>
              ))}
            </List>
          </Box>
        )}
      </DialogContent>
      {slides && (
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <MobileStepper
            variant="dots"
            steps={slides.length}
            position="static"
            activeStep={step}
            sx={{ flex: 1, background: "transparent" }}
            nextButton={
              <Button size="small" onClick={() => setStep((s) => Math.min(s + 1, slides.length - 1))} disabled={step === slides.length - 1}>
                Avanti <KeyboardArrowRight fontSize="small" />
              </Button>
            }
            backButton={
              <Button size="small" onClick={() => setStep((s) => Math.max(s - 1, 0))} disabled={step === 0}>
                <KeyboardArrowLeft fontSize="small" /> Indietro
              </Button>
            }
          />
        </DialogActions>
      )}
    </Dialog>
  );
}
