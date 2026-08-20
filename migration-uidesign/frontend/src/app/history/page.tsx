import Link from "next/link";
import { ArrowRight, History, Trophy } from "lucide-react";
import archive from "@/data/history/season-8.json";

export const metadata = { title: "History" };

export default function HistoryPage() {
  return (
    <div className="history-index">
      <section className="history-intro">
        <div className="ow-container history-intro-grid">
          <div className="history-intro-copy">
            <h1>League history</h1>
            <p>
              GGL is an Overwatch league founded in 2022. The league has completed eight seasons with drafted teams,
              regular-season matches and playoffs. Final results, teams and statistics are archived here.
            </p>
            <div className="history-intro-stats">
              <span><strong>08</strong> Seasons played</span>
              <span><strong>{archive.teams.length}</strong> Season 8 teams</span>
              <span><strong>{archive.playerLeaderboard.length}</strong> Season 8 players</span>
            </div>
          </div>
          <div className="history-intro-media">
            <img src="/emotionalsupport.png" alt="GGL match night" />
            <span>GGL archive</span>
          </div>
        </div>
      </section>

      <section className="ow-section season-library">
        <div className="ow-container">
          <div className="season-library-heading">
            <div>
              <h2>Select a season</h2>
            </div>
            <p>Completed seasons are frozen snapshots. Their records no longer depend on live match data.</p>
          </div>

          <Link href="/history/season-8" className="season-archive-card">
            <div className="season-archive-copy">
              <span className="season-archive-status"><Trophy size={17} /> Complete</span>
              <p>GGL</p>
              <h3>Season 8</h3>
              <span className="season-archive-open">View Season 8 <ArrowRight size={20} /></span>
            </div>
            <div className="season-logo-field" aria-label={`${archive.teams.length} teams competed`}>
              {archive.teams.map((team, index) => (
                <div className="season-logo-tile" key={team.id} style={{ animationDelay: `${index * 55}ms` }}>
                  <img src={team.logo || "/winton.jpg"} alt={team.name} />
                  <span>{team.name}</span>
                </div>
              ))}
            </div>
            <History className="season-archive-watermark" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
