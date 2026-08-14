"use client";

import { getNetworkToken } from "@/lib/networkSession";

function guestKey(gameCode: string) {
  return `goonginga.feud.development.${String(gameCode).toUpperCase()}`;
}

let currentTabId: string | null = null;

function tabId() {
  if (!currentTabId) currentTabId = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  return currentTabId;
}

function tokenPayload(token: string) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const decoded = JSON.parse(window.atob(normalized)) as { id?: number; accountType?: string; exp?: number };
    if (decoded.exp && decoded.exp * 1000 <= Date.now()) return null;
    return decoded;
  } catch {
    return null;
  }
}

function leaseKey(gameCode: string, memberId: number) {
  return `goonginga.feud.lease.${String(gameCode).toUpperCase()}.${memberId}`;
}

function claimTab(gameCode: string, memberId: number) {
  try {
    const key = leaseKey(gameCode, memberId);
    const existing = JSON.parse(window.localStorage.getItem(key) || "null") as { tabId?: string; at?: number } | null;
    if (existing?.tabId && existing.tabId !== tabId() && Date.now() - Number(existing.at || 0) < 30000) return false;
    window.localStorage.setItem(key, JSON.stringify({ tabId: tabId(), at: Date.now() }));
  } catch { /* storage can be restricted; sessionStorage remains the fallback */ }
  return true;
}

export function getFeudGuestToken(gameCode: string) {
  if (typeof window === "undefined") return null;
  try {
    const token = window.sessionStorage.getItem(guestKey(gameCode));
    const payload = token ? tokenPayload(token) : null;
    if (!token || payload?.accountType !== "FEUD_GUEST" || typeof payload.id !== "number") return null;
    if (!claimTab(gameCode, payload.id)) {
      window.sessionStorage.removeItem(guestKey(gameCode));
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

export function saveFeudGuestToken(gameCode: string, token: string) {
  if (typeof window === "undefined" || tokenPayload(token)?.accountType !== "FEUD_GUEST") return false;
  try {
    window.sessionStorage.setItem(guestKey(gameCode), token);
    window.dispatchEvent(new Event("feud-guest-session-changed"));
    return true;
  } catch {
    return false;
  }
}

export function clearFeudGuestToken(gameCode: string) {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.removeItem(guestKey(gameCode)); } catch { /* restricted storage */ }
  window.dispatchEvent(new Event("feud-guest-session-changed"));
}

export function releaseFeudGuestTab(gameCode: string, token: string) {
  if (typeof window === "undefined") return;
  const payload = tokenPayload(token);
  if (typeof payload?.id !== "number") return;
  try {
    const key = leaseKey(gameCode, payload.id);
    const current = JSON.parse(window.localStorage.getItem(key) || "null") as { tabId?: string } | null;
    if (current?.tabId === tabId()) window.localStorage.removeItem(key);
  } catch { /* no shared lease to release */ }
}

export function getFeudAccessToken(gameCode: string) {
  return getFeudGuestToken(gameCode) || getNetworkToken();
}
