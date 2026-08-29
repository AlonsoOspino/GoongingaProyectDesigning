"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import archive from "@/data/history/season-8.json";
import { ArrowIcon } from "@/components/landing/brandAssets";
import { teamColor } from "./palette";
import styles from "./history.module.css";

/* LA PORTADA DEL ARCHIVO.
 *
 * Antes se entraba directamente a las seis pestanas de Season 8, como si solo
 * existiera una temporada. Ahora lo primero es elegir cual: Season 9 arriba
 * porque es la que esta ocurriendo, y debajo las cerradas.
 *
 * Cada tarjeta de temporada rota sus rosters de dos en dos. No es adorno: una
 * temporada de GGL SON sus equipos, y una tarjeta que solo diga "Season 8" no
 * dice nada que el titulo no dijera ya. */

interface TeamLike {
  id: number;
  name: string;
  logo: string | null;
}

const ROTATE_MS = 3400;
const PER_STEP = 2;

/* Rota los equipos de dos en dos. Se para si el visitante pide movimiento
   reducido: entonces se ven los dos primeros y ya, en vez de nada. */
function RosterRotator({ teams }: { teams: TeamLike[] }) {
  const [offset, setOffset] = useState(0);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: no-preference)");
    if (!query.matches) return;
    setAnimate(true);

    const id = window.setInterval(() => {
      setOffset((current) => (current + PER_STEP) % teams.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [teams.length]);

  /* El modulo permite dar la vuelta: con 9 equipos y pasos de 2, el ultimo grupo
     toma uno del final y uno del principio en vez de quedarse corto. */
  const visible = Array.from({ length: PER_STEP }, (_, i) => teams[(offset + i) % teams.length]);

  return (
    <div className={styles.rotator}>
      <ul className={styles.rotatorList}>
        {visible.map((team) => (
          <li
            /* La clave incluye el offset a proposito: fuerza a React a montar un
               nodo nuevo en cada vuelta, que es lo que dispara la animacion de
               entrada. Sin esto reusaria el elemento y el cambio seria un salto
               seco de texto. */
            key={`${offset}-${team.id}`}
            className={`${styles.rotatorTeam} ${animate ? styles.rotatorTeamIn : ""}`}
            style={{ "--team": teamColor(team.id) } as React.CSSProperties}
          >
            {team.logo ? (
              <img className={styles.rotatorLogo} src={team.logo} alt="" loading="lazy" decoding="async" />
            ) : (
              <span className={styles.rotatorLogoEmpty} aria-hidden="true" />
            )}
            <span className={styles.rotatorName}>{team.name}</span>
          </li>
        ))}
      </ul>

      <p className={styles.rotatorCount}>
        {teams.length} teams
      </p>
    </div>
  );
}

export default function SeasonPicker({ onOpen }: { onOpen: (season: number) => void }) {
  const overview = archive.wrapped.snapshot.overview;
  const champion = archive.grandFinal.champion;

  return (
    <div className={styles.picker}>
      {/* ---- la temporada en curso, en su propio sitio ---- */}
      <article className={`${styles.seasonCard} ${styles.seasonCardLive}`}>
        <div className={styles.seasonCardBody}>
          <p className={styles.seasonStatusLive}>
            <span className={styles.liveDot} aria-hidden="true" />
            Now live
          </p>
          <h2 className={styles.seasonNumber}>Season 9</h2>
          <p className={styles.seasonBlurb}>
            The season being played right now. Rosters, schedule and the table are live rather than
            archived, so they live on the season page.
          </p>
          <Link href="/season-9" className={styles.seasonCta}>
            Open Season 9 <ArrowIcon size={14} />
          </Link>
        </div>
      </article>

      {/* ---- temporadas cerradas ---- */}
      <h2 className={styles.pickerHeading}>Completed seasons</h2>

      <div className={styles.seasonGrid}>
        <article
          className={styles.seasonCard}
          style={{ "--team": teamColor(champion.id) } as React.CSSProperties}
        >
          <div className={styles.seasonCardBody}>
            <p className={styles.seasonStatus}>Complete</p>
            <h3 className={styles.seasonNumber}>Season 8</h3>

            <dl className={styles.seasonFacts}>
              <div>
                <dt>Champion</dt>
                <dd className={styles.seasonChampion}>{champion.name}</dd>
              </div>
              <div>
                <dt>Weeks</dt>
                <dd>{overview.weeks}</dd>
              </div>
              <div>
                <dt>Maps</dt>
                <dd>{overview.games}</dd>
              </div>
              <div>
                <dt>Players</dt>
                <dd>{archive.playerLeaderboard.length}</dd>
              </div>
            </dl>

            <RosterRotator teams={archive.teams} />

            <button type="button" className={styles.seasonCta} onClick={() => onOpen(8)}>
              Open the archive <ArrowIcon size={14} />
            </button>
          </div>
        </article>

        {/* El hueco de la proxima. Declara que el archivo crece en vez de dejar
            una rejilla coja de una sola tarjeta. */}
        <article className={`${styles.seasonCard} ${styles.seasonCardPending}`} aria-hidden="true">
          <div className={styles.seasonCardBody}>
            <p className={styles.seasonStatus}>Not archived yet</p>
            <h3 className={styles.seasonNumber}>Season 9</h3>
            <p className={styles.seasonBlurb}>
              Season 9 joins the archive with its full record once the Grand Final is played.
            </p>
          </div>
        </article>
      </div>
    </div>
  );
}
