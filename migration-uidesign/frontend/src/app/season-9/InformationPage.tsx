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

/* Ranura de arte. Hasta que exista la imagen se ve el hueco con su id, para que
   nunca se confunda un espacio vacío con una decisión de diseño. */
function ArtSlot({ id, ratio, caption }: { id: string; ratio: string; caption: string }) {
  return (
    <figure className={styles.slot} style={{ aspectRatio: ratio }}>
      <div className={styles.slotFrame}>
        <span className={styles.slotId}>{id}</span>
        <span className={styles.slotRatio}>{ratio.replace(" / ", ":")}</span>
      </div>
      <figcaption className={styles.slotCaption}>{caption}</figcaption>
    </figure>
  );
}

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
      {/* El mismo tablero que la landing, fijo detrás del documento. Antes esto
          era papel crema y era la razón principal de que Season 9 no pareciera
          parte del sitio. */}
      <BrandField variant="section" className={styles.paper} intensity={0.85} seedOffset={707} />

      <Story>
        <ChapterIndex chapters={chapters} />

      <article className={styles.sheet}>
        <header className={styles.masthead}>
          <p className={styles.eyebrow}>Goonginga League · Season 9</p>
          <h1 className={styles.h1}>How a season runs</h1>
          <p className={styles.standfirst}>
            From sign-ups to the Grand Finals, this is the shape of a GGL season and the rules the
            draft table runs on.
          </p>
        </header>

        <ArtSlot
          id="otp-info-00-opening"
          ratio="16 / 7"
          caption="Opening image — the league at full scale."
        />

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
            Main Schedule: one match per week
          </h2>
          <RevealWords className={styles.lead}>
            The season is spread across many weeks, depending on how many teams get to participate.
            The roster has time to prepare, play, look at what went wrong, and come back for the
            next opponent.
          </RevealWords>

          <ArtSlot
            id="otp-info-01-schedule"
            ratio="16 / 7"
            caption="Season calendar — the week-by-week shape of a season."
          />

          <PhaseRail phases={PHASES} />
        </section>

        {/* ---------- 2 ---------- */}
        <section className={styles.section} aria-labelledby="teams" data-chapter="teams">
          <p className={styles.kicker}>02 · Before the first match</p>
          <h2 className={styles.h2} id="teams">
            How does the team building work?
          </h2>
          <RevealWords className={styles.lead}>
            Captains pick from the players registered for the season. Before the draft, the admin
            team reviews ranks and the shape of the pool so the finished rosters land near the same
            average level.
          </RevealWords>
          <p className={styles.body}>
            The picks stay with the captains. The structure only exists to stop one obviously
            stacked roster from deciding the season before week one.
          </p>

          <ArtSlot
            id="otp-info-02-draft-night"
            ratio="16 / 7"
            caption="Draft night — captains building rosters from the registered pool."
          />
        </section>

        {/* ---------- 3 ---------- */}
        <section className={styles.section} aria-labelledby="map-pool" data-chapter="maps">
          <p className={styles.kicker}>03 · Maps</p>
          <h2 className={styles.h2} id="map-pool">
            The map pool
          </h2>
          <RevealWords className={styles.lead}>
            The pool rotates through the regular season, so no roster gets to live on one map. In
            Playoffs and Finals the rotation is dropped: once a mode is called, every eligible map
            is on the table.
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
            Captains and production work off one match state. A confirmed mode, map or ban lands in
            the same place for both, which is why the stream never has to be caught up by hand
            between games.
          </RevealWords>

          <ArtSlot
            id="otp-info-04-draft-table"
            ratio="16 / 7"
            caption="The draft table — captain view and production view, one match state."
          />

          <div className={styles.steps}>
            <section className={styles.step}>
              <h3 className={styles.h3}>
                <span className={styles.stepNum}>01</span>
                The match opens on Control
              </h3>
              <p className={styles.body}>
                Every match starts on the same mode. Both captains walk in already knowing it, so
                the first decision on the table is a map, not an argument.
              </p>
            </section>

            <section className={styles.step}>
              <h3 className={styles.h3}>
                <span className={styles.stepNum}>02</span>
                The captain on turn calls the mode
              </h3>
              <p className={styles.body}>
                Hybrid, Payload, or Push and Flashpoint. The call is what decides which maps are
                legal for the next action, so it is made before anyone sees the list.
              </p>
              <p className={styles.body}>
                The active captain then has ninety seconds to pick from the maps eligible for that
                mode. The same timer runs on the broadcast, so the audience is never waiting on
                something it cannot see.
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
                The broadcast reads the same state
              </h3>
              <p className={styles.body}>
                Captain view and production view are the same match. When a captain confirms a mode,
                a map or a ban, production already has it — there is nothing to rebuild in a
                separate graphic.
              </p>
            </section>
          </div>

          <p className={styles.closing}>
            None of this exists for its own sake. Every rule on this page is there so a match starts
            on time and ends without an argument. The team behind the draft table keeps building
            toward the same thing: fewer rules to explain mid-match, less waiting on a screen nobody
            else can see, and a broadcast that never falls behind the game it is showing.
          </p>
        </section>

        {/* ---------- cierre ---------- */}
        <section className={styles.cta} aria-labelledby="join">
          <div className={styles.ctaArt}>
            <ArtSlot
              id="otp-info-05-join"
              ratio="4 / 5"
              caption="Roster portrait — a player on season night."
            />
          </div>

          <div className={styles.ctaCopy}>
            <p className={styles.kicker}>Season 9 · Registration</p>
            <h2 className={styles.ctaTitle} id="join">
              Want to become a season player?
            </h2>
            <p className={styles.lead}>
              Sign-ups run through a Network Member profile. Register before the draft and your name
              goes into the pool the captains pick from — no prior season, no invite needed.
            </p>
            <Link href={JOIN_FORM_HREF} className={styles.ctaButton}>
              Join now!
            </Link>
          </div>
        </section>
      </article>
      </Story>
    </div>
  );
}
