"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { clearSessionInStorage, readSessionFromStorage, writeSessionToStorage } from "@/features/session/storage";
import type { SessionContextValue, SessionState } from "@/features/session/types";
import type { AuthUser } from "@/lib/api/types";

const SessionContext = createContext<SessionContextValue | null>(null);

const initialState: SessionState = {
  token: null,
  user: null,
  isAuthenticated: false,
};

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>(initialState);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const persisted = readSessionFromStorage();
    setState(persisted);
    setIsHydrated(true);
  }, []);

  const setSession = useCallback((token: string, user: AuthUser) => {
    const nextState: SessionState = {
      token,
      user,
      isAuthenticated: true,
    };

    writeSessionToStorage(nextState);
    setState(nextState);
  }, []);

  const clearSession = useCallback(() => {
    clearSessionInStorage();
    setState(initialState);
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      ...state,
      isHydrated,
      setSession,
      clearSession,
    }),
    [state, isHydrated, setSession, clearSession]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return context;
}
