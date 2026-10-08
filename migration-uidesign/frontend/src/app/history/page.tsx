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
      <BrandField variant="section" className={styles.board} intensity={0.22} seedOffset={9090} />
      <header className={styles.hero}>
        <p className={styles.eyebrow}>Goonginga League · Archive</p>
        <h1 className={styles.h1}>GGL History</h1>
        <p className={styles.standfirst}>
          Past seasons, final rosters and every result. Choose a season for standings, player stats
          and the Grand Final recap.
        </p>
      </header>

      <BroadcastMarquee items={marquee} />

      <HistoryClient />
    </div>
  );
}
