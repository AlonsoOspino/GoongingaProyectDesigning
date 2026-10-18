import type { DraftState } from "../api/types";

/** The fields that identify a confirmed mode choice in the draft response. */
export type MapModeSnapshot = Pick<DraftState,
  "id" | "phase" | "phaseStartedAt" | "selectedMapType" | "currentMapId"
> & { match: Pick<DraftState["match"], "gameNumber"> };

/** JPA's draft version keeps late polls from undoing a confirmed action or reset. */
export function shouldAcceptDraftSnapshot(
  current: { id: number; version?: number } | null | undefined,
  incoming: { id: number; version?: number },
): boolean {
  return !current || current.id !== incoming.id
    || typeof current.version !== "number" || !Number.isFinite(current.version)
    || typeof incoming.version !== "number" || !Number.isFinite(incoming.version)
    || incoming.version >= current.version;
}

/** Initial loads and ordinary polls must never replay an existing choice. */
export function getMapModeTransitionKey(
  previous: MapModeSnapshot | null | undefined,
  next: MapModeSnapshot | null | undefined,
): string | null {
  if (!previous || !next || previous.id !== next.id
    || previous.match.gameNumber !== next.match.gameNumber
    || previous.phase !== "MAPTYPEPICKING" || next.phase !== "MAPPICKING"
    || !next.selectedMapType || next.currentMapId != null
    || !next.phaseStartedAt) return null;

  return `${next.id}:${next.match.gameNumber + 1}:${next.selectedMapType}:${next.phaseStartedAt}`;
}

/** An odd pool gives the extra map to the right; a single map stays on the left. */
export function splitModeMaps<T>(maps: readonly T[]): { left: T[]; right: T[] } {
  const split = maps.length === 1 ? 1 : Math.floor(maps.length / 2);
  return { left: maps.slice(0, split), right: maps.slice(split) };
}
