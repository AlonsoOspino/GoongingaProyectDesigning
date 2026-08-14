"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { feudEventsUrl, getFeudGame, leaveFeudDevelopmentGuestUrl, sendFeudAction, sendFeudHeartbeat, type FeudView } from "./api";
import { getFeudAccessToken, getFeudGuestToken, releaseFeudGuestTab } from "./developmentGuest";
import type { FeudProjection } from "./types";

export function useFeudGame(gameCode: string, view: FeudView) {
  const [data, setData] = useState<FeudProjection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const refreshing = useRef(false);

  const refresh = useCallback(async () => {
    if (!gameCode || refreshing.current) return;
    refreshing.current = true;
    try {
      const next = await getFeudGame(gameCode, view, getFeudAccessToken(gameCode));
      setData(next);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Family Feud is reconnecting.");
    } finally {
      refreshing.current = false;
      setLoading(false);
    }
  }, [gameCode, view]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!data?.game.timerEndsAt) return;
    const delay = Math.max(0, new Date(data.game.timerEndsAt).getTime() - new Date(data.serverNow).getTime()) + 150;
    const timer = window.setTimeout(() => void refresh(), Math.min(delay, 2147483647));
    return () => window.clearTimeout(timer);
  }, [data?.game.timerEndsAt, data?.game.version, data?.serverNow, refresh]);

  useEffect(() => {
    if (!gameCode) return;
    const controller = new AbortController();
    let retry: ReturnType<typeof setTimeout> | null = null;
    const connect = async () => {
      try {
        const token = getFeudAccessToken(gameCode);
        const response = await fetch(feudEventsUrl(gameCode, view), {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok || !response.body) throw new Error("Realtime connection unavailable");
        setConnected(true);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (!controller.signal.aborted) {
          const chunk = await reader.read();
          if (chunk.done) break;
          buffer += decoder.decode(chunk.value, { stream: true });
          if (buffer.includes("\n\n")) {
            buffer = buffer.slice(buffer.lastIndexOf("\n\n") + 2);
            void refresh();
          }
        }
      } catch {
        if (!controller.signal.aborted) {
          setConnected(false);
          retry = setTimeout(connect, 2500);
        }
      }
    };
    void connect();
    const fallback = setInterval(() => void refresh(), 8000);
    return () => { controller.abort(); if (retry) clearTimeout(retry); clearInterval(fallback); };
  }, [gameCode, refresh, view]);

  useEffect(() => {
    const token = getFeudAccessToken(gameCode);
    if (!token || !gameCode || view === "spectator") return;
    const beat = () => void sendFeudHeartbeat(token, gameCode).catch(() => undefined);
    beat();
    const interval = setInterval(beat, 20000);
    return () => clearInterval(interval);
  }, [gameCode, view]);

  useEffect(() => {
    if (!gameCode) return;
    const leave = () => {
      const token = getFeudGuestToken(gameCode);
      if (!token) return;
      void fetch(leaveFeudDevelopmentGuestUrl(gameCode), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
        keepalive: true,
      }).catch(() => undefined);
      releaseFeudGuestTab(gameCode, token);
    };
    window.addEventListener("pagehide", leave);
    return () => window.removeEventListener("pagehide", leave);
  }, [gameCode]);

  const action = useCallback(async (name: string, payload: Record<string, unknown> = {}) => {
    const token = getFeudAccessToken(gameCode);
    if (!token) throw new Error("Sign in before performing this action.");
    const next = await sendFeudAction(token, gameCode, name, payload);
    setData(next);
    return next;
  }, [gameCode]);

  return { data, error, loading, connected, refresh, action };
}
