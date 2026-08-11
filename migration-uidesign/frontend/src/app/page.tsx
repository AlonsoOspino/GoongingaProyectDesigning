import Link from "next/link";
import type { CSSProperties } from "react";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  Ban,
  ExternalLink,
  Flame,
  Gamepad2,
  GitBranch,
  Map,
  MessageCircle,
  Play,
  Radio,
  RadioTower,
  ShieldCheck,
  Sparkles,
  Swords,
  Users,
  Video,
  Zap,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { getRecentNetworkMembers } from "@/lib/api/networkMember";
import type { NetworkMemberRole } from "@/lib/api/types";
import { AnnouncementRenderer } from "@/announcements/AnnouncementRenderer";
import { LandingMotion } from "@/components/landing/LandingMotion";

export const revalidate = 60;

const roleLabels: Record<NetworkMemberRole, string> = {
  MEMBER: "Member",
  ADMIN: "Admin",
  CASTER: "Caster",
  DEVELOPER: "Developer",
  SEASON_PLAYER: "Season player",
  MODERATOR: "Moderator",
  COMMUNITY_MANAGER: "Community manager",
  CONTENT_CREATOR: "Content creator",
  SOCIAL_MEDIA: "Social media",
};

const seasonFlow = [
  {
    image: "/icons/league-process/registration.svg",
    title: "Registration",
    copy: "Players register through Discord and confirm their preferred competitive roles.",
  },
  {
    image: "/icons/league-process/captain-selection.svg",
    title: "Captain selection",
    copy: "League staff appoint the captains responsible for building and leading each roster.",
  },
  {
    image: "/icons/league-process/team-draft.svg",
    title: "Team draft",
    copy: "Captains select their rosters through the live draft system until every team is complete.",
  },
  {
    image: "/icons/league-process/match-week.svg",
    title: "Match week",
    copy: "Confirmed rosters move into the published schedule, live broadcasts, standings, and results.",
  },
];

const socialLinks = [
  {
    name: "Instagram",
    handle: "@goongingatournament",
    copy: "League announcements, match graphics, results, and season updates.",
    href: "https://www.instagram.com/goongingatournament/",
    icon: "/icons/social/instagram.svg",
  },
  {
    name: "Twitch",
    handle: "goongingatournament",
    copy: "Live match broadcasts, community events, and tournament coverage.",
    href: "https://www.twitch.tv/goongingatournament",
    icon: "/icons/social/twitch.svg",
  },
  {
    name: "TikTok",
    handle: "@goongingatournament",
    copy: "Match clips, production highlights, and moments from the community.",
    href: "https://www.tiktok.com/@goongingatournament",
    icon: "/icons/social/tiktok.svg",
  },
];

const experienceCards = [
  {
    icon: Swords,
    number: "01",
    title: "Structured competition",
    copy: "Drafted rosters, defined match rules, a regular schedule, standings, and playoffs.",
  },
  {
    icon: Video,
    number: "02",
    title: "Broadcast production",
    copy: "Live casting, real-time overlays, and match coverage designed for every scheduled fixture.",
  },
  {
    icon: Gamepad2,
    number: "03",
    title: "Community programs",
    copy: "Minigames, seasonal awards, voting, and events that support the league beyond match day.",
  },
];

export default async function HomePage() {
  const members = await getRecentNetworkMembers().catch(() => []);

  return (
    <div className="home-page home-editorial">
      <LandingMotion />

      <section className="goon-hero" aria-labelledby="goon-hero-title">
        <div className="goon-hero-backdrop" aria-hidden="true" />
        <div className="hero-speed-lines" aria-hidden="true" />
        <div className="ow-container goon-hero-grid">
          <div className="goon-hero-copy">
            <span className="hero-kicker"><i /> Season 9 · Coming soon</span>
            <h1 id="goon-hero-title">
              <span>Overwatch.</span>
              <span>Organized.</span>
              <span className="hero-accent-line">Competitive.</span>
            </h1>
            <p>
              Goonginga is a community Overwatch league with drafted rosters, scheduled matches,
              live broadcasts, standings, and playoffs.
            </p>
            <div className="goon-hero-actions">
              <Link href="/season-9" className="hero-primary-action">
                Season 9 overview <ArrowRight size={19} />
              </Link>
              <a href="https://discord.gg/QMukTWr32f" target="_blank" rel="noopener noreferrer" className="hero-secondary-action">
                <MessageCircle size={18} /> Join Discord
              </a>
            </div>
          </div>

          <aside className="hero-scorecard" aria-label="League information">
            <div className="scorecard-status"><span /> Next league season</div>
            <div className="scorecard-season"><small>Status</small><strong>S09</strong></div>
            <div className="scorecard-coming">Coming soon</div>
            <div className="scorecard-rule" />
            <div className="scorecard-stats">
              <div><strong>8</strong><span>completed seasons</span></div>
              <div><strong>122</strong><span>maps in S8</span></div>
              <div><strong>2023</strong><span>established</span></div>
            </div>
            <a href="https://www.twitch.tv/goongingatournament" target="_blank" rel="noopener noreferrer">
              <Play size={16} fill="currentColor" /> Watch on Twitch <ExternalLink size={14} />
            </a>
          </aside>
        </div>
        <a className="hero-scroll-cue" href="#format" aria-label="Explore the league">
          <span>Explore the league</span><ArrowDown size={18} />
        </a>
      </section>

      <div className="energy-ticker" aria-label="Goonginga league features">
        <div className="energy-ticker-track">
          {["LIVE DRAFT", "HERO BANS", "CASTERS", "PLAYOFFS", "COMMUNITY", "WEEKLY MATCHES", "LIVE DRAFT", "HERO BANS", "CASTERS", "PLAYOFFS", "COMMUNITY", "WEEKLY MATCHES"].map((item, index) => (
            <span key={`${item}-${index}`}><Zap size={14} fill="currentColor" /> {item}</span>
          ))}
        </div>
      </div>

      <section id="format" className="season-overview ow-section">
        <div className="ow-container overview-heading" data-reveal>
          <span className="ow-eyebrow">How the league works</span>
          <h2>From registration<br />to match week</h2>
          <p>
            Players register individually through Discord. Captains are appointed, rosters are drafted live,
            and regular-season play begins on the published schedule.
          </p>
        </div>
        <div className="ow-container overview-layout">
          <figure className="overview-image media-frame" data-reveal>
            <img src="/landing/overview.webp" alt="Overwatch heroes assembled before a match" />
            <figcaption><Activity size={14} /> Season preparation</figcaption>
          </figure>
          <div className="season-flow" data-reveal>
            {seasonFlow.map(({ image, title, copy }, index) => (
              <article className="season-flow-step" key={title} style={{ "--step-delay": `${index * 80}ms` } as CSSProperties}>
                <span className="season-flow-number">{String(index + 1).padStart(2, "0")}</span>
                <span className="season-flow-icon"><img src={image} alt="" /></span>
                <div><h3>{title}</h3><p>{copy}</p></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="experience-section">
        <div className="ow-container experience-intro" data-reveal>
          <span className="ow-eyebrow">Built for organized competition</span>
          <h2>A complete league format.<br /><em>On and off stream.</em></h2>
        </div>
        <div className="ow-container experience-grid">
          {experienceCards.map(({ icon: Icon, number, title, copy }, index) => (
            <article className="experience-card" key={title} data-reveal style={{ "--reveal-delay": `${index * 100}ms` } as CSSProperties}>
              <div><span>{number}</span><Icon size={28} /></div>
              <h3>{title}</h3>
              <p>{copy}</p>
              <i aria-hidden="true" />
            </article>
          ))}
        </div>
      </section>

      <section className="competition-system">
        <article className="system-feature system-feature-dark">
          <div className="ow-container system-feature-grid">
            <div className="system-feature-copy" data-reveal>
              <span className="ow-eyebrow"><Ban size={16} /> Pre-match strategy</span>
              <p className="system-index">01</p>
              <h2>Hero bans</h2>
              <p>Each map begins with a ban phase, giving both teams a direct way to challenge the opposing composition.</p>
              <p>Teams can ban up to two heroes per role between them. A banned hero cannot be selected for another ban later in the same match.</p>
              <span className="system-callout"><Flame size={17} /> The team that lost the previous map opens the next ban phase.</span>
            </div>
            <figure className="system-feature-media" data-reveal>
              <img src="/landing/hero-bans.webp" alt="Goonginga hero ban interface" />
              <figcaption>Live hero ban system</figcaption>
            </figure>
          </div>
        </article>

        <article className="system-feature system-feature-light">
          <div className="ow-container system-feature-grid reverse">
            <div className="system-feature-copy" data-reveal>
              <span className="ow-eyebrow"><Map size={16} /> Weekly competitive rotation</span>
              <p className="system-index">02</p>
              <h2>Map pool</h2>
              <p>League staff publish a map pool before each match week. Every team competes from the same rotation.</p>
              <p>Control, Hybrid, Escort, Push, and Flashpoint are balanced to test a wider range of team compositions and strategies.</p>
              <span className="system-callout light"><ShieldCheck size={17} /> One published pool for every scheduled team.</span>
            </div>
            <figure className="system-feature-media map-pool-media" data-reveal>
              <img src="/landing/map-pool.webp" alt="Weekly Overwatch map pool" />
              <figcaption>Published weekly rotation</figcaption>
            </figure>
          </div>
        </article>
      </section>

      <section className="live-stage">
        <div className="ow-container live-stage-heading" data-reveal>
          <div><span className="live-dot" /> Community events and broadcasts</div>
          <p>Special events and minigames are managed separately from the upcoming Season 9 schedule.</p>
        </div>
        <AnnouncementRenderer />
      </section>

      <section className="realtime-section">
        <div className="realtime-visual">
          <img src="/landing/realtime.webp" alt="Live Overwatch match operations" />
          <div className="realtime-overlay" />
        </div>
        <div className="ow-container realtime-content">
          <div className="realtime-copy" data-reveal>
            <span className="ow-eyebrow"><RadioTower size={16} /> Integrated match operations</span>
            <h2>One match state.<br />Updated live.</h2>
            <p>Captains submit picks and bans through the draft application. Each update is sent directly to the broadcast overlay.</p>
            <p>Players, staff, and viewers follow the same match state throughout the pre-match and live production workflow.</p>
            <div className="realtime-points">
              <span><GitBranch size={18} /> Captain draft application</span>
              <span><Radio size={18} /> Broadcast overlay</span>
              <span><Activity size={18} /> Synchronized match state</span>
            </div>
          </div>
        </div>
      </section>

      <section className="league-history-expanded ow-section">
        <div className="ow-container league-history-header" data-reveal>
          <div><span className="ow-eyebrow">League history</span><h2>From a private tournament<br />to a recurring league</h2></div>
          <div className="league-history-intro">
            <p>Overtime Productions started Goonginga in 2023 as an organized Overwatch competition among friends. It has since developed into a recurring league with drafted teams, weekly fixtures, standings, playoffs, and live broadcasts.</p>
            <p>The administrative team coordinates registrations, captain selection, team formation, scheduling, match rules, and competitive operations. The socials team works alongside production staff to prepare match graphics, stream coverage, results, and community updates.</p>
            <p>Community feedback is reviewed throughout each season. Staff use that feedback, together with match results and scheduling data, to improve team balance, refine league rules, strengthen the broadcast experience, and make each season more reliable for players and viewers.</p>
          </div>
        </div>
        <div className="ow-container history-image-grid">
          <figure className="history-image-item" data-reveal>
            <img src="/emotionalsupport.png" alt="Goonginga match broadcast" />
            <figcaption><span>01</span><strong>League operations and broadcast production</strong><p>Each match week requires coordination between administrators, captains, casters, and the socials team. Fixtures are scheduled, match data is prepared, live overlays are connected, and results are documented for players and viewers.</p></figcaption>
          </figure>
          <figure className="history-image-item" data-reveal>
            <img src="/community.png" alt="Goonginga player community" />
            <figcaption><span>02</span><strong>Eight seasons of scheduled competition</strong><p>Across eight completed seasons, dozens of players have formed drafted teams, coordinated weekly match times, and competed through regular-season and playoff schedules. Every season has provided new feedback for the league format.</p></figcaption>
          </figure>
        </div>
        <div className="ow-container history-commitment" data-reveal>
          <span>Continuous development</span>
          <p>Goonginga is reviewed as an ongoing league project. The staff continues to evaluate player experience, match balance, scheduling, production quality, and community communication before introducing changes to future seasons.</p>
        </div>
        <div className="ow-container league-history-footer" data-reveal>
          <div><strong>2023</strong><span>league established</span></div>
          <div><strong>08</strong><span>completed seasons</span></div>
          <div><strong>122</strong><span>maps in Season 8</span></div>
          <a href="https://www.twitch.tv/goongingatournament" target="_blank" rel="noopener noreferrer"><Radio size={18} /> Watch match archives <ExternalLink size={15} /></a>
        </div>
      </section>

      <section className="social-hub ow-section">
        <div className="ow-container social-hub-heading" data-reveal>
          <div><span className="ow-eyebrow">Follow Goonginga</span><h2>League updates<br />across every platform</h2></div>
          <p>Follow official channels for schedule announcements, match broadcasts, results, clips, and production updates.</p>
        </div>
        <div className="ow-container social-hub-grid">
          {socialLinks.map((social, index) => (
            <a key={social.name} href={social.href} target="_blank" rel="noopener noreferrer" className="social-platform-card" data-reveal style={{ "--reveal-delay": `${index * 90}ms` } as CSSProperties}>
              <span className="social-platform-icon"><img src={social.icon} alt="" /></span>
              <div><span>{social.name}</span><strong>{social.handle}</strong><p>{social.copy}</p></div>
              <ExternalLink size={18} />
            </a>
          ))}
        </div>
      </section>

      <section className="members-section ow-section">
        <div className="ow-container">
          <div className="section-lead compact" data-reveal>
            <div><span className="ow-eyebrow">Goonginga Network</span><h2>New members</h2><p>Recently registered members of the league community.</p></div>
            <Link href="/login" className="section-link">Create a profile <ArrowRight size={18} /></Link>
          </div>
          {members.length ? (
            <div className="members-strip" data-reveal>
              {members.map((member, index) => (
                <div className="member-cell" key={member.id} style={{ "--member-delay": `${index * 70}ms` } as CSSProperties}>
                  <Avatar src={member.avatarUrl || undefined} fallback={member.username} />
                  <div className="min-w-0"><p>{member.username}</p><span>{roleLabels[member.roles[0] || "MEMBER"]}</span></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="members-empty" data-reveal><Users size={23} /> New Discord members will appear here.</div>
          )}
        </div>
      </section>

      <section className="final-rally">
        <div className="final-rally-art" aria-hidden="true" />
        <div className="ow-container final-rally-grid" data-reveal>
          <div>
            <span><Sparkles size={16} /> Season 9 status</span>
            <h2>Season 9 is<br />in preparation.</h2>
            <p>Dates, registration details, captain selection, and the competitive schedule will be announced when they are confirmed.</p>
          </div>
          <div className="final-rally-actions">
            <a href="https://discord.gg/QMukTWr32f" target="_blank" rel="noopener noreferrer" className="hero-primary-action"><MessageCircle size={19} /> Join for updates</a>
            <Link href="/season-9" className="hero-secondary-action">Season 9 overview <ArrowRight size={18} /></Link>
          </div>
        </div>
      </section>
    </div>
  );
}
