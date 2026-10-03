import { NextResponse, type NextRequest } from "next/server";
import { authorizeTournamentEditor, readTournament, writeTournament } from "@/lib/6v6Server";
import type { TournamentState } from "@/lib/6v6Tournament";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await readTournament(), { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: NextRequest) {
  if (!await authorizeTournamentEditor(request.headers.get("authorization") || "")) {
    return NextResponse.json({ error: "Inicia sesión con acceso de producción." }, { status: 403 });
  }
  const input: unknown = await request.json().catch(() => null);
  if (!input || typeof input !== "object") return NextResponse.json({ error: "Estado inválido." }, { status: 400 });
  const state = input as TournamentState;
  if (
    typeof state.title !== "string" || state.title.length > 100 ||
    !["rounds", "brackets", "finals"].includes(state.stage) ||
    !Array.isArray(state.teams) || state.teams.length > 40 ||
    !Array.isArray(state.rounds) || state.rounds.length > 30 ||
    !Array.isArray(state.matches) || state.matches.length > 90 ||
    state.teams.some((team) => typeof team.id !== "string" || typeof team.name !== "string" || team.name.length > 80 || typeof team.logo !== "string" || team.logo.length > 300) ||
    state.matches.some((match) => !Number.isInteger(match.scoreA) || !Number.isInteger(match.scoreB) || match.scoreA < 0 || match.scoreB < 0 || match.scoreA > 99 || match.scoreB > 99)
  ) return NextResponse.json({ error: "Estado inválido." }, { status: 400 });
  await writeTournament(state);
  return NextResponse.json({ ok: true });
}
