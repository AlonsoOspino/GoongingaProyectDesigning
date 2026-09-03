"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CalendarPlus,
  CheckCircle2,
  ClipboardList,
  Flag,
  ListChecks,
  Loader2,
  ShieldAlert,
  Trophy,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { getCurrentNetworkMember } from "@/lib/api/networkMember";
import { readNetworkSessionToken } from "@/features/networkSession/storage";
import {
  adminCreateTeam,
  adminCreateTeams,
  adminGenerateRoundRobin,
  createTournament,
  getCurrentTournament,
  startTournamentPlayoffs,
  updateTournament,
} from "@/lib/api/admin";
import { getLeaderboard } from "@/lib/api/team";
import { getMatchesByTournament } from "@/lib/api/match";
import type { Match, Team, Tournament } from "@/lib/api/types";

/* Los cuatro pasos reales del ciclo que repasamos: crear la season la deja en
 * SCHEDULED, y el bracket (PLAYOFFS/SEMIFINALS/FINALS) vive todo bajo "Playoffs". */
const STEPS = ["Scheduled", "Round Robin", "Playoffs", "Finished"] as const;

function stepIndex(state: Tournament["state"] | undefined): number {
  switch (state) {
    case "SCHEDULED":
      return 0;
    case "ROUNDROBIN":
      return 1;
    case "PLAYOFFS":
    case "SEMIFINALS":
    case "FINALS":
      return 2;
    case "FINISHED":
      return 3;
    default:
      return 0;
  }
}

const PLAYOFF_ROUND_LABEL: Record<number, string> = {
  1: "Quarterfinals",
  2: "Semifinals",
  3: "Grand Final",
};

interface ConfirmState {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  run: () => Promise<void>;
}

export default function SeasonControlPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);

  // Formularios
  const [seasonName, setSeasonName] = useState("");
  const [seasonDate, setSeasonDate] = useState("");
  const [teamMode, setTeamMode] = useState<"bulk" | "single">("bulk");
  const [teamCount, setTeamCount] = useState("8");
  const [teamPrefix, setTeamPrefix] = useState("Team");
  const [singleTeamName, setSingleTeamName] = useState("");
  const [seedSelection, setSeedSelection] = useState<number[]>([]);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const current = await getCurrentTournament({ cache: "no-store" }).catch(() => null);
      setTournament(current);
      if (current) {
        const [nextTeams, nextMatches] = await Promise.all([
          getLeaderboard(current.id),
          getMatchesByTournament(current.id).catch(() => [] as Match[]),
        ]);
        setTeams(nextTeams);
        setMatches(nextMatches);
      } else {
        setTeams([]);
        setMatches([]);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load the season.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const sessionToken = readNetworkSessionToken();
    if (!sessionToken) {
      router.replace("/login?next=/admin-dashboard/season");
      return;
    }
    setToken(sessionToken);
    getCurrentNetworkMember(sessionToken)
      .then((me) => {
        if (!me.roles.includes("ADMIN")) {
          router.replace("/admin-dashboard");
          return;
        }
        setReady(true);
        void refresh();
      })
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Unable to verify your admin access.")
      );
  }, [refresh, router]);

  const roundRobinMatches = useMemo(
    () => matches.filter((match) => match.type === "ROUNDROBIN"),
    [matches]
  );
  const roundRobinRemaining = useMemo(
    () => roundRobinMatches.filter((match) => match.status !== "FINISHED").length,
    [roundRobinMatches]
  );
  const teamName = useCallback(
    (id: number) => teams.find((team) => team.id === id)?.name || `Team #${id}`,
    [teams]
  );

  const current = stepIndex(tournament?.state);
  const canCreateSeason = !tournament || tournament.state === "FINISHED";

  // El seed sale del orden del leaderboard entre los 8 elegidos, igual que el backend.
  const orderedSelection = useMemo(
    () => teams.filter((team) => seedSelection.includes(team.id)),
    [teams, seedSelection]
  );

  async function guard(key: string, run: () => Promise<void>) {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await run();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Something went wrong.");
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  }

  const doCreateSeason = () =>
    guard("create-season", async () => {
      if (!token) return;
      if (!seasonName.trim() || !seasonDate) {
        throw new Error("A season name and start date are required.");
      }
      await createTournament(token, { name: seasonName.trim(), startDate: seasonDate });
      setSeasonName("");
      setSeasonDate("");
      setNotice(`Season "${seasonName.trim()}" created. It starts in the Scheduled phase.`);
      await refresh();
    });

  const doCreateTeams = () =>
    guard("create-teams", async () => {
      if (!token || !tournament) return;
      if (teamMode === "bulk") {
        const count = Number(teamCount);
        if (!Number.isInteger(count) || count < 1) throw new Error("Enter a valid team count.");
        const result = await adminCreateTeams(token, {
          count,
          tournamentId: tournament.id,
          namePrefix: teamPrefix.trim() || "Team",
        });
        setNotice(`Created ${result.created} team(s): ${result.names.join(", ")}.`);
      } else {
        if (!singleTeamName.trim()) throw new Error("Enter a team name.");
        await adminCreateTeam(token, { name: singleTeamName.trim(), tournamentId: tournament.id });
        setNotice(`Team "${singleTeamName.trim()}" created.`);
        setSingleTeamName("");
      }
      await refresh();
    });

  const doStartRoundRobin = () =>
    guard("start-rr", async () => {
      if (!token || !tournament) return;
      // Solo pasar de estado si aún estamos en SCHEDULED; si ya está en
      // ROUNDROBIN (p. ej. una generación previa falló) solo generamos.
      if (tournament.state === "SCHEDULED") {
        await updateTournament(token, tournament.id, { state: "ROUNDROBIN" });
      }
      await adminGenerateRoundRobin(token, {
        tournamentId: tournament.id,
        bestOf: 3,
        confirmationText: "CONFIRM ROUND ROBIN",
      });
      setNotice("Round robin generated. The season is now in the Round Robin phase.");
      await refresh();
    });

  const doStartPlayoffs = () =>
    guard("start-playoffs", async () => {
      if (!token || !tournament) return;
      if (seedSelection.length !== 8) throw new Error("Select exactly 8 teams for the bracket.");
      await startTournamentPlayoffs(token, tournament.id, orderedSelection.map((team) => team.id));
      setNotice("Playoff bracket created with 1v8 · 2v7 · 3v6 · 4v5 seeding.");
      setSeedSelection([]);
      await refresh();
    });

  function toggleSeed(teamId: number) {
    setSeedSelection((current) => {
      if (current.includes(teamId)) return current.filter((id) => id !== teamId);
      if (current.length >= 8) return current; // tope de 8
      return [...current, teamId];
    });
  }

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-muted">
        {error ? (
          <span className="text-danger">{error}</span>
        ) : (
          <>
            <Loader2 size={16} className="animate-spin" /> Verifying admin access…
          </>
        )}
      </div>
    );
  }

  return (
    <main>
      <header className="mb-8 border-b border-border-subtle pb-5">
        <p className="font-mono text-[0.66rem] uppercase tracking-[0.3em] text-accent">Administration</p>
        <h1 className="mt-1 font-otp text-6xl uppercase leading-[0.9]">Season Control</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Drive the full season lifecycle — from creating the tournament to seeding the playoff bracket.
        </p>
      </header>

      {error && (
        <div className="mb-5 flex items-start gap-2 rounded-sm border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-5 flex items-start gap-2 rounded-sm border border-brand-bright/30 bg-brand-bright/10 p-3 text-sm text-text-primary">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-brand-bright" />
          {notice}
        </div>
      )}

      {/* ---- Stepper de fase ---- */}
      <Stepper current={current} hasSeason={Boolean(tournament)} />

      {loading ? (
        <div className="mt-8 flex items-center gap-2 text-sm text-muted">
          <Loader2 size={16} className="animate-spin" /> Loading season…
        </div>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {/* ---- Panel de estado ---- */}
          <StatusPanel
            tournament={tournament}
            teamCount={teams.length}
            roundRobinTotal={roundRobinMatches.length}
            roundRobinRemaining={roundRobinRemaining}
          />

          {/* ---- Acciones por fase ---- */}
          <div className="space-y-6 lg:col-span-2">
            {canCreateSeason && (
              <Card variant="bordered">
                <CardHeader className="flex items-center gap-2">
                  <CalendarPlus size={18} className="text-accent" />
                  <CardTitle>{tournament ? "Create the next season" : "Create a season"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {tournament && tournament.state === "FINISHED" && (
                    <p className="text-sm text-muted">
                      {tournament.name} is finished. You can open the next season now.
                    </p>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Season name"
                      placeholder="Example: Goonginga League — Season 9"
                      value={seasonName}
                      onChange={(event) => setSeasonName(event.target.value)}
                    />
                    <Input
                      label="Start date"
                      type="date"
                      value={seasonDate}
                      onChange={(event) => setSeasonDate(event.target.value)}
                    />
                  </div>
                  <Button
                    onClick={() =>
                      setConfirm({
                        title: "Create season",
                        body: (
                          <p>
                            This creates <strong>{seasonName.trim() || "the season"}</strong> in the Scheduled
                            phase. Only one season can be active at a time.
                          </p>
                        ),
                        confirmLabel: "Create season",
                        run: doCreateSeason,
                      })
                    }
                    disabled={busy !== null || !seasonName.trim() || !seasonDate}
                  >
                    <CalendarPlus size={16} /> Create season
                  </Button>
                </CardContent>
              </Card>
            )}

            {tournament && tournament.state === "SCHEDULED" && (
              <>
                <Card variant="bordered">
                  <CardHeader className="flex items-center gap-2">
                    <Users size={18} className="text-accent" />
                    <CardTitle>Add teams</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={teamMode === "bulk" ? "secondary" : "outline"}
                        onClick={() => setTeamMode("bulk")}
                      >
                        Bulk
                      </Button>
                      <Button
                        size="sm"
                        variant={teamMode === "single" ? "secondary" : "outline"}
                        onClick={() => setTeamMode("single")}
                      >
                        Single
                      </Button>
                    </div>
                    {teamMode === "bulk" ? (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Input
                          label="How many teams"
                          type="number"
                          min={1}
                          value={teamCount}
                          onChange={(event) => setTeamCount(event.target.value)}
                        />
                        <Input
                          label="Name prefix"
                          value={teamPrefix}
                          onChange={(event) => setTeamPrefix(event.target.value)}
                        />
                      </div>
                    ) : (
                      <Input
                        label="Team name"
                        placeholder="Example: Midtown Meteors"
                        value={singleTeamName}
                        onChange={(event) => setSingleTeamName(event.target.value)}
                      />
                    )}
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        variant="outline"
                        onClick={() => void doCreateTeams()}
                        disabled={busy !== null}
                      >
                        {busy === "create-teams" ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} />}
                        Add teams
                      </Button>
                      <span className="text-sm text-muted">{teams.length} team(s) so far</span>
                      <Link
                        href="/admin-dashboard/roster"
                        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text-primary"
                      >
                        <ClipboardList size={15} /> Assign players in Roster
                      </Link>
                    </div>
                  </CardContent>
                </Card>

                <Card variant="bordered">
                  <CardHeader className="flex items-center gap-2">
                    <ListChecks size={18} className="text-accent" />
                    <CardTitle>Start the Round Robin</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted">
                      Moves the season into Round Robin and generates every weekly fixture with the circle method
                      (no team plays twice in a week). This can only be generated once.
                    </p>
                    <Button
                      onClick={() =>
                        setConfirm({
                          title: "Generate Round Robin",
                          body: (
                            <p>
                              This advances <strong>{tournament.name}</strong> to Round Robin and creates the full
                              fixture list for {teams.length} teams. It cannot be regenerated without deleting the
                              matches first.
                            </p>
                          ),
                          confirmLabel: "Generate Round Robin",
                          run: doStartRoundRobin,
                        })
                      }
                      disabled={busy !== null || teams.length < 2}
                    >
                      <ListChecks size={16} /> Advance to Round Robin
                    </Button>
                    {teams.length < 2 && (
                      <p className="text-xs text-warning">Add at least 2 teams first.</p>
                    )}
                  </CardContent>
                </Card>
              </>
            )}

            {tournament && tournament.state === "ROUNDROBIN" && (
              <Card variant="bordered">
                <CardHeader className="flex items-center gap-2">
                  <Trophy size={18} className="text-accent" />
                  <CardTitle>Playoffs</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {roundRobinMatches.length === 0 ? (
                    <>
                      <p className="text-sm text-muted">
                        The season is in Round Robin but no fixtures exist yet. Generate them to continue.
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => void doStartRoundRobin()}
                        disabled={busy !== null || teams.length < 2}
                      >
                        {busy === "start-rr" ? <Loader2 size={16} className="animate-spin" /> : <ListChecks size={16} />}
                        Generate the fixtures
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-muted">
                        Select the <strong>8 teams</strong> that make playoffs. Seeds follow the standings order of
                        your selection, and the bracket is built <strong>1v8 · 2v7 · 3v6 · 4v5</strong>.
                      </p>
                      {roundRobinRemaining > 0 && (
                        <div className="flex items-center gap-2 rounded-sm border border-warning/30 bg-warning/10 p-2.5 text-xs text-warning">
                          <Flag size={14} /> {roundRobinRemaining} round robin match(es) still unfinished — finish
                          them before starting playoffs.
                        </div>
                      )}
                      <SeedPicker
                        teams={teams}
                        selection={seedSelection}
                        onToggle={toggleSeed}
                      />
                      <Button
                        onClick={() =>
                          setConfirm({
                            title: "Start Playoffs",
                            body: (
                              <div className="space-y-2">
                                <p>This eliminates every non‑selected team and locks the bracket:</p>
                                <ol className="list-inside list-decimal text-sm text-muted">
                                  {orderedSelection.map((team, index) => (
                                    <li key={team.id}>
                                      Seed {index + 1} — {team.name}
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            ),
                            confirmLabel: "Create bracket",
                            danger: true,
                            run: doStartPlayoffs,
                          })
                        }
                        disabled={busy !== null || seedSelection.length !== 8 || roundRobinRemaining > 0}
                      >
                        <Trophy size={16} /> Start Playoffs ({seedSelection.length}/8)
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {tournament && current === 2 && (
              <Bracket matches={matches} teamName={teamName} />
            )}

            {tournament && tournament.state === "FINISHED" && (
              <Card variant="bordered">
                <CardHeader className="flex items-center gap-2">
                  <Flag size={18} className="text-accent" />
                  <CardTitle>Season finished</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted">
                    {tournament.name} is complete. Use the “Create the next season” card above to open the next one.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      <Modal isOpen={confirm !== null} onClose={() => (busy ? undefined : setConfirm(null))} title={confirm?.title}>
        <div className="space-y-4 text-sm text-text-primary">
          {confirm?.body}
          <ModalFooter className="-mx-6 -mb-6 mt-2">
            <Button variant="ghost" onClick={() => setConfirm(null)} disabled={busy !== null}>
              Cancel
            </Button>
            <Button
              variant={confirm?.danger ? "danger" : "primary"}
              onClick={() => confirm && void confirm.run()}
              disabled={busy !== null}
            >
              {busy !== null ? <Loader2 size={16} className="animate-spin" /> : null}
              {confirm?.confirmLabel}
            </Button>
          </ModalFooter>
        </div>
      </Modal>
    </main>
  );
}

/* ------------------------------------------------------------------ */

function Stepper({ current, hasSeason }: { current: number; hasSeason: boolean }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-3">
      {STEPS.map((label, index) => {
        const done = hasSeason && index < current;
        const now = hasSeason && index === current;
        return (
          <li key={label} className="flex items-center gap-2">
            <div
              className={[
                "flex items-center gap-2 rounded-sm border px-3 py-2",
                now
                  ? "border-accent bg-accent/10"
                  : done
                  ? "border-border-strong bg-surface-1"
                  : "border-border-subtle bg-surface-1/50",
              ].join(" ")}
              aria-current={now ? "step" : undefined}
            >
              <span
                className={[
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                  now
                    ? "bg-accent text-accent-foreground"
                    : done
                    ? "bg-border-strong text-text-primary"
                    : "bg-surface-3 text-muted",
                ].join(" ")}
              >
                {done ? <CheckCircle2 size={14} /> : index + 1}
              </span>
              <div className="leading-tight">
                <span className="block text-[0.6rem] uppercase tracking-wider text-muted">
                  {now ? "Now" : done ? "Done" : "Upcoming"}
                </span>
                <span className="block text-sm font-medium text-text-primary">{label}</span>
              </div>
            </div>
            {index < STEPS.length - 1 && (
              <span aria-hidden className={done ? "text-border-strong" : "text-border-subtle"}>
                →
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function StatusPanel({
  tournament,
  teamCount,
  roundRobinTotal,
  roundRobinRemaining,
}: {
  tournament: Tournament | null;
  teamCount: number;
  roundRobinTotal: number;
  roundRobinRemaining: number;
}) {
  return (
    <Card variant="elevated" className="h-fit">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy size={18} className="text-accent" />
          {tournament ? tournament.name : "No active season"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {tournament ? (
          <>
            <Row label="Phase">
              <Badge variant={tournament.state === "FINISHED" ? "default" : "secondary"}>
                {tournament.state}
              </Badge>
            </Row>
            <Row label="Start date">
              <span className="text-text-primary">
                {new Date(tournament.startDate).toLocaleDateString("en-US")}
              </span>
            </Row>
            <Row label="Teams">
              <span className="text-text-primary">{teamCount}</span>
            </Row>
            {roundRobinTotal > 0 && (
              <Row label="Round robin">
                <span className="text-text-primary">
                  {roundRobinTotal - roundRobinRemaining}/{roundRobinTotal} played
                </span>
              </Row>
            )}
          </>
        ) : (
          <p className="text-muted">Create a season to begin the lifecycle.</p>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted">{label}</span>
      {children}
    </div>
  );
}

function SeedPicker({
  teams,
  selection,
  onToggle,
}: {
  teams: Team[];
  selection: number[];
  onToggle: (teamId: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      {teams.map((team, index) => {
        const picked = selection.includes(team.id);
        // `teams` ya viene en orden de leaderboard, así que el seed = cuántos
        // elegidos hay hasta esta fila inclusive. Es el mismo criterio del backend.
        const seed = picked
          ? teams.slice(0, index + 1).filter((t) => selection.includes(t.id)).length
          : null;
        return (
          <button
            key={team.id}
            type="button"
            onClick={() => onToggle(team.id)}
            aria-pressed={picked}
            className={[
              "flex w-full items-center justify-between gap-3 rounded-sm border px-3 py-2 text-left text-sm transition-colors",
              picked
                ? "border-accent bg-accent/10 text-text-primary"
                : "border-border-subtle bg-surface-inset text-muted hover:border-border-strong hover:text-text-primary",
            ].join(" ")}
          >
            <span className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted">#{index + 1}</span>
              {team.name}
            </span>
            <span className="flex items-center gap-2">
              <span className="text-xs text-muted">
                {team.victories}W · {team.defeats}L
              </span>
              {picked && <Badge variant="primary">Seed {seed}</Badge>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Bracket({
  matches,
  teamName,
}: {
  matches: Match[];
  teamName: (id: number) => string;
}) {
  const rounds = [1, 2, 3]
    .map((round) => ({
      round,
      label: PLAYOFF_ROUND_LABEL[round],
      items: matches
        .filter((match) => match.playoffRound === round)
        .sort((a, b) => (a.playoffSlot ?? 0) - (b.playoffSlot ?? 0)),
    }))
    .filter((group) => group.items.length > 0);

  if (rounds.length === 0) return null;

  return (
    <Card variant="bordered">
      <CardHeader className="flex items-center gap-2">
        <Trophy size={18} className="text-accent" />
        <CardTitle>Playoff bracket</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-3">
        {rounds.map((group) => (
          <div key={group.round} className="space-y-3">
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.24em] text-muted">{group.label}</p>
            {group.items.map((match) => {
              const winnerA = match.mapWinsTeamA > match.mapWinsTeamB;
              const winnerB = match.mapWinsTeamB > match.mapWinsTeamA;
              const finished = match.status === "FINISHED";
              return (
                <div key={match.id} className="rounded-sm border border-border-subtle bg-surface-inset p-2.5">
                  <SeedLine name={teamName(match.teamAId)} score={match.mapWinsTeamA} won={finished && winnerA} />
                  <div className="my-1 h-px bg-border-subtle" />
                  <SeedLine name={teamName(match.teamBId)} score={match.mapWinsTeamB} won={finished && winnerB} />
                  {!finished && (
                    <p className="mt-1.5 text-[0.65rem] uppercase tracking-wider text-muted">{match.status}</p>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SeedLine({ name, score, won }: { name: string; score: number; won: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={won ? "text-sm font-semibold text-text-primary" : "text-sm text-muted"}>{name}</span>
      <span className={won ? "text-sm font-semibold text-accent" : "text-sm text-muted"}>{score}</span>
    </div>
  );
}
