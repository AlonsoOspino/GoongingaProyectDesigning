"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowIcon } from "@/components/landing/brandAssets";
import styles from "./story.module.css";

/* EL VOCABULARIO NARRATIVO, COMPARTIDO.
 *
 * Estas piezas nacieron como funciones locales dentro de LandingPage.tsx. Sirven
 * igual de bien a Season 9 y a GGL History, asi que viven aqui: la alternativa
 * era copiarlas dos veces y que las tres versiones se separasen en cuanto
 * alguien corrigiera una.
 *
 * Todas reciben sus datos por props. La landing pasa cifras de liga, History
 * pasa cifras de temporada cerrada, y el componente no sabe ni le importa. */

/* ---- Revelado por palabras ----
   El parrafo entra a media luz y las palabras se encienden con el scroll. El
   texto completo va en aria-label y cada palabra oculta al lector de pantalla:
   de lo contrario se anunciaria palabra a palabra, entrecortado. */
export function RevealWords({ className, children }: { className?: string; children: string }) {
  const words = children.trim().split(/\s+/);

  return (
    <p className={className} aria-label={children} data-word-reveal>
      {words.map((word, index) => (
        <span key={`${word}-${index}`}>
          <span className={styles.revealWord} data-word aria-hidden="true">
            {word}
          </span>
          {index < words.length - 1 ? " " : null}
        </span>
      ))}
    </p>
  );
}

/* ---- Cinta de titulares ----
   Se pintan DOS grupos identicos y el motion desplaza la pista un -50%: al
   terminar, la segunda copia esta exactamente donde empezo la primera, asi que
   el bucle no tiene costura. Es decorativa, de ahi el aria-hidden. */
export function BroadcastMarquee({ items }: { items: readonly string[] }) {
  if (items.length === 0) return null;

  return (
    <div className={styles.marquee} aria-hidden="true">
      <div className={styles.marqueeTrack} data-marquee-track>
        {[0, 1].map((copy) => (
          <div key={copy} className={styles.marqueeGroup}>
            {items.map((item) => (
              <span key={`${copy}-${item}`} className={styles.marqueeItem}>
                <i /> {item}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export interface Signal {
  value: string;
  label: string;
  href: string;
  /** Marca la cifra que esta ocurriendo ahora. Solo deberia haber una. */
  live?: boolean;
}

/* ---- Cubierta de cifras ----
   Cuatro datos reales, cada uno enlazando a donde se comprueban. Una cifra que
   no lleva a ninguna parte es decoracion; esta si se puede seguir. */
export function SignalDeck({
  signals,
  label = "At a glance",
  marquee,
}: {
  signals: readonly Signal[];
  label?: string;
  marquee?: readonly string[];
}) {
  return (
    <section className={styles.signalDeck} aria-label={label}>
      <div className={styles.signalDeckInner}>
        {signals.map((signal) => (
          <Link
            key={`${signal.value}-${signal.label}`}
            href={signal.href}
            className={`${styles.signalCell} ${signal.live ? styles.signalCellLive : ""}`}
          >
            <span className={styles.signalValue}>{signal.value}</span>
            <span className={styles.signalLabel}>{signal.label}</span>
            <ArrowIcon size={14} />
          </Link>
        ))}
      </div>
      {marquee ? <BroadcastMarquee items={marquee} /> : null}
    </section>
  );
}

export interface Chapter {
  id: string;
  label: string;
}

/* ---- Indice de capitulos ----
   Rail vertical que se ancla al costado mientras dura la historia y marca en
   que capitulo esta el lector. Decorativo para el lector de pantalla: la
   navegacion real son los encabezados de cada seccion. */
export function ChapterIndex({ chapters }: { chapters: readonly Chapter[] }) {
  if (chapters.length === 0) return null;

  return (
    <aside className={styles.chapterIndex} data-chapter-index aria-hidden="true">
      <span className={styles.chapterIndexRule} />
      {chapters.map((chapter) => (
        <span key={chapter.id} className={styles.chapterIndexItem} data-chapter-item={chapter.id}>
          {chapter.label}
        </span>
      ))}
    </aside>
  );
}

/* ---- Contenedor de la historia ----
   Marca el tramo que el indice acompana. useStoryMotion busca [data-story] para
   saber donde empieza y donde acaba el anclaje. */
export function Story({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`${styles.story} ${className ?? ""}`} data-story>
      {children}
    </div>
  );
}

/* Se exportan para que cada pagina componga sus secciones con el tratamiento de
   capitulo sin tener que conocer los nombres internos del modulo. */
export const chapterClass = {
  base: styles.chapterSection,
  mirror: styles.chapterSectionMirror,
  center: styles.chapterSectionCenter,
} as const;
