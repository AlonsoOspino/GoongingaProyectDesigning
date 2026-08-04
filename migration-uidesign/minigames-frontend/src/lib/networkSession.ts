"use client";

import { useEffect, useState } from "react";
import type { NetworkMemberRole } from "@/lib/api/types";

const STORAGE_KEY = "goonginga.network.session";

export interface NetworkSessionUser {
  id: number;
  username: string;
  avatarUrl: string | null;
  roles: NetworkMemberRole[];
}

function fromToken(token: string): NetworkSessionUser | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const decoded = JSON.parse(window.atob(normalized)) as Partial<NetworkSessionUser> & { accountType?: string; exp?: number };
    if (decoded.accountType !== "NETWORK_MEMBER" || typeof decoded.id !== "number" || typeof decoded.username !== "string" || (decoded.exp && decoded.exp * 1000 <= Date.now())) return null;
    return { id: decoded.id, username: decoded.username, avatarUrl: typeof decoded.avatarUrl === "string" ? decoded.avatarUrl : null, roles: Array.isArray(decoded.roles) ? decoded.roles as NetworkMemberRole[] : ["MEMBER"] };
  } catch {
    return null;
  }
}

export function getNetworkToken() {
  if (typeof window === "undefined") return null;
  try {
    const token = window.localStorage.getItem(STORAGE_KEY);
    return token && fromToken(token) ? token : null;
  } catch { return null; }
}

export function saveNetworkToken(token: string) {
  if (typeof window === "undefined") return null;
  const user = fromToken(token);
  if (!user) return null;
  try { window.localStorage.setItem(STORAGE_KEY, token); } catch { /* keep the current tab usable */ }
  window.dispatchEvent(new Event("network-session-changed"));
  return user;
}

export function clearNetworkSession() {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* browser storage can be restricted */ }
  window.dispatchEvent(new Event("network-session-changed"));
}

export function useNetworkSession() {
  const [user, setUser] = useState<NetworkSessionUser | null>(null);
  useEffect(() => {
    const refresh = () => {
      const token = getNetworkToken();
      setUser(token ? fromToken(token) : null);
    };
    refresh();
    window.addEventListener("network-session-changed", refresh);
    return () => window.removeEventListener("network-session-changed", refresh);
  }, []);
  return { user, token: getNetworkToken() };
}

export function hasNetworkRole(user: NetworkSessionUser | null, ...roles: NetworkMemberRole[]) {
  return Boolean(user?.roles.some((role) => roles.includes(role)));
}
