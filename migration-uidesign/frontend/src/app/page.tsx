import Link from "next/link";
import {
  ArrowRight,
  ExternalLink,
  GitBranch,
  MessageCircle,
  Play,
  Radio,
  ShieldCheck,
  Swords,
} from "lucide-react";
import { AnnouncementRenderer } from "@/announcements/AnnouncementRenderer";
import {
  resolveSeasonLabel,
  resolveSeasonStatusLabel,
} from "@/features/tournament/seasonIdentity";
import { getCurrentTournament } from "@/lib/api/admin";

export const revalidate = 60;

const seasonFlow = [
  { number: "01", title: "Register", copy: "Join through Discord and confirm the roles you play." },
  { number: "02", title: "Meet the captains", copy: "League staff appoint the players who will build each roster." },
  { number: "03", title: "Watch the draft", copy: "Captains pick their teams through GGL's live draft system." },
  { number: "04", title: "Play the schedule", copy: "Rosters move into published match weeks, standings and playoffs." },
];

const socialLinks = [
  { label: "Instagram", href: "https://www.instagram.com/goongingatournament/" },
  { label: "Twitch", href: "https://www.twitch.tv/goongingatournament" },
  { label: "YouTube", href: "https://www.youtube.com/@goongingatournament" },
];

export default async function HomePage() {
  const currentTournament = await getCurrentTournament({ cache: "no-store" }).catch(() => null);
  const seasonLabel = resolveSeasonLabel(currentTournament);
  const statusLabel = resolveSeasonStatusLabel(currentTournament?.state);

  return (
    <div className="landing-b">
      <section className="landing-b-hero" aria-labelledby="landing-title">
        <div className="ow-container landing-b-hero-grid">
          <div className="landing-b-hero-copy">
            <h1 id="landing-title">Overtime Productions&apos; Overwatch league</h1>
            <p className="landing-b-hero-lead">GGL turns community players into drafted teams.</p>
            <p>Register, meet the captains, follow every pick and ban, then watch the same match state move from the competition server to the live broadcast.</p>
            <div className="landing-b-season-line">
              <strong>{seasonLabel}</strong>
              <span>{statusLabel}</span>
            </div>
            <div className="landing-b-actions">
              <Link href="/season" className="ow-button">Season details <ArrowRight size={18} /></Link>
              <a href="https://discord.gg/QMukTWr32f" target="_blank" rel="noopener noreferrer" className="ow-button-secondary landing-b-secondary-action"><MessageCircle size={18} /> Join Discord</a>
            </div>
          </div>
          <figure className="landing-b-hero-media">
            <img src="/landing/overview.webp" alt="Overwatch heroes assembled before a GGL match" />
            <figcaption>Players become teams through the live GGL draft.</figcaption>
          </figure>
        </div>
        <div className="ow-container landing-b-current">
          <div className="landing-b-current-heading">
            <div><Radio size={19} /><h2>Live and upcoming</h2></div>
            <Link href="/schedule">Full schedule <ArrowRight size={16} /></Link>
          </div>
          <AnnouncementRenderer />
        </div>
      </section>

      <section className="landing-b-competition" aria-labelledby="competition-title">
        <div className="ow-container landing-b-competition-intro">
          <h2 id="competition-title">Register. Draft. Compete.</h2>
          <p>One route from Discord registration to a published match schedule.</p>
        </div>
        <ol className="ow-container landing-b-steps">
          {seasonFlow.map((step) => (
            <li key={step.number}><span>{step.number}</span><div><h3>{step.title}</h3><p>{step.copy}</p></div></li>
          ))}
        </ol>
        <div className="ow-container landing-b-feature-grid">
          <article>
            <img src="/landing/hero-bans.webp" alt="GGL hero ban interface" />
            <div><Swords size={22} /><h3>Challenge the composition</h3><p>Across both teams, no more than two heroes per role can be banned on a map.</p></div>
          </article>
          <article>
            <img src="/landing/map-pool.webp" alt="Published GGL Overwatch map pool" />
            <div><ShieldCheck size={22} /><h3>Know the map pool</h3><p>Control, Hybrid, Escort, Push and Flashpoint maps are published for every roster before match day.</p></div>
          </article>
        </div>
      </section>

      <section className="landing-b-production" aria-labelledby="production-title">
        <div className="landing-b-production-image"><img src="/landing/realtime.webp" alt="Live GGL Overwatch match production" /></div>
        <div className="ow-container landing-b-production-grid">
          <div>
            <h2 id="production-title">The draft reaches the broadcast</h2>
            <p>Captain picks and bans do not disappear into a spreadsheet. Production reads the same live match state for graphics and stream overlays.</p>
            <ul>
              <li><GitBranch size={18} /> Captains control their own draft choices</li>
              <li><Radio size={18} /> Casters see the state without changing it</li>
              <li><ShieldCheck size={18} /> Viewers get one consistent match story</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="landing-b-history" aria-labelledby="history-title">
        <div className="ow-container landing-b-history-grid">
          <div className="landing-b-history-copy">
            <h2 id="history-title">Eight seasons of community competition</h2>
            <p>Founded in 2022, GGL grew from a private competition into a recurring community league. The website preserves Season 8 onward; the league itself has completed eight seasons.</p>
            <Link href="/history">Browse the available archive <ArrowRight size={17} /></Link>
          </div>
          <dl>
            <div><dt>Founded</dt><dd>2022</dd></div>
            <div><dt>Completed seasons</dt><dd>8</dd></div>
            <div><dt>Maps played in Season 8</dt><dd>122</dd></div>
          </dl>
          <nav className="landing-b-channel-list" aria-label="Official GGL channels">
            {socialLinks.map((social) => <a key={social.label} href={social.href} target="_blank" rel="noopener noreferrer">{social.label} <ExternalLink size={16} /></a>)}
            <a href="https://www.twitch.tv/goongingatournament" target="_blank" rel="noopener noreferrer"><Play size={16} /> Match archives</a>
          </nav>
        </div>
      </section>
    </div>
  );
}
