import Link from "next/link";
import { Suspense } from "react";
import archive from "@/data/history/season-8.json";
import { HistoryClient } from "./HistoryClient";

export const metadata = {
  title: "GGL History",
  description: "Completed GGL seasons, rosters, results, standings, and player statistics.",
};

export default function HistoryPage() {
  return (
    <article>
      <header>
        <h1>GGL History</h1>
        <p>
          Browse the frozen record of completed seasons. Season 8 includes its final rosters,
          player statistics, standings, playoff results, Grand Final, and Wrapped recap.
        </p>
        <nav aria-label="GGL seasons">
          <ul>
            <li><Link href="/season-9">Season 9</Link></li>
            <li><span aria-current="page">Season 8</span></li>
          </ul>
        </nav>
        <dl>
          <div><dt>Season</dt><dd>8</dd></div>
          <div><dt>Teams</dt><dd>{archive.teams.length}</dd></div>
          <div><dt>Players</dt><dd>{archive.playerLeaderboard.length}</dd></div>
          <div><dt>Maps</dt><dd>{archive.wrapped.snapshot.overview.games}</dd></div>
        </dl>
      </header>

      <Suspense fallback={<p>Loading Season 8 history...</p>}>
        <HistoryClient />
      </Suspense>
    </article>
  );
}
