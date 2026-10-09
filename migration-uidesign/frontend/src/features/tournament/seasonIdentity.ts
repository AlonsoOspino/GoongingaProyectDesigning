export type SeasonIdentity = { name?: unknown } | null | undefined;

export function resolveSeasonLabel(tournament: SeasonIdentity): string {
  return typeof tournament?.name === "string" && tournament.name.trim()
    ? tournament.name.trim()
    : "Season";
}

export function matchesSeasonNumber(tournament: SeasonIdentity, season: number): boolean {
  if (!Number.isInteger(season) || season < 1 || typeof tournament?.name !== "string") return false;
  const match = tournament.name.match(/\bseason\s*(\d+)\b/i);
  return match !== null && Number(match[1]) === season;
}
