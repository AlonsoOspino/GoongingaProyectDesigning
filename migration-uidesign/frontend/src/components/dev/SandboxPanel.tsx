"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "@/features/session/SessionProvider";
import {
  readNetworkSessionUser,
  type NetworkSessionUser,
} from "@/features/networkSession/storage";
import {
  createSandboxMatch,
  deleteSandboxMatch,
  getSandboxStatus,
  setSandboxAutopilot,
  stepSandboxOnce,
  type SandboxStatus,
} from "@/lib/api/devSandbox";

const STATUS_POLL_MS = 2000;
const BEST_OF_CHOICES = [3, 5, 7];

/*
 * Control surface for the developer sandbox: a real match, in a season the
 * public site cannot see, played by stand-in captains that drive the actual
 * draft endpoints. Gated to admins and developers, because it creates matches.
 */
export function SandboxPanel() {
  const { token, isHydrated } = useSession();
  const [networkUser, setNetworkUser] = useState<NetworkSessionUser | null>(null);
  const [networkReady, setNetworkReady] = useState(false);
  const [status, setStatus] = useState<SandboxStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bestOf, setBestOf] = useState(5);
  /*
   * Starting the captains immediately is right for watching a series play out,
   * and wrong for testing anything that only exists in STARTING: the first tick
   * moves the draft on within three seconds. So it is a choice, not a default
   * you have to race.
   */
  const [startCaptains, setStartCaptains] = useState(true);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    const refresh = () => {
      setNetworkUser(readNetworkSessionUser());
      setNetworkReady(true);
    };
    refresh();
    window.addEventListener("network-session-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("network-session-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  // Same gate the admin dashboard uses: the people who maintain the league
  // software can reach their own tools without holding a full admin role.
  const canUseSandbox = Boolean(
    networkUser?.roles.some((role) => role === "ADMIN" || role === "DEVELOPER")
  );

  const refreshStatus = useCallback(async () => {
    if (!token) return;
    try {
      setStatus(await getSandboxStatus(token));
      setError(null);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "The sandbox status is unavailable."
      );
    }
  }, [token]);

  useEffect(() => {
    if (!canUseSandbox || !token) return;
    void refreshStatus();
    pollRef.current = window.setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void refreshStatus();
    }, STATUS_POLL_MS);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [canUseSandbox, token, refreshStatus]);

  const run = useCallback(
    async (label: string, action: () => Promise<SandboxStatus | void>) => {
      if (!token) return;
      setBusy(label);
      setError(null);
      try {
        const next = await action();
        if (next) setStatus(next);
        else await refreshStatus();
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "That action failed.");
      } finally {
        setBusy(null);
      }
    },
    [token, refreshStatus]
  );
  const autopilotRunning = status?.autopilot.running ?? false;
  const liveMatches = useMemo(
    () => (status?.matches ?? []).filter((match) => match.status !== "FINISHED"),
    [status]
  );

  // The section around this panel already has a heading, so it always renders a
  // frame. Returning null here would leave a title with nothing under it, which
  // reads as a broken page rather than as a locked tool.
  if (!isHydrated || !networkReady) {
    return (
      <div className="border border-white/15 bg-black/25 p-5">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-zinc-500">Sandbox</p>
        <p className="mt-3 text-sm text-zinc-400">Checking your session...</p>
      </div>
    );
  }

  if (!canUseSandbox) {
    return (
      <div className="border border-white/15 bg-black/25 p-5">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-zinc-500">Sandbox</p>
        <p className="mt-3 text-sm text-zinc-400">
          Sign in with an admin or developer account to create a test match here.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-accent/40 bg-black/30 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-accent">
            Developer sandbox
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">
            Creates a real match with a real draft, inside a season the public site cannot see.
            Stand-in captains pick modes, maps and heroes through the same endpoints a real captain
            uses, every {(status?.autopilot.tickMs ?? 3000) / 1000} seconds.
          </p>
        </div>

        <span
          className={`shrink-0 border px-3 py-1 text-xs font-black uppercase tracking-widest ${
            autopilotRunning
              ? "border-success bg-success/15 text-success"
              : "border-white/25 bg-white/5 text-zinc-400"
          }`}
        >
          {autopilotRunning ? "Autopilot on" : "Autopilot off"}
        </span>
      </div>

      {error ? (
        <p className="mt-4 border border-danger/50 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-400">
          Best of
          <select
            value={bestOf}
            onChange={(event) => setBestOf(Number(event.target.value))}
            className="border border-white/20 bg-black/40 px-2 py-1 text-sm text-white"
          >
            {BEST_OF_CHOICES.map((choice) => (
              <option key={choice} value={choice}>
                {choice}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          disabled={busy !== null}
          onClick={() =>
            void run("create", async () => {
              const created = await createSandboxMatch(token!, {
                bestOf,
                autopilot: startCaptains,
              });
              return created.status;
            })
          }
          className="border border-primary bg-primary/20 px-4 py-2 text-xs font-black uppercase tracking-widest text-primary disabled:opacity-40"
        >
          {busy === "create" ? "Creating..." : "New test match"}
        </button>

        <label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-400">
          <input
            type="checkbox"
            checked={startCaptains}
            onChange={(event) => setStartCaptains(event.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--color-accent)]"
          />
          Start captains
        </label>

        <button
          type="button"
          disabled={busy !== null}
          onClick={() =>
            void run("autopilot", () =>
              setSandboxAutopilot(token!, { running: !autopilotRunning })
            )
          }
          className="border border-white/25 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-widest text-zinc-300 disabled:opacity-40"
        >
          {autopilotRunning ? "Pause captains" : "Resume captains"}
        </button>

        <button
          type="button"
          disabled={busy !== null}
          onClick={() =>
            void run("step", async () => {
              const result = await stepSandboxOnce(token!);
              return result.status;
            })
          }
          className="border border-white/25 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-widest text-zinc-300 disabled:opacity-40"
        >
          Step once
        </button>
      </div>

      {status?.matches.length ? (
        <div className="mt-6 space-y-2">
          {status.matches.slice(0, 6).map((match) => (
            <div
              key={match.id}
              className="flex flex-wrap items-center justify-between gap-3 border border-white/10 bg-white/[0.03] px-4 py-3"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-sm text-white">#{match.id}</span>
                <span className="border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs font-black uppercase tracking-wider text-accent">
                  {match.phase ?? match.status}
                </span>
                <span className="font-mono text-sm text-zinc-300">
                  {match.mapWinsTeamA} - {match.mapWinsTeamB}
                </span>
                <span className="text-xs uppercase tracking-wider text-zinc-500">
                  Bo{match.bestOf} · game {match.gameNumber + 1}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-widest">
                <Link
                  href={`/draft-table/${match.id}`}
                  className="border border-white/20 px-3 py-1 text-zinc-300 hover:text-white"
                >
                  Draft
                </Link>
                <Link
                  href={`/overlay/map-pool/${match.id}`}
                  className="border border-white/20 px-3 py-1 text-zinc-300 hover:text-white"
                >
                  Map pool
                </Link>
                <Link
                  href={`/overlay/wincards/${match.id}`}
                  className="border border-white/20 px-3 py-1 text-zinc-300 hover:text-white"
                >
                  Wincards
                </Link>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() =>
                    void run(`delete-${match.id}`, async () => {
                      const result = await deleteSandboxMatch(token!, match.id);
                      return result.status;
                    })
                  }
                  className="border border-danger/50 px-3 py-1 text-danger disabled:opacity-40"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-6 text-sm text-zinc-500">
          No sandbox matches yet. Create one and the captains start playing it.
        </p>
      )}

      {status?.autopilot.lastResults.length ? (
        <div className="mt-5">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-zinc-500">Last moves</p>
          <ul className="mt-2 space-y-1 font-mono text-xs text-zinc-400">
            {status.autopilot.lastResults.slice(0, 4).map((result, index) => (
              <li key={`${result.matchId}-${index}`}>
                #{result.matchId} {result.step.toLowerCase().replace(/_/g, " ")} — {result.detail}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {liveMatches.length > 1 ? (
        <p className="mt-4 text-xs text-warning">
          {liveMatches.length} sandbox matches are running at once. They all advance on the same
          tick, so delete the ones you are not watching.
        </p>
      ) : null}
    </div>
  );
}
