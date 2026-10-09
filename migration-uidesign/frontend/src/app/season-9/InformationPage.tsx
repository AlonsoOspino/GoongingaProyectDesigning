"use client";

import Link from "next/link";
import BrandField from "@/components/landing/atmosphere/BrandField";
import PhaseRail, { type Phase } from "./PhaseRail";
import styles from "./information.module.css";

const PHASES: Phase[] = [
  { name: "Registration", when: "Player pool", text: "Players sign up before teams are put together." },
  { name: "Team building", when: "Committee", text: "A committee builds the rosters for competitive balance." },
  { name: "Regular season", when: "Weekly matches", text: "Teams play opponents from their own division." },
  { name: "Playoffs", when: "Combined bracket", text: "Teams from both divisions meet in the playoffs." },
  { name: "Grand Finals", when: "Season title", text: "The final two teams play for the Season 9 title." },
];

const FACTS = [
  { value: "8", unit: "teams", label: "Target field" },
  { value: "2", unit: "divisions", label: "Proposed format" },
  { value: "4", unit: "per division", label: "With a full field" },
  { value: "1", unit: "match / week", label: "Per team" },
];

export default function InformationPage() {
  return (
    <div className={styles.page}>
      <BrandField
        variant="section"
        className={styles.paper}
        intensity={0.38}
        seedOffset={707}
        ground={false}
        motion="calm"
      />

      <article className={styles.sheet}>
        <header className={styles.masthead}>
          <div className={styles.mastheadCopy}>
            <p className={styles.eyebrow}>Goonginga League</p>
            <h1 className={styles.h1}>Season <span>9</span></h1>
            <p className={styles.standfirst}>Division matches. Teams built by committee.</p>
            <p className={styles.intro}>
              We’re aiming for eight teams this season, split into two divisions of four.
            </p>
          </div>
          <figure className={styles.openingArt}>
            <img src="/ggl-lineup.png" alt="" width={1920} height={1080} decoding="async" />
          </figure>
        </header>

        <ul className={styles.facts} aria-label="Proposed Season 9 format">
          {FACTS.map((fact) => (
            <li key={fact.label} className={styles.fact}>
              <span className={styles.factLabel}>{fact.label}</span>
              <span className={styles.factValue}>{fact.value}</span>
              <span className={styles.factUnit}>{fact.unit}</span>
            </li>
          ))}
        </ul>

        <nav className={styles.contents} aria-label="Season information">
          <a href="#format">Divisions</a>
          <a href="#teams">Team building</a>
          <a href="#schedule">Schedule</a>
          <a href="#match-rules">Match rules</a>
        </nav>

        <section className={styles.section} aria-labelledby="format">
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>01 · Format</p>
            <h2 className={styles.h2} id="format">Two divisions</h2>
          </div>
          <div className={styles.sectionContent}>
            <p className={styles.lead}>
              During the regular season, teams only play opponents in their own division.
              With a full eight-team field, each division will have four teams.
            </p>
            <p className={styles.body}>
              Final division sizes depend on signups. The playoffs bring teams from both
              divisions into one bracket.
            </p>
            <div className={styles.divisions} aria-label="Proposed divisions with eight teams">
              <div className={styles.division}>
                <h3>Division A</h3>
                <p><strong>4</strong> teams</p>
              </div>
              <div className={styles.division}>
                <h3>Division B</h3>
                <p><strong>4</strong> teams</p>
              </div>
              <p className={styles.divisionNote}>Proposed split · subject to the final player pool</p>
            </div>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="teams">
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>02 · Rosters</p>
            <h2 className={styles.h2} id="teams">Built by committee</h2>
          </div>
          <div className={styles.sectionContent}>
            <p className={styles.lead}>
              This season, a committee will put teams together from the registered player pool.
              The aim is to make the teams as competitively balanced as possible.
            </p>
            <p className={styles.body}>Captains won’t draft their rosters for Season 9.</p>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="schedule">
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>03 · Schedule</p>
            <h2 className={styles.h2} id="schedule">One match a week</h2>
          </div>
          <div className={styles.sectionContent}>
            <p className={styles.lead}>
              Each team plays once a week during the regular season, facing the other teams
              in its division. The number of teams determines the season’s length.
            </p>
            <p className={styles.body}>
              After the divisional matches, the season moves into a combined playoff bracket
              and Grand Finals.
            </p>
          </div>
          <PhaseRail phases={PHASES} />
        </section>

        <section className={styles.section} aria-labelledby="match-rules">
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>04 · Match rules</p>
            <h2 className={styles.h2} id="match-rules">Maps &amp; hero bans</h2>
          </div>
          <div className={styles.sectionContent}>
            <p className={styles.lead}>
              Captains make the map picks and hero bans at the match table.
              Confirmed picks appear on stream automatically.
            </p>
            <ol className={styles.steps}>
              <li className={styles.step}>
                <h3 className={styles.h3}>Every match starts on Control</h3>
                <p className={styles.body}>The opening pick is the Control map.</p>
              </li>
              <li className={styles.step}>
                <h3 className={styles.h3}>90 seconds to pick a map</h3>
                <p className={styles.body}>
                  On later picks, the captain chooses the mode and an eligible map.
                  The timer is visible on stream. Regular-season maps rotate;
                  playoff and finals picks use the eligible pool for the selected mode.
                </p>
              </li>
              <li className={styles.step}>
                <h3 className={styles.h3}>Two hero bans per captain, per map</h3>
                <p className={styles.body}>
                  Across both teams, no role can lose more than two heroes. A team cannot
                  ban the same hero twice during a match.
                </p>
              </li>
            </ol>
          </div>
        </section>

        <section className={styles.cta} aria-labelledby="join">
          <div>
            <p className={styles.kicker}>Goonginga League · Season 9</p>
            <h2 className={styles.ctaTitle} id="join">Play this season</h2>
            <p className={styles.body}>Start with your Network Member profile.</p>
          </div>
          <Link href="/login" className={styles.ctaButton}>Join Season 9 <span aria-hidden="true">↗</span></Link>
        </section>
      </article>
    </div>
  );
}
