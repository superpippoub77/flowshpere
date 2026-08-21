import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { buildTheme, Density } from "../theme";

type Mode = "dark" | "light";

const ThemeModeContext = createContext<{
  mode: Mode;
  toggle: () => void;
  density: Density;
  setDensity: (d: Density) => void;
}>({ mode: "dark", toggle: () => {}, density: "comfortable", setDensity: () => {} });

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(() => (localStorage.getItem("wf_theme") as Mode) || "dark");
  const [density, setDensityState] = useState<Density>(() => (localStorage.getItem("wf_density") as Density) || "comfortable");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", mode);
    localStorage.setItem("wf_theme", mode);
  }, [mode]);

  useEffect(() => {
    localStorage.setItem("wf_density", density);
  }, [density]);

  const theme = useMemo(() => buildTheme(mode, density), [mode, density]);

  function toggle() {
    setMode((m) => (m === "dark" ? "light" : "dark"));
  }

  function setDensity(d: Density) {
    setDensityState(d);
  }

  return (
    <ThemeModeContext.Provider value={{ mode, toggle, density, setDensity }}>
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
