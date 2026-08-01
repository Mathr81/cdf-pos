import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Role } from "@cdf/shared";

interface SessionState {
  accessCode: string | null;
  adminPin: string | null;
  isAdmin: boolean;
  role: Role | null;
  /** Libellé du poste : « Caisse 1 », « Grill », etc. */
  label: string | null;
  cashierName: string | null;
  setSession: (s: Partial<SessionState>) => void;
  reset: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      accessCode: null,
      adminPin: null,
      isAdmin: false,
      role: null,
      label: null,
      cashierName: null,
      setSession: (s) => set(s),
      reset: () =>
        set({
          accessCode: null,
          adminPin: null,
          isAdmin: false,
          role: null,
          label: null,
          cashierName: null,
        }),
    }),
    { name: "cdf.session" },
  ),
);
