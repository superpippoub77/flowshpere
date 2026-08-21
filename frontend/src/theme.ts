import { createTheme } from "@mui/material/styles";

// Identita' visiva: "sala controllo / tavolo da disegno tecnico".
// Il canvas dei workflow e' letteralmente uno schema tecnico, quindi
// l'intera app riprende il linguaggio dei disegni blueprint: carta blu
// cianotipo, righe guida, timbri d'angolo, dati in monospace.
// Il tema chiaro riprende la stessa identita' su carta chiara invece che
// sul "tavolo da disegno" scuro.
export type Density = "comfortable" | "compact";

export function buildTheme(mode: "dark" | "light", density: Density = "comfortable") {
  const dark = mode === "dark";
  const compact = density === "compact";

  return createTheme({
    // La unita' di spaziatura di MUI (usata da ogni sx={{ p: N, m: N, gap: N }}
    // di tutta l'app): comprimerla qui rende tutto piu' compatto senza dover
    // toccare ogni singola pagina.
    spacing: compact ? 6 : 8,
    palette: {
      mode,
      primary: { main: dark ? "#7fb8d9" : "#1b6a94", contrastText: dark ? "#0e1a2b" : "#ffffff" },
      secondary: { main: "#c47f1f" },
      success: { main: dark ? "#4f9e8c" : "#2f7d6c" },
      error: { main: dark ? "#b33f2e" : "#a13624" },
      warning: { main: "#c47f1f" },
      background: {
        default: dark ? "#0e1a2b" : "#eef3f6",
        paper: dark ? "#132540" : "#ffffff",
      },
      text: {
        primary: dark ? "#f2f6f5" : "#12203a",
        secondary: dark ? "rgba(242,246,245,0.65)" : "rgba(18,32,58,0.65)",
      },
      divider: dark ? "rgba(127,184,217,0.18)" : "rgba(27,106,148,0.18)",
    },
    typography: {
      fontFamily: '"IBM Plex Sans", sans-serif',
      h1: { fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700 },
      h2: { fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700 },
      h3: { fontFamily: '"Space Grotesk", sans-serif', fontWeight: 600 },
      h4: { fontFamily: '"Space Grotesk", sans-serif', fontWeight: 600 },
      h5: { fontFamily: '"Space Grotesk", sans-serif', fontWeight: 600 },
      h6: { fontFamily: '"Space Grotesk", sans-serif', fontWeight: 600 },
      button: { textTransform: "none", fontWeight: 600 },
      overline: { fontFamily: '"IBM Plex Mono", monospace', letterSpacing: "0.09em" },
    },
    shape: { borderRadius: 6 },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            border: dark ? "1px solid rgba(127,184,217,0.14)" : "1px solid rgba(27,106,148,0.14)",
          },
        },
      },
      MuiButton: {
        defaultProps: compact ? { size: "small" } : undefined,
        styleOverrides: {
          root: { borderRadius: 4 },
          contained: { boxShadow: "none" },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, letterSpacing: "0.03em" },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { padding: compact ? "6px 10px" : undefined },
        },
      },
      MuiListItemButton: {
        defaultProps: compact ? { dense: true } : undefined,
      },
      MuiTextField: {
        defaultProps: compact ? { size: "small" } : undefined,
      },
    },
  });
}
