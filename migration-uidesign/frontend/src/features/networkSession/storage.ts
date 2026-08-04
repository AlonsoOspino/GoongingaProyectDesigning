import type { NetworkMemberRole } from "@/lib/api/types";

const STORAGE_KEY = "goonginga.network.session";

export interface NetworkSessionUser {
  id: number;
  username: string;
  avatarUrl: string | null;
  roles: NetworkMemberRole[];
}

function getUserFromToken(token: string): NetworkSessionUser | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;

    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, "=");
    const decoded = JSON.parse(window.atob(paddedPayload)) as Partial<NetworkSessionUser> & {
      accountType?: string;
      exp?: number;
    };

    if (
      decoded.accountType !== "NETWORK_MEMBER" ||
      typeof decoded.id !== "number" ||
      typeof decoded.username !== "string" ||
      (decoded.exp && decoded.exp * 1000 <= Date.now())
    ) {
      return null;
    }

    return {
      id: decoded.id,
      username: decoded.username,
      avatarUrl: typeof decoded.avatarUrl === "string" ? decoded.avatarUrl : null,
      roles: Array.isArray(decoded.roles) ? (decoded.roles as NetworkMemberRole[]) : ["MEMBER"],
    };
  } catch {
    return null;
  }
}

export function saveNetworkToken(token: string) {
  if (typeof window === "undefined") return null;
  const user = getUserFromToken(token);
  if (!user) return null;

  try {
    window.localStorage.setItem(STORAGE_KEY, token);
  } catch {
    // A user can still finish Discord sign-in in privacy-restricted browsers;
    // protected network features will ask them to sign in again when needed.
  }

  window.dispatchEvent(new Event("network-session-changed"));
  return user;
}

export function readNetworkSessionUser() {
  if (typeof window === "undefined") return null;

  try {
    const token = window.localStorage.getItem(STORAGE_KEY);
    return token ? getUserFromToken(token) : null;
  } catch {
    return null;
  }
}

export function clearNetworkSession() {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing else is required when browser storage is unavailable.
  }

  window.dispatchEvent(new Event("network-session-changed"));
}
