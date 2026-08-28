"use client";

import Link from "next/link";
import { resolveSeasonLabel, resolveSeasonStatusLabel } from "@/features/tournament/seasonIdentity";
import { useCurrentTournament } from "@/features/tournament/useCurrentTournament";

export function CurrentSeasonPage() {
  const tournament = useCurrentTournament();
  const seasonLabel = tournament ? resolveSeasonLabel(tournament) : "Season 9";
  const statusLabel = resolveSeasonStatusLabel(tournament?.state);

  return (
    <article>
      <header>
        <p>GGL</p>
        <h1>{seasonLabel}</h1>
        <p>{statusLabel}</p>
        <p>
          Registration dates, captain selection, team formation, and the match calendar will be
          published here as they are confirmed.
        </p>
        <p><Link href="/login">Join GGL</Link></p>
      </header>

      <section aria-labelledby="season-nine-preparation">
        <h2 id="season-nine-preparation">Season 9</h2>
        <ul>
          <li>Registration is handled through a Network Member profile and Discord.</li>
          <li>Rosters will appear after registration and team formation are complete.</li>
          <li>Match dates will be published before regular-season play begins.</li>
        </ul>
      </section>

      <section aria-labelledby="season-nine-format">
        <h2 id="season-nine-format">Confirmed format</h2>
        <p>Two hero bans maximum per role between both teams on each map.</p>
      </section>
    </article>
  );
}
