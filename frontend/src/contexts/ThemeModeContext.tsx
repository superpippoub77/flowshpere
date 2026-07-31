import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { buildTheme } from "../theme";

type Mode = "dark" | "light";

const ThemeModeContext = createContext<{ mode: Mode; toggle: () => void }>({ mode: "dark", toggle: () => {} });

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(() => (localStorage.getItem("wf_theme") as Mode) || "dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", mode);
    localStorage.setItem("wf_theme", mode);
  }, [mode]);

  const theme = useMemo(() => buildTheme(mode), [mode]);

  function toggle() {
    setMode((m) => (m === "dark" ? "light" : "dark"));
  }

  return (
    <ThemeModeContext.Provider value={{ mode, toggle }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode() {
  return useContext(ThemeModeContext);
}
