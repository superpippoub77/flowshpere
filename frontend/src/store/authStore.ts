import { create } from "zustand";

export interface CompanyOption {
  id: string;
  name: string;
  role: string;
  roleKey: string;
  rolesByApp?: Record<string, string>;
  applications: { key: string; name: string; category?: string }[];
}

interface AuthState {
  token: string | null;
  user: { id: string; email: string; fullName: string; isSuperAdmin: boolean; hasAvatar?: boolean } | null;
  companies: CompanyOption[];
  // L'azienda selezionata ora si ricorda per singola applicazione (es. puoi
  // lavorare su Workflow per l'Azienda A e su Ticket per l'Azienda B insieme).
  // "_default" resta come ripiego generale per le pagine non legate a un'app
  // specifica (es. Amministrazione).
  currentCompanyIdByApp: Record<string, string>;
  setSession: (token: string, user: AuthState["user"]) => void;
  setCompanies: (companies: CompanyOption[]) => void;
  setCurrentCompanyForApp: (appKey: string, companyId: string) => void;
  getCurrentCompanyForApp: (appKey: string) => string | null;
  logout: () => void;
}

const stored = localStorage.getItem("wf_session");
const parsedStored = stored ? JSON.parse(stored) : {};
// Migrazione dalla vecchia sessione con un solo currentCompanyId globale:
// diventa il valore di ripiego per tutte le app finche' non se ne sceglie uno specifico.
const initialByApp: Record<string, string> =
  parsedStored.currentCompanyIdByApp ?? (parsedStored.currentCompanyId ? { _default: parsedStored.currentCompanyId } : {});

function persist(partial: Partial<{ token: string | null; user: any; currentCompanyIdByApp: Record<string, string> }>) {
  const current = JSON.parse(localStorage.getItem("wf_session") ?? "{}");
  localStorage.setItem("wf_session", JSON.stringify({ ...current, ...partial }));
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: parsedStored.token ?? null,
  user: parsedStored.user ?? null,
  companies: [],
  currentCompanyIdByApp: initialByApp,
  setSession: (token, user) => {
    set({ token, user });
    persist({ token, user });
  },
  setCompanies: (companies) => set({ companies }),
  setCurrentCompanyForApp: (appKey, companyId) => {
    const next = { ...get().currentCompanyIdByApp, [appKey]: companyId, _default: companyId };
    set({ currentCompanyIdByApp: next });
    persist({ currentCompanyIdByApp: next });
  },
  getCurrentCompanyForApp: (appKey) => {
    const byApp = get().currentCompanyIdByApp;
    return byApp[appKey] ?? byApp._default ?? null;
  },
  logout: () => {
    localStorage.removeItem("wf_session");
    set({ token: null, user: null, currentCompanyIdByApp: {}, companies: [] });
  },
}));
