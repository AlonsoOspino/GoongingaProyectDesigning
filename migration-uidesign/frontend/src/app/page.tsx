import Image from "next/image";
import { AnnouncementRenderer } from "@/announcements/AnnouncementRenderer";
import { GglTournament } from "@/components/landing/GglTournament";
import { LandingMotion } from "@/components/landing/LandingMotion";

/*
THESIS: OTP is shown as a community that learned to produce its own league, not as an esports startup selling scale.
OWN-WORLD: Near-black, paper white, and field green; square photography, hard rules, wide type, and no decorative chrome.
STORY: A group of friends starts a league, builds Overtime Productions around the work, then shows how GGL moves from teams to broadcast.
FIRST VIEWPORT: Overtime Productions leads beside one compact announcement strip. The origin story begins below that frame.
FORM: Editorial Split, selected with seed otp-origin-241. GGL uses its scoped editorial rail at seed ggl-editorial-107.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md.
*/

const projectImage = "/landing/realtime.webp";

export default function HomePage() {
  return (
    <div className="otp-landing" data-design-seed="otp-origin-241">
      <LandingMotion />

      <section className="otp-hero" aria-labelledby="otp-hero-title">
        <div className="landing-shell otp-hero-layout">
          <div className="otp-hero-copy">
            <h1 id="otp-hero-title">
              <span>Overtime</span>
              <span>Productions</span>
            </h1>
            <p>
              OTP organizes Overwatch leagues, weekend tournaments, community events, and live
              broadcasts.
            </p>
          </div>

          <aside className="otp-hero-announcement" aria-label="Current announcement">
            <h2>Announcements</h2>
            <div className="otp-hero-announcement-content">
              <AnnouncementRenderer limit={1} />
            </div>
          </aside>
        </div>
      </section>

      <section id="about" className="otp-origin" aria-labelledby="otp-origin-title">
        <div className="landing-shell origin-heading" data-reveal>
          <h1 id="otp-origin-title">Game nights became a league.</h1>
        </div>

        <div className="landing-shell origin-grid">
          <article className="origin-copy origin-copy-first" data-reveal>
            <p>
              There was no production company at the start. In 2022, a group of friends was
              simply looking for a better reason to keep playing Overwatch together. A small
              league gave those games a shape: captains chose rosters, matches had a date, and
              results still mattered after everyone left the lobby.
            </p>
            <p>
              The league returned with more players and more work around it. Scheduling,
              administration, social coverage, broadcasts, and tools for captains stopped being
              side notes and became part of the event itself.
            </p>
          </article>

          <figure className="origin-image origin-image-tall" data-image-reveal>
            <Image
              src={projectImage}
              alt="An Overwatch match scene featuring D.Va"
              fill
              priority
              sizes="(max-width: 800px) 100vw, 42vw"
            />
          </figure>

          <figure className="origin-image origin-image-short" data-image-reveal>
            <Image
              src={projectImage}
              alt=""
              fill
              sizes="(max-width: 800px) 100vw, 34vw"
            />
          </figure>

          <article className="origin-copy origin-copy-second" data-reveal>
            <p>
              That work now has a name: Overtime Productions. Goonginga League is its main
              project, but it is not the only format. Mini Tournaments run for a single weekend
              and may be built around Overwatch 6v6 or Deadlock. Jeopardy and Overwatch Family
              Feud give the same community a different kind of night together.
            </p>
            <p>
              OTP is still close to the people using it. The administrative team, social team,
              and developer are improving the visible parts of each event while also fixing the
              quiet work behind registration, match control, schedules, and broadcasts.
            </p>
          </article>
        </div>
      </section>

      <GglTournament />
    </div>
  );
}
