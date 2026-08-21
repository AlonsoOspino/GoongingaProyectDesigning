"use client";
import Link from "next/link";
import { ArrowRight, CalendarClock, Radio, Swords } from "lucide-react";
import type { EditorProps, ViewProps } from "@/announcements/templateTypes";
import type {
  TournamentContent,
  TournamentPayload,
} from "@/announcements/types";
import { AnnouncementCountdown } from "@/announcements/AnnouncementCountdown";
import styles from "@/announcements/announcements.module.css";
import studio from "@/announcements/studio.module.css";
import { resolveSeasonLabel } from "@/features/tournament/seasonIdentity";
import { useCurrentTournament } from "@/features/tournament/useCurrentTournament";

function Team({
  name,
  logo,
  winner = false,
}: {
  name: string;
  logo: string | null;
  winner?: boolean;
}) {
  return (
    <div className={styles.team}>
      {logo ? (
        <img src={logo} alt={`${name} logo`} />
      ) : (
        <span>{name.slice(0, 2)}</span>
      )}
      <strong>{name}</strong>
      {winner ? <span className={styles.winnerLabel}>Winner</span> : null}
    </div>
  );
}
export function TournamentEditor({ content, onChange }: EditorProps) {
  const value = content as TournamentContent;
  return (
    <div className={studio.fields}>
      <label className={studio.field}>
        <span>Headline override</span>
        <input
          value={value.headline}
          maxLength={120}
          onChange={(event) =>
            onChange({ ...value, headline: event.target.value })
          }
        />
      </label>
      <label className={studio.field}>
        <span>Pinned match ID</span>
        <input
          type="number"
          min="1"
          value={value.matchId ?? ""}
          placeholder="Automatic"
          onChange={(event) =>
            onChange({
              ...value,
              matchId: event.target.value ? Number(event.target.value) : null,
            })
          }
        />
      </label>
      <p className={studio.hint}>
        Leave empty to use live, upcoming, then latest-result fallback.
      </p>
    </div>
  );
}
export function TournamentMode({
  content: rawContent,
  payload: rawPayload,
  countdownAt,
  now,
  standalone = false,
  secondary = false,
}: ViewProps) {
  const currentTournament = useCurrentTournament();
  const seasonLabel = resolveSeasonLabel(currentTournament);
  const scheduledSeason = currentTournament?.state === "SCHEDULED";
  const content = rawContent as TournamentContent;
  const payload = rawPayload as TournamentPayload | null;
  const match = payload?.match ?? null;
  const state = payload?.state ?? "IDLE";
  const countdownTarget = countdownAt || match?.startDate || null;
  const teamAWon =
    state === "RESULT" &&
    match !== null &&
    match.mapWinsTeamA > match.mapWinsTeamB;
  const teamBWon =
    state === "RESULT" &&
    match !== null &&
    match.mapWinsTeamB > match.mapWinsTeamA;

  return (
    <section
      className={`${styles.announcement} ${styles.tournament} ${standalone ? styles.standalone : ""} ${secondary ? styles.secondaryAnnouncement : ""}`}
    >
      <div className={styles.inner}>
        <div className={styles.modeLabel}>
          {state === "LIVE" ? <Radio size={15} /> : <Swords size={15} />}
          {state === "LIVE"
            ? "Live match"
            : state === "RESULT"
              ? "Latest result"
              : "Tournament update"}
        </div>
        {!match ? (
          <div className={styles.seasonPoster}>
            <div className={styles.seasonPosterArtwork} aria-hidden="true" />
            <div className={styles.seasonPosterCopy}>
              <strong className={styles.seasonPosterWordmark}>Overtime Productions</strong>
              <span>GGL tournament</span>
              <h2>{scheduledSeason ? seasonLabel : "Next season in preparation"}</h2>
              <p>{scheduledSeason ? "Registration details and the first match schedule will be published here." : "League staff will publish the next season name and dates when they are confirmed."}</p>
            </div>
            <div className={styles.seasonPosterActions}>
              {scheduledSeason ? <AnnouncementCountdown target={currentTournament.startDate} now={now} /> : null}
              <Link href="/season" className={styles.matchLink}>
                {scheduledSeason ? `View ${seasonLabel}` : "Season updates"} <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        ) : (
          <div className={styles.matchLayout}>
            <div className={styles.matchMeta}>
              <span>
                {state === "LIVE"
                  ? "Now playing"
                  : state === "RESULT"
                    ? "Final score"
                    : "Next match"}
              </span>
              <h2>
                {content.headline ||
                  match.title ||
                  `${match.teamA.name} vs ${match.teamB.name}`}
              </h2>
              <p>
                {match.type.replace(/_/g, " ")} · Best of {match.bestOf}
              </p>
            </div>
            <div className={styles.versus}>
              <Team
                name={match.teamA.name}
                logo={match.teamA.logo}
                winner={teamAWon}
              />
              {state === "LIVE" || state === "RESULT" ? (
                <div className={styles.liveScore}>
                  <strong>{match.mapWinsTeamA}</strong>
                  <span>{state === "LIVE" ? "LIVE" : "FINAL"}</span>
                  <strong>{match.mapWinsTeamB}</strong>
                </div>
              ) : (
                <span className={styles.vs}>VS</span>
              )}
              <Team
                name={match.teamB.name}
                logo={match.teamB.logo}
                winner={teamBWon}
              />
            </div>
            <div className={styles.actionArea}>
              {state === "LIVE" ? (
                <div className={styles.liveStatus}>
                  <i />
                  <span>Game {Math.max(1, match.gameNumber + 1)}</span>
                </div>
              ) : state === "RESULT" ? null : (
                <AnnouncementCountdown target={countdownTarget} now={now} />
              )}
              <Link href={`/schedule/${match.id}`} className={styles.matchLink}>
                {state === "RESULT" ? (
                  "View result"
                ) : state === "LIVE" ? (
                  "Open live match"
                ) : (
                  <>
                    <CalendarClock size={17} /> Match details
                  </>
                )}{" "}
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
