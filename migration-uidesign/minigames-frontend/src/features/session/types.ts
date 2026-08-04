import type { AuthUser } from "@/lib/api/types";

export interface SessionState {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
}

export interface SessionContextValue extends SessionState {
  isHydrated: boolean;
  setSession: (token: string, user: AuthUser) => void;
  clearSession: () => void;
}
