import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Suspense } from "react";
import archive from "@/data/history/season-8.json";
import { HistoryClient } from "../HistoryClient";

export const metadata = { title: "Season 8 History" };

export default function SeasonEightHistoryPage() {
  return (
    <div>
      <header className="history-header season-history-header">
        <div className="ow-container">
          <Link href="/history" className="history-back"><ArrowLeft size={17} /> All seasons</Link>
          <div className="season-history-title">
            <div>
              <p>GGL</p>
              <h1>Season 8</h1>
              <p className="text-body-s text-text-secondary">Complete season snapshot</p>
            </div>
            <div className="season-history-summary">
              <span><strong>{archive.teams.length}</strong> Teams</span>
              <span><strong>{archive.playerLeaderboard.length}</strong> Players</span>
              <span><strong>{archive.wrapped.snapshot.overview.games}</strong> Maps</span>
            </div>
          </div>
        </div>
      </header>
      <Suspense fallback={<div className="ow-container ow-section text-muted">Loading Season 8...</div>}>
        <HistoryClient />
      </Suspense>
    </div>
  );
}
