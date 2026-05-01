"use client";

import type { DraftState, Team } from "@/lib/api/types";
import styles from "../overlay.module.css";

export function FinishedPhase({
  draftState,
  teams,
}: {
  draftState: DraftState;
  teams: Team[];
}) {
  const teamA = teams.find((t) => t.id === draftState?.match?.teamAId);
  const teamB = teams.find((t) => t.id === draftState?.match?.teamBId);

  const teamAWins = draftState?.match?.mapWinsTeamA || 0;
  const teamBWins = draftState?.match?.mapWinsTeamB || 0;
  const winner = teamAWins > teamBWins ? teamA : teamB;

  return (
    <div className={styles.container}>
      <div style={{ color: "white", fontSize: "36px", textAlign: "center", width: "100%", fontWeight: "bold" }}>
        {winner?.name} wins the match!
      </div>
      <div style={{ color: "#fbbf24", fontSize: "24px", textAlign: "center", width: "100%" }}>
        {teamAWins} - {teamBWins}
      </div>
    </div>
  );
}
