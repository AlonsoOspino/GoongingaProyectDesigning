export type MatchReference = number | "dev";

export function parseMatchReference(value: unknown): MatchReference | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "dev") return "dev";

  const numeric = Number(normalized);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}
