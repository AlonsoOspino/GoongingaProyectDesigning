"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { formatDateEST } from "@/lib/dateUtils";
import type { Match, Team } from "@/lib/api/types";
import styles from "./playoff-bracket.module.css";

type PlayoffBracketProps = {
  matches: Match[];
  teams: Team[];
  tournamentName?: string;
};

const ROUNDS = [
  { number: 1, title: "Quarterfinals", slots: 4 },
  { number: 2, title: "Semifinals", slots: 2 },
  { number: 3, title: "Grand Final", slots: 1 },
];

function winnerTeamId(match: Match) {
  if (!(["PENDINGREGISTERS", "FINISHED"] as Match["status"][]).includes(match.status)) return null;
  if (match.mapWinsTeamA > match.mapWinsTeamB) return match.teamAId;
  if (match.mapWinsTeamB > match.mapWinsTeamA) return match.teamBId;
  return null;
}

function statusLabel(match: Match) {
  if (match.status === "PENDINGREGISTERS") return "Result pending";
  if (match.status === "FINISHED") return "Final";
  if (match.status === "ACTIVE") return "Live";
  return match.startDate ? "Scheduled" : "Date TBD";
}

function TeamRow({ team, score, winner }: { team?: Team; score: number; winner: boolean }) {
  return (
    <div className={`${styles.teamRow} ${winner ? styles.winner : ""}`}>
      <span className={styles.seed}>{team?.playoffSeed ? `#${team.playoffSeed}` : "-"}</span>
      <Avatar size="sm" src={team?.logo || undefined} fallback={team?.name || "TBD"} />
      <span className={styles.teamName}>{team?.name || "To be decided"}</span>
      <span className={styles.score}>{score}</span>
    </div>
  );
}

function MatchNode({
  match,
  teamsById,
  delay,
  connector,
}: {
  match: Match | null;
  teamsById: Map<number, Team>;
  delay: number;
  connector: boolean;
}) {
  const shellStyle = { "--reveal-delay": `${delay}ms` } as CSSProperties;

  if (!match) {
    return (
      <div className={`${styles.matchShell} ${connector ? styles.connector : ""}`} style={shellStyle}>
        <div className={`${styles.matchNode} ${styles.waitingNode}`}>
          <span className={styles.waitingPulse} />
          <p>Waiting for games to be decided</p>
        </div>
      </div>
    );
  }

  const teamA = teamsById.get(match.teamAId);
  const teamB = teamsById.get(match.teamBId);
  const winnerId = winnerTeamId(match);
  const content = (
    <div className={styles.matchNode}>
      <div className={styles.matchMeta}>
        <span>{match.title || "Playoff match"}</span>
        <Badge variant={match.status === "ACTIVE" ? "danger" : match.status === "FINISHED" ? "success" : "outline"}>
          {statusLabel(match)}
        </Badge>
      </div>
      <TeamRow team={teamA} score={match.mapWinsTeamA} winner={winnerId === match.teamAId} />
      <TeamRow team={teamB} score={match.mapWinsTeamB} winner={winnerId === match.teamBId} />
      <div className={styles.matchFooter}>
        <span>BO5</span>
        <span>{match.startDate ? formatDateEST(match.startDate) : "Awaiting schedule"}</span>
      </div>
    </div>
  );

  return (
    <div className={`${styles.matchShell} ${connector ? styles.connector : ""}`} style={shellStyle}>
      <Link href={`/schedule/${match.id}`} className={styles.matchLink} aria-label={`Open ${match.title || "playoff match"}`}>
        {content}
      </Link>
    </div>
  );
}

export function PlayoffBracket({ matches, teams, tournamentName }: PlayoffBracketProps) {
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const playoffMatches = matches.filter((match) => match.playoffRound);
  const finalMatch = playoffMatches.find((match) => match.playoffRound === 3);
  const championId = finalMatch?.status === "FINISHED" ? winnerTeamId(finalMatch) : null;
  const champion = championId ? teamsById.get(championId) : null;

  return (
    <section className={styles.bracketSection} aria-label="Playoff bracket">
      <div className={styles.bracketHeader}>
        <div>
          <p className={styles.eyebrow}>Eight teams. One champion.</p>
          <h1>{tournamentName || "Playoffs"}</h1>
          <p className={styles.subheading}>The bracket reseeds after every round: highest remaining seed versus lowest.</p>
        </div>
        {champion && (
          <div className={styles.champion}>
            <Avatar size="lg" src={champion.logo || undefined} fallback={champion.name} />
            <div>
              <span>Champion</span>
              <strong>{champion.name}</strong>
            </div>
          </div>
        )}
      </div>

      <div className={styles.bracketViewport}>
        <div className={styles.bracket}>
          {ROUNDS.map((round, roundIndex) => {
            const roundMatches = playoffMatches
              .filter((match) => match.playoffRound === round.number)
              .sort((a, b) => (a.playoffSlot || 0) - (b.playoffSlot || 0));
            const slots = Array.from({ length: round.slots }, (_, index) => roundMatches[index] || null);

            return (
              <div key={round.number} className={styles.stage}>
                <div className={styles.stageHeader} style={{ "--reveal-delay": `${roundIndex * 180}ms` } as CSSProperties}>
                  <span>Round {round.number}</span>
                  <h2>{round.title}</h2>
                </div>
                <div className={styles.stageMatches} style={{ gridTemplateRows: `repeat(${round.slots}, minmax(0, 1fr))` }}>
                  {slots.map((match, slotIndex) => (
                    <MatchNode
                      key={match?.id || `waiting-${round.number}-${slotIndex}`}
                      match={match}
                      teamsById={teamsById}
                      connector={round.number < 3}
                      delay={220 + roundIndex * 220 + slotIndex * 90}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
