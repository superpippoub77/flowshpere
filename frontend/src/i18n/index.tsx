import { createContext, useContext, useState, ReactNode } from "react";

const translations = {
  it: {
    search_placeholder: "Cerca ovunque...",
    search_no_results: "Nessun risultato",
    profile: "Profilo",
    edit_profile: "Modifica profilo",
    full_name: "Nome completo",
    new_password: "Nuova password (lascia vuoto per non cambiarla)",
    save: "Salva",
    cancel: "Annulla",
    logout: "Esci",
    light_theme: "Tema chiaro",
    dark_theme: "Tema scuro",
    language: "Lingua",
    saved: "Salvato",
    saving: "Salvataggio in corso...",
    save_error: "Errore di salvataggio",
    collapse_sidebar: "Comprimi il menu",
    expand_sidebar: "Espandi il menu",
    administration: "Amministrazione",
    companies: "Aziende",
    users: "Utenti",
    permissions: "Permessi",
  },
  en: {
    search_placeholder: "Search everything...",
    search_no_results: "No results",
    profile: "Profile",
    edit_profile: "Edit profile",
    full_name: "Full name",
    new_password: "New password (leave blank to keep it)",
    save: "Save",
    cancel: "Cancel",
    logout: "Log out",
    light_theme: "Light theme",
    dark_theme: "Dark theme",
    language: "Language",
    saved: "Saved",
    saving: "Saving...",
    save_error: "Save failed",
    collapse_sidebar: "Collapse menu",
    expand_sidebar: "Expand menu",
    administration: "Administration",
    companies: "Companies",
    users: "Users",
    permissions: "Permissions",
  },
};

export type Lang = keyof typeof translations;
type Key = keyof typeof translations["it"];

const I18nContext = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: Key) => string }>({
  lang: "it",
  setLang: () => {},
  t: (k) => k,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem("wf_lang") as Lang) || "it");

  function setLang(l: Lang) {
    localStorage.setItem("wf_lang", l);
    setLangState(l);
  }

  function t(key: Key): string {
    return translations[lang][key] ?? translations.it[key] ?? key;
  }

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
