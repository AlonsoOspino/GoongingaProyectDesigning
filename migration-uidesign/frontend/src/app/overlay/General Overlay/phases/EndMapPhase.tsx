"use client";

import type { DraftState } from "@/lib/api/types";
import styles from "../overlay.module.css";

export function EndMapPhase({ draftState }: { draftState: DraftState }) {
  return (
    <div className={styles.container}>
      <div style={{ color: "white", fontSize: "24px", textAlign: "center", width: "100%" }}>
        Map Ended - Map {(draftState?.match?.gameNumber || 0) + 1} Complete
      </div>
    </div>
  );
}
