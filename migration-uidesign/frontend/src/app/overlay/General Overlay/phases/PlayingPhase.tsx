"use client";

import type { DraftState } from "@/lib/api/types";
import styles from "../overlay.module.css";

export function PlayingPhase({ draftState }: { draftState: DraftState }) {
  return (
    <div className={styles.container}>
      <div style={{ color: "white", fontSize: "24px", textAlign: "center", width: "100%" }}>
        Game in Progress - Map {(draftState?.match?.gameNumber || 0) + 1}
      </div>
    </div>
  );
}
