"use client";

import { useCurrentTournament } from "@/features/tournament/useCurrentTournament";
import styles from "./information.module.css";

/* EL RAIL DE FASES.
 *
 * Antes eran cinco tarjetas identicas: la secuencia estaba, pero no se veia en
 * cual de las cinco esta la temporada ahora mismo, que es justo lo primero que
 * viene a mirar quien entra.
 *
 * El estado sale del torneo real, no de una constante. Y se marca con TEXTO y
 * FORMA ademas de color —"Now" escrito, barra superior llena, numero tachado en
 * las completadas— porque apoyarlo solo en el verde deja fuera a quien no lo
 * distingue. */

export interface Phase {
  name: string;
  when: string;
  text: string;
}

/* Del estado del torneo al indice de la fase en curso.
 *
 * SCHEDULED se mapea al draft: si el torneo ya existe en el sistema, el registro
 * se dio por cerrado al crearlo. Si en vuestro flujo el torneo se crea antes de
 * abrir inscripciones, esta es la unica linea que hay que cambiar.
 *
 * FINISHED devuelve 5, fuera del array: todas completadas y ninguna en curso. */
function currentPhaseIndex(state: unknown): number {
  if (typeof state !== "string") return 0;
  switch (state) {
    case "SCHEDULED":
      return 1;
    case "ROUNDROBIN":
      return 2;
    case "PLAYOFFS":
    case "SEMIFINALS":
      return 3;
    case "FINALS":
      return 4;
    case "FINISHED":
      return 5;
    default:
      return 0;
  }
}

function Chevron() {
  return (
    <svg className={styles.chevron} viewBox="0 0 24 16" aria-hidden="true" focusable="false">
      <path
        d="M2 8h18M14 2l6 6-6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function PhaseRail({ phases }: { phases: readonly Phase[] }) {
  const tournament = useCurrentTournament();
  const current = currentPhaseIndex(tournament?.state);

  return (
    <ol className={styles.rail} aria-label="Season phases in order">
      {phases.map((phase, index) => {
        const done = index < current;
        const now = index === current;
        const status = done ? "done" : now ? "current" : "upcoming";

        return (
          <li key={phase.name} className={styles.railStep}>
            <div
              className={`${styles.railCard} ${done ? styles.railCardDone : ""} ${now ? styles.railCardNow : ""}`}
              data-phase={status}
              /* El estado tambien se anuncia: sin esto un lector de pantalla oye
                 cinco tarjetas iguales y se pierde la informacion principal. */
              aria-current={now ? "step" : undefined}
            >
              <span className={styles.railWhen}>
                {now ? "Now · " : done ? "Done · " : ""}
                {phase.when}
              </span>
              <h3 className={styles.railName}>{phase.name}</h3>
              <p className={styles.railText}>{phase.text}</p>
            </div>
            {index < phases.length - 1 ? <Chevron /> : null}
          </li>
        );
      })}
    </ol>
  );
}
