"use client";

import Link from "next/link";
import { useRef } from "react";
import BrandField from "@/components/landing/atmosphere/BrandField";
import { ChapterIndex, RevealWords, Story, type Chapter } from "@/components/story/StoryParts";
import { useStoryMotion } from "@/components/story/useStoryMotion";
import PhaseRail, { type Phase } from "./PhaseRail";
import ModeTabs from "./ModeTabs";
import styles from "./information.module.css";

const chapters: Chapter[] = [
  { id: "schedule", label: "Calendar" },
  { id: "teams", label: "Teams" },
  { id: "maps", label: "Maps" },
  { id: "draft", label: "Draft table" },
];

/* Destino del "Join now". Hoy apunta al alta de Network Member, que es por donde
   pasa el registro. Si la inscripción de temporada vive en un formulario aparte
   —Google Forms, Tally, lo que sea— se cambia esta línea y nada más. */
const JOIN_FORM_HREF = "/login";

/* Cifras que ya están en el texto de la página. No son decoración: cada una
   aparece explicada más abajo, así que la tira funciona como índice. */
const FACTS = [
  { value: "1", unit: "match", label: "per week, per roster" },
  { value: "2", unit: "bans", label: "per captain, per map" },
  { value: "90", unit: "sec", label: "to call a map" },
  { value: "5", unit: "modes", label: "in the pool" },
];

const PHASES: Phase[] = [
  {
    name: "Registration",
    when: "Before the season",
    text: "Players sign up and the admin team reviews ranks to see what the pool actually looks like.",
  },
  {
    name: "Draft",
    when: "One night",
    text: "Captains build their rosters from the registered pool, in turn, live.",
  },
  {
    name: "Regular season",
    when: "Several weeks",
    text: "Round robin, one match a week, until every roster has faced the field. The results become the table.",
  },
  {
    name: "Playoffs",
    when: "Bracket",
    text: "The table seeds an elimination bracket. Higher seeds act first on maps and bans; nothing changes inside the game.",
  },
  {
    name: "Grand Finals",
    when: "One match",
    text: "Two teams left. The winner takes the revenue collected from that season's broadcasts.",
  },
];

export default function InformationPage() {
  const pageRef = useRef<HTMLDivElement | null>(null);
  useStoryMotion(pageRef);

  return (
    <div className={styles.page} ref={pageRef}>
      <BrandField variant="section" className={styles.paper} intensity={0.22} seedOffset={707} />

      <Story>
        <ChapterIndex chapters={chapters} />

      <article className={styles.sheet}>
        <header className={styles.masthead}>
          <p className={styles.eyebrow}>Goonginga League · Season 9</p>
          <h1 className={styles.h1}>How a season runs</h1>
          <p className={styles.standfirst}>
            Registration, team draft, weekly matches and playoffs. Here is how Season 9 works.
          </p>
        </header>

        <figure className={styles.openingArt}>
          <img src="/ggl-lineup.png" alt="" width={1920} height={1080} decoding="async" />
        </figure>

        <ul className={styles.facts} aria-label="Season at a glance">
          {FACTS.map((fact) => (
            <li key={fact.label} className={styles.fact}>
              <span className={styles.factValue}>
                {fact.value}
                <i>{fact.unit}</i>
              </span>
              <span className={styles.factLabel}>{fact.label}</span>
            </li>
          ))}
        </ul>

        {/* ---------- 1 ---------- */}
        <section className={styles.section} aria-labelledby="schedule" data-chapter="schedule">
          <p className={styles.kicker}>01 · Calendar</p>
          <h2 className={styles.h2} id="schedule">
            One match per week
          </h2>
          <RevealWords className={styles.lead}>
            Each team plays once a week. The number of teams determines the length of the regular
            season, with time between matches to practice and prepare.
          </RevealWords>

          <PhaseRail phases={PHASES} />
        </section>

        {/* ---------- 2 ---------- */}
        <section className={styles.section} aria-labelledby="teams" data-chapter="teams">
          <p className={styles.kicker}>02 · Before the first match</p>
          <h2 className={styles.h2} id="teams">
            Captains draft the teams
          </h2>
          <RevealWords className={styles.lead}>
            Captains pick from registered players. Before draft night, admins review player ranks
            to keep the teams at a similar average skill level.
          </RevealWords>
          <p className={styles.body}>
            Captains make the picks within those limits.
          </p>

        </section>

        {/* ---------- 3 ---------- */}
        <section className={styles.section} aria-labelledby="map-pool" data-chapter="maps">
          <p className={styles.kicker}>03 · Maps</p>
          <h2 className={styles.h2} id="map-pool">
            The map pool
          </h2>
          <RevealWords className={styles.lead}>
            Maps rotate during the regular season. In playoffs and finals, captains can pick any
            eligible map for the selected mode.
          </RevealWords>

          <ModeTabs />
        </section>

        {/* ---------- 4 ---------- */}
        <section className={styles.section} aria-labelledby="draft-table" data-chapter="draft">
          <p className={styles.kicker}>04 · The table</p>
          <h2 className={styles.h2} id="draft-table">
            The draft table
          </h2>
          <RevealWords className={styles.lead}>
            Captains pick modes and maps, then lock their hero bans. The stream updates as each
            decision is confirmed.
          </RevealWords>

          <div className={styles.steps}>
            <section className={styles.step}>
              <h3 className={styles.h3}>
                <span className={styles.stepNum}>01</span>
                The match opens on Control
              </h3>
              <p className={styles.body}>
                Every match starts on Control. The first pick is the map.
              </p>
            </section>

            <section className={styles.step}>
              <h3 className={styles.h3}>
                <span className={styles.stepNum}>02</span>
                The captain on turn calls the mode
              </h3>
              <p className={styles.body}>
                The captain selects Hybrid, Payload, Push or Flashpoint before choosing a map.
              </p>
              <p className={styles.body}>
                They have ninety seconds to pick an eligible map. The timer is visible on stream.
              </p>
            </section>

            <section className={styles.step}>
              <h3 className={styles.h3}>
                <span className={styles.stepNum}>03</span>
                Bans carry across the match
              </h3>
              <p className={styles.body}>
                Each captain locks two hero bans for the map. Across both teams no role can lose
                more than two heroes, and no team may ban the same hero twice in one match.
              </p>
              <ul className={styles.rules}>
                <li className={styles.rule}>
                  <span className={styles.ruleValue}>2</span>
                  <span className={styles.ruleLabel}>bans per captain</span>
                </li>
                <li className={styles.rule}>
                  <span className={styles.ruleValue}>2</span>
                  <span className={styles.ruleLabel}>max per role</span>
                </li>
              </ul>
            </section>

            <section className={styles.step}>
              <h3 className={styles.h3}>
                <span className={styles.stepNum}>04</span>
                Picks update on stream
              </h3>
              <p className={styles.body}>
                Confirmed modes, maps and bans appear on the broadcast automatically.
              </p>
            </section>
          </div>

        </section>

        {/* ---------- cierre ---------- */}
        <section className={styles.cta} aria-labelledby="join">
          <div className={styles.ctaCopy}>
            <p className={styles.kicker}>Season 9 · Registration</p>
            <h2 className={styles.ctaTitle} id="join">
              Play in Season 9
            </h2>
            <p className={styles.lead}>
              Create a Network Member profile to register for the draft. New players are welcome.
            </p>
            <Link href={JOIN_FORM_HREF} className={styles.ctaButton}>
              Register
            </Link>
          </div>
        </section>
      </article>
      </Story>
    </div>
  );
}
