import type { SessionState } from "@/features/session/types";

const STORAGE_KEY = "goon.live.session";
const EMPTY_SESSION: SessionState = { token: null, user: null, isAuthenticated: false };

let memorySession: Pick<SessionState, "token" | "user"> | null = null;

function isClient() {
  return typeof window !== "undefined";
}

export function readSessionFromStorage(): SessionState {
  if (!isClient()) {
    return EMPTY_SESSION;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      if (!memorySession) return EMPTY_SESSION;
      return {
        ...memorySession,
        isAuthenticated: Boolean(memorySession.token && memorySession.user),
      };
    }

    const parsed = JSON.parse(raw) as { token?: string | null; user?: SessionState["user"] };
    const token = parsed.token ?? null;
    const user = parsed.user ?? null;

    return {
      token,
      user,
      isAuthenticated: Boolean(token && user),
    };
  } catch {
    if (!memorySession) return EMPTY_SESSION;
    return {
      ...memorySession,
      isAuthenticated: Boolean(memorySession.token && memorySession.user),
    };
  }
}

export function writeSessionToStorage(state: Pick<SessionState, "token" | "user">) {
  if (!isClient()) return;

  memorySession = {
    token: state.token,
    user: state.user,
  };

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        token: state.token,
        user: state.user,
      })
    );
  } catch {
    // Some privacy modes/extensions can block localStorage. Keep the session
    // alive in memory for the current tab so authenticated actions still work.
  }
}

export function clearSessionInStorage() {
  if (!isClient()) return;
  memorySession = null;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage may be blocked; clearing the memory fallback is enough.
  }
}
