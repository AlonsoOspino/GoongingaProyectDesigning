import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { initialTournamentState, type TournamentState } from "@/lib/6v6Tournament";

export const tournamentMediaDir = process.env.MEDIA_DIR || path.join(process.cwd(), "uploads");
const statePath = path.join(tournamentMediaDir, "6v6-tournament.json");

export async function readTournament(): Promise<TournamentState> {
  try {
    const saved = JSON.parse(await readFile(statePath, "utf8")) as TournamentState;
    if (Array.isArray(saved.teams) && Array.isArray(saved.rounds) && Array.isArray(saved.matches)) return saved;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") console.error("6v6 state read failed:", error);
  }
  return initialTournamentState;
}

export async function writeTournament(state: TournamentState) {
  await mkdir(tournamentMediaDir, { recursive: true });
  const temporaryPath = `${statePath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(state));
  await rename(temporaryPath, statePath);
}

export async function authorizeTournamentEditor(authorization: string) {
  if (!/^Bearer \S+$/.test(authorization)) return false;
  const apiBase = (process.env.UPLOAD_AUTH_API_BASE_URL || process.env.API_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
  try {
    const response = await fetch(`${apiBase}/network-members/me`, {
      headers: { Authorization: authorization }, cache: "no-store", signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return false;
    const member = await response.json() as { roles?: unknown };
    return Array.isArray(member.roles) && member.roles.some((role) =>
      role === "ADMIN" || role === "SOCIAL_MEDIA" || role === "DEVELOPER" || role === "MANAGER"
    );
  } catch {
    return false;
  }
}
