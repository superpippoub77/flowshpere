import { create } from "zustand";

export type StatusState = "idle" | "saving" | "saved" | "error";

interface StatusStore {
  state: StatusState;
  message: string;
  set: (state: StatusState, message?: string) => void;
}

export const useStatusStore = create<StatusStore>((set) => ({
  state: "idle",
  message: "",
  set: (state, message) => set({ state, message: message ?? "" }),
}));
