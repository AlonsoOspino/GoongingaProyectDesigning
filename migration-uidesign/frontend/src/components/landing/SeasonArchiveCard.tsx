"use client";

import archive from "@/data/history/season-8.json";
import { teamColor } from "@/app/history/palette";
import styles from "./landing.module.css";

/* La prueba de que la liga existe.
 *
 * La sección GGL decía "organizamos una liga con producción propia" y lo
 * demostraba con key art de Blizzard, que podría tener cualquier fan site. Esto
 * es lo único que sólo tenemos nosotros: un resultado real, con sus escudos
 * reales, salido del archivo de la temporada.
 *
 * Los datos vienen del JSON archivado, no de la API, y eso es deliberado: la
 * card no puede quedarse vacía fuera de temporada. Un marcador de 2023 sigue
 * siendo cierto en enero; un partido "en vivo" traído de la API no.
 */

const { grandFinal, tournament } = archive;

/* Sin año no se entiende que es archivo, y con hora se leería como un partido
   por jugar. Mes y año, nada más. */
const playedOn = new Date(grandFinal.playedAt).toLocaleDateString("en-US", {
  month: "long",
  year: "numeric",
});

interface SideProps {
  team: { id: number; name: string; logo: string; score: number };
  won: boolean;
}

/* Cada equipo lleva el mismo color que tiene en GGL History. No es decoracion:
   es lo que hace que un visitante reconozca a Gamin 4 Goonginga aqui y en la
   tabla del archivo sin leer el nombre dos veces. */
function Side({ team, won }: SideProps) {
  return (
    <li
      className={`${styles.archiveSide} ${won ? styles.archiveSideWon : ""}`}
      style={{ "--team": teamColor(team.id) } as React.CSSProperties}
    >
      <img className={styles.archiveLogo} src={team.logo} alt="" loading="lazy" decoding="async" />
      <span className={styles.archiveTeam}>{team.name}</span>
      <span className={styles.archiveScore}>{team.score}</span>
    </li>
  );
}

export default function SeasonArchiveCard() {
  return (
    <article className={styles.archiveCard} aria-label={`${tournament.name} grand final result`}>
      <header className={styles.archiveHead}>
        <span className={styles.archiveKicker}>Season 8 · Grand Final</span>
        <span className={styles.archiveFormat}>Bo{grandFinal.bestOf}</span>
      </header>

      <ul className={styles.archiveSides}>
        <Side team={grandFinal.champion} won />
        <Side team={grandFinal.runnerUp} won={false} />
      </ul>

      <footer className={styles.archiveFoot}>
        <span className={styles.archiveMvp}>
          MVP <b>{grandFinal.mvp.name}</b>
        </span>
        <span className={styles.archiveDate}>{playedOn}</span>
      </footer>
    </article>
  );
}
