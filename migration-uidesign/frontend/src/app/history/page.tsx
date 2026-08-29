import archive from "@/data/history/season-8.json";
import BrandField from "@/components/landing/atmosphere/BrandField";
import { BroadcastMarquee } from "@/components/story/StoryParts";
import { HistoryClient } from "./HistoryClient";
import styles from "./history.module.css";

export const metadata = {
  title: "GGL History",
  description: "Completed GGL seasons, rosters, results, standings, and player statistics.",
};

const overview = archive.wrapped.snapshot.overview;

/* La cinta sale del archivo, no de constantes escritas a mano: cuando se archive
   Season 9 estos titulares se actualizan solos. */
const marquee = [
  `Season 8 · ${overview.weeks} weeks`,
  `${overview.games} maps`,
  `${archive.playerLeaderboard.length} players ranked`,
  `Champion · ${archive.grandFinal.champion.name}`,
  `MVP · ${archive.grandFinal.mvp.name}`,
];

export default function HistoryPage() {
  return (
    <div className={styles.page}>
      {/* El mismo tablero que la landing y Season 9, fijo detras del archivo. */}
      <BrandField variant="section" className={styles.board} intensity={0.7} seedOffset={9090} />

      <header className={styles.hero}>
        <p className={styles.eyebrow}>Goonginga League · Archive</p>
        <h1 className={styles.h1}>GGL History</h1>
        <p className={styles.standfirst}>
          The frozen record of every completed season. Pick a season to open its rosters, player
          statistics, standings, playoff results, Grand Final and Wrapped recap, exactly as they
          stood the night it closed.
        </p>
      </header>

      <BroadcastMarquee items={marquee} />

      <HistoryClient />
    </div>
  );
}
