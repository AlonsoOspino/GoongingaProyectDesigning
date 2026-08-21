export type SeasonIdentity = { name?: unknown } | null | undefined;

export function resolveSeasonLabel(tournament: SeasonIdentity): string {
  return typeof tournament?.name === "string" && tournament.name.trim()
    ? tournament.name.trim()
    : "Season";
}

const seasonStatusLabels: Record<string, string> = {
  SCHEDULED: "Starting soon",
  ROUNDROBIN: "Regular season",
  PLAYOFFS: "Playoffs",
  SEMIFINALS: "Semifinals",
  FINALS: "Grand Finals",
  FINISHED: "Season complete",
};

export function resolveSeasonStatusLabel(state: unknown): string {
  return typeof state === "string" && seasonStatusLabels[state]
    ? seasonStatusLabels[state]
    : "In preparation";
}
