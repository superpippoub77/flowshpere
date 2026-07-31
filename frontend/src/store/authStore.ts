import { create } from "zustand";

export interface CompanyOption {
  id: string;
  name: string;
  role: string;
  roleKey: string;
  applications: { key: string; name: string; category?: string }[];
}

interface AuthState {
  token: string | null;
  user: { id: string; email: string; fullName: string; isSuperAdmin: boolean } | null;
  companies: CompanyOption[];
  currentCompanyId: string | null;
  setSession: (token: string, user: AuthState["user"]) => void;
  setCompanies: (companies: CompanyOption[]) => void;
  setCurrentCompany: (companyId: string) => void;
  logout: () => void;
}

const stored = localStorage.getItem("wf_session");
const initial = stored ? JSON.parse(stored) : { token: null, user: null, currentCompanyId: null };

export const useAuthStore = create<AuthState>((set, get) => ({
  token: initial.token,
  user: initial.user,
  companies: [],
  currentCompanyId: initial.currentCompanyId,
  setSession: (token, user) => {
    set({ token, user });
    localStorage.setItem("wf_session", JSON.stringify({ token, user, currentCompanyId: get().currentCompanyId }));
  },
  setCompanies: (companies) => set({ companies }),
  setCurrentCompany: (companyId) => {
    set({ currentCompanyId: companyId });
    const { token, user } = get();
    localStorage.setItem("wf_session", JSON.stringify({ token, user, currentCompanyId: companyId }));
  },
  logout: () => {
    localStorage.removeItem("wf_session");
    set({ token: null, user: null, currentCompanyId: null, companies: [] });
  },
}));
