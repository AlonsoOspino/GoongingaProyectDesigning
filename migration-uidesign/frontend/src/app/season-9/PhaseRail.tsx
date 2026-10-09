"use client";

import { useCurrentTournament } from "@/features/tournament/useCurrentTournament";
import { matchesSeasonNumber } from "@/features/tournament/seasonIdentity";
import styles from "./information.module.css";

export interface Phase {
  name: string;
  when: string;
  text: string;
}

function currentPhaseIndex(state: unknown, phaseCount: number): number | null {
  switch (state) {
    // Tournament creation alone does not establish whether registration or
    // committee team building is underway.
    case "ROUNDROBIN": return 2;
    case "PLAYOFFS":
    case "SEMIFINALS": return 3;
    case "FINALS": return 4;
    case "FINISHED": return phaseCount;
    default: return null;
  }
}

export default function PhaseRail({ phases }: { phases: readonly Phase[] }) {
  const tournament = useCurrentTournament();
  // A previous season must never mark Season 9's information as live or done.
  const current = matchesSeasonNumber(tournament, 9)
    ? currentPhaseIndex(tournament?.state, phases.length)
    : null;

  return (
    <ol className={styles.rail} aria-label="Season phases in order">
      {phases.map((phase, index) => {
        const done = current !== null && index < current;
        const now = index === current;
        return (
          <li key={phase.name} className={styles.railStep}>
            <div
              className={`${styles.railCard} ${done ? styles.railCardDone : ""} ${now ? styles.railCardNow : ""}`}
              data-phase={done ? "done" : now ? "current" : "upcoming"}
              aria-current={now ? "step" : undefined}
            >
              <span className={styles.railWhen}>
                {now ? "Now · " : done ? "Done · " : ""}{phase.when}
              </span>
              <h3 className={styles.railName}>{phase.name}</h3>
              <p className={styles.railText}>{phase.text}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
