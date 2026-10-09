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
            <p className={styles.eyebrow}>GGL Tournament</p>
            <h1 className={styles.h1}>Season <span>9</span></h1>
          </div>
          <figure className={styles.openingArt}>
            <img src="/ggl-lineup.png" alt="" width={1920} height={1080} decoding="async" />
          </figure>
        </header>

        <nav className={styles.contents} aria-label="Season information">
          <a href="#format">Format</a>
          <a href="#schedule">Schedule</a>
          <a href="#match-rules">Match rules</a>
        </nav>

        <section className={styles.section} aria-labelledby="format">
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>01 · Format</p>
            <h2 className={styles.h2} id="format">Season format</h2>
          </div>
          <div className={styles.sectionContent}>
            <p className={styles.lead}>
              Regular-season matches are played within each division. Teams are assembled
              by committee, and both divisions meet in the playoffs.
            </p>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="schedule">
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>02 · Schedule</p>
            <h2 className={styles.h2} id="schedule">One match a week</h2>
          </div>
          <div className={styles.sectionContent}>
            <p className={styles.lead}>
              Teams play one match per week. Match dates will appear on the schedule.
            </p>
          </div>
          <PhaseRail phases={PHASES} />
        </section>

        <section className={`${styles.section} ${styles.matchRules}`} aria-labelledby="match-rules">
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>03 · Match rules</p>
            <h2 className={styles.h2} id="match-rules">Maps &amp; hero bans</h2>
            <figure className={styles.matchPreview}>
              <a href="/ggl-hero-bans.png" target="_blank" rel="noopener noreferrer">
                <img src="/ggl-hero-bans.png" alt="Hero bans at the GGL Tournament match table" loading="lazy" decoding="async" />
              </a>
            </figure>
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
            <p className={styles.kicker}>GGL Tournament · Season 9</p>
            <h2 className={styles.ctaTitle} id="join">Play this season</h2>
            <p className={styles.body}>Start with your Network Member profile.</p>
          </div>
          <Link href="/login" className={styles.ctaButton}>Join Season 9 <span aria-hidden="true">↗</span></Link>
        </section>
      </article>
    </div>
  );
}
