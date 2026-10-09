import BrandField from "@/components/landing/atmosphere/BrandField";
import { HistoryClient } from "./HistoryClient";
import styles from "./history.module.css";

export const metadata = {
  title: "GGL History",
  description: "Completed GGL seasons, rosters, results, standings, and player statistics.",
};

export default function HistoryPage() {
  return (
    <div className={styles.page}>
      <BrandField variant="section" className={styles.board} intensity={0.22} seedOffset={9090} />
      <header className={styles.hero}>
        <p className={styles.eyebrow}>GGL Tournament · Archive</p>
        <h1 className={styles.h1}>GGL History</h1>
        <p className={styles.standfirst}>
          Past seasons, final rosters and every result. Choose a season for standings, player stats
          and the Grand Final recap.
        </p>
      </header>

      <HistoryClient />
    </div>
  );
}
