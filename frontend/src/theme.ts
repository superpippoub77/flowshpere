import { createTheme } from "@mui/material/styles";

// Identita' visiva: "sala controllo / tavolo da disegno tecnico".
// Il canvas dei workflow e' letteralmente uno schema tecnico, quindi
// l'intera app riprende il linguaggio dei disegni blueprint: carta blu
// cianotipo, righe guida, timbri d'angolo, dati in monospace.
export const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#7fb8d9", contrastText: "#0e1a2b" },
    secondary: { main: "#e8a33d" },
    success: { main: "#4f9e8c" },
    error: { main: "#b33f2e" },
    warning: { main: "#e8a33d" },
    background: {
      default: "#0e1a2b",
      paper: "#132540",
    },
    text: {
      primary: "#f2f6f5",
      secondary: "rgba(242,246,245,0.65)",
    },
    divider: "rgba(127,184,217,0.18)",
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
          border: "1px solid rgba(127,184,217,0.14)",
        },
      },
    },
    MuiButton: {
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
  },
});
