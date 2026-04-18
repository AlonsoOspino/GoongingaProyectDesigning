import type { SessionState } from "@/features/session/types";

const STORAGE_KEY = "goon.live.session";

function isClient() {
  return typeof window !== "undefined";
}

export function readSessionFromStorage(): SessionState {
  if (!isClient()) {
    return { token: null, user: null, isAuthenticated: false };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { token: null, user: null, isAuthenticated: false };
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
    return { token: null, user: null, isAuthenticated: false };
  }
}

export function writeSessionToStorage(state: Pick<SessionState, "token" | "user">) {
  if (!isClient()) return;

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      token: state.token,
      user: state.user,
    })
  );
}

export function clearSessionInStorage() {
  if (!isClient()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}
