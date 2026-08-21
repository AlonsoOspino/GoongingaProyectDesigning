import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  ExternalLink,
  GitBranch,
  MessageCircle,
  Play,
  Radio,
  ShieldCheck,
  Swords,
  Users,
} from "lucide-react";
import { AnnouncementRenderer } from "@/announcements/AnnouncementRenderer";
import { resolveSeasonLabel } from "@/features/tournament/seasonIdentity";
import { getCurrentTournament } from "@/lib/api/admin";

export const revalidate = 60;

const seasonFlow = [
  { title: "Registration", copy: "Players join through Discord and confirm their competitive roles." },
  { title: "Captain selection", copy: "League staff appoint captains to build and lead each roster." },
  { title: "Team draft", copy: "Captains select players through the live draft system." },
  { title: "Match weeks", copy: "Confirmed teams move into the schedule, standings and playoffs." },
];

const socialLinks = [
  { label: "Instagram", href: "https://www.instagram.com/goongingatournament/" },
  { label: "Twitch", href: "https://www.twitch.tv/goongingatournament" },
  { label: "YouTube", href: "https://www.youtube.com/@goongingatournament" },
];

export default async function HomePage() {
  const currentTournament = await getCurrentTournament({ cache: "no-store" }).catch(() => null);
  const seasonLabel = resolveSeasonLabel(currentTournament);
  const activeSeason = currentTournament && currentTournament.state !== "FINISHED";

  return (
    <div className="landing-b">
      <section className="landing-b-hero" aria-labelledby="landing-title">
        <div className="ow-container landing-b-hero-grid">
          <div className="landing-b-hero-copy">
            <h1 id="landing-title">GGL</h1>
            <p className="landing-b-hero-lead">Overtime Productions&apos; community Overwatch league.</p>
            <p>Drafted rosters, scheduled competition, live broadcasts and a shared match system built for players, captains and viewers.</p>
            <div className="landing-b-actions">
              <Link href="/season" className="ow-button">Open the season <ArrowRight size={18} /></Link>
              <a href="https://discord.gg/QMukTWr32f" target="_blank" rel="noopener noreferrer" className="ow-button-secondary landing-b-secondary-action"><MessageCircle size={18} /> Join Discord</a>
            </div>
          </div>
          <aside className="landing-b-season-card" aria-label="League season status">
            <div>
              <span>GGL season desk</span>
              <h2>{activeSeason ? seasonLabel : "Next season in preparation"}</h2>
              <p>{activeSeason ? `Status: ${currentTournament.state.replace(/_/g, " ")}` : "The next season name and dates will appear when league staff publish them."}</p>
            </div>
            <Link href="/season">Season details <ArrowRight size={17} /></Link>
          </aside>
        </div>
      </section>

      <section className="landing-b-live" aria-labelledby="live-desk-title">
        <div className="ow-container landing-b-section-heading">
          <div><h2 id="live-desk-title">League desk</h2><p>Live matches, upcoming fixtures and the latest confirmed result appear here first.</p></div>
          <Link href="/schedule">Schedule and results <CalendarDays size={17} /></Link>
        </div>
        <AnnouncementRenderer />
      </section>

      <section className="landing-b-process" aria-labelledby="process-title">
        <div className="ow-container landing-b-section-heading">
          <div><h2 id="process-title">From registration to match week</h2><p>Each season follows one competitive path, from individual registration to a published team schedule.</p></div>
        </div>
        <div className="ow-container landing-b-process-grid">
          <figure className="landing-b-media">
            <img src="/landing/overview.webp" alt="Overwatch heroes assembled before a match" />
            <figcaption><Users size={16} /> Player registration and team formation</figcaption>
          </figure>
          <ol className="landing-b-steps">
            {seasonFlow.map((step, index) => (
              <li key={step.title}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{step.title}</h3><p>{step.copy}</p></div></li>
            ))}
          </ol>
        </div>
      </section>

      <section className="landing-b-competition" aria-labelledby="competition-title">
        <div className="ow-container landing-b-section-heading">
          <div><h2 id="competition-title">Competitive systems</h2><p>Shared rules and published match information keep every team on the same playing field.</p></div>
        </div>
        <div className="ow-container landing-b-feature-grid">
          <article>
            <img src="/landing/hero-bans.webp" alt="GGL hero ban interface" />
            <div><Swords size={22} /><h3>Hero bans</h3><p>Teams challenge compositions through the live ban phase. Across both teams, no more than two heroes per role can be banned on a map.</p></div>
          </article>
          <article>
            <img src="/landing/map-pool.webp" alt="Published Overwatch map pool" />
            <div><ShieldCheck size={22} /><h3>Published map pools</h3><p>Control, Hybrid, Escort, Push and Flashpoint maps are prepared for the match schedule and shared with every roster.</p></div>
          </article>
        </div>
      </section>

      <section className="landing-b-production" aria-labelledby="production-title">
        <div className="landing-b-production-image"><img src="/landing/realtime.webp" alt="Live Overwatch match production" /></div>
        <div className="ow-container landing-b-production-grid">
          <div>
            <h2 id="production-title">One match state, from captain to broadcast</h2>
            <p>Captains submit picks and bans through the draft application. Production tools read the same state for match graphics and stream overlays.</p>
            <ul>
              <li><GitBranch size={18} /> Captain draft workflow</li>
              <li><Radio size={18} /> Live broadcast outputs</li>
              <li><ShieldCheck size={18} /> Shared competitive state</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="landing-b-history" aria-labelledby="history-title">
        <div className="ow-container landing-b-history-grid">
          <div><h2 id="history-title">A recurring league, built by Overtime Productions</h2><p>Founded in 2022, GGL grew from a private competition into a recurring community league. The website preserves Season 8 onward; the league itself has completed eight seasons.</p><Link href="/history">Browse the available archive <ArrowRight size={17} /></Link></div>
          <dl>
            <div><dt>Founded</dt><dd>2022</dd></div>
            <div><dt>Completed seasons</dt><dd>8</dd></div>
            <div><dt>Maps played in Season 8</dt><dd>122</dd></div>
          </dl>
        </div>
      </section>

      <section className="landing-b-connect" aria-labelledby="connect-title">
        <div className="ow-container landing-b-connect-grid">
          <div><h2 id="connect-title">Follow the league</h2><p>Official channels carry schedule announcements, broadcasts, results and community updates.</p></div>
          <div className="landing-b-channel-list">
            {socialLinks.map((social) => <a key={social.label} href={social.href} target="_blank" rel="noopener noreferrer">{social.label} <ExternalLink size={16} /></a>)}
            <a href="https://www.twitch.tv/goongingatournament" target="_blank" rel="noopener noreferrer"><Play size={16} /> Watch match archives</a>
          </div>
        </div>
      </section>
    </div>
  );
}
