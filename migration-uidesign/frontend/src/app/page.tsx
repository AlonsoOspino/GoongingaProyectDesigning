import Link from "next/link";
import {
  ArrowRight,
  Ban,
  CalendarDays,
  Crown,
  ExternalLink,
  GitBranch,
  Map,
  MessageCircle,
  Radio,
  RadioTower,
  UserPlus,
  Users,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { getRecentNetworkMembers } from "@/lib/api/networkMember";
import type { NetworkMemberRole } from "@/lib/api/types";
import { AnnouncementRenderer } from "@/announcements/AnnouncementRenderer";

export const revalidate = 60;

const roleLabels: Record<NetworkMemberRole, string> = {
  MEMBER: "Member",
  ADMIN: "Admin",
  CASTER: "Caster",
  DEVELOPER: "Developer",
  SEASON_PLAYER: "Season Player",
  MODERATOR: "Moderator",
  COMMUNITY_MANAGER: "Community Manager",
  CONTENT_CREATOR: "Content Creator",
  SOCIAL_MEDIA: "Social Media",
};

const seasonFlow = [
  {
    icon: UserPlus,
    title: "Registration",
    copy: "Players register through Discord and confirm their roles for the upcoming season.",
  },
  {
    icon: Crown,
    title: "Captains",
    copy: "League admins select the captains and bring them together before the team draft.",
  },
  {
    icon: GitBranch,
    title: "Team draft",
    copy: "Captains select their rosters through the live draft app until every team is complete.",
  },
  {
    icon: CalendarDays,
    title: "Match schedule",
    copy: "Once rosters are confirmed, weekly match windows and broadcasts are scheduled.",
  },
];

export default async function HomePage() {
  const members = await getRecentNetworkMembers().catch(() => []);

  return (
    <div className="home-page home-editorial">
      <section className="home-hero">
        <div className="home-hero-shade" />
        <div className="ow-container home-hero-content">
          <span className="ow-eyebrow">Overtime Productions · Season 9</span>
          <h1 className="display-title">Goonginga Season</h1>
          <p>Season 9 registration is now open.</p>
          <div className="home-hero-actions">
            <Link href="/login" className="ow-button">Register with Discord <ArrowRight size={20} /></Link>
            <Link href="/season-9" className="ow-button ow-button-secondary">View Season 9</Link>
          </div>
          <div className="home-hero-meta"><span>Est. 2023</span><span>8 completed seasons</span><span>Overwatch</span><span>Community league</span></div>
        </div>
      </section>

      <AnnouncementRenderer />

      <section className="season-overview ow-section">
        <div className="ow-container overview-heading">
          <span className="ow-eyebrow">Season overview</span>
          <h2>From registration<br />to match week</h2>
          <p>Each Goonginga season follows the same structure. Players register, captains are selected, teams are drafted, and the weekly schedule begins once rosters are confirmed.</p>
        </div>
        <div className="ow-container overview-layout">
          <figure className="overview-image media-frame">
            <img src="/landing/overview.webp" alt="Overwatch characters preparing together" />
            <figcaption>Season preparation</figcaption>
          </figure>
          <div className="season-flow">
            {seasonFlow.map(({ icon: Icon, title, copy }, index) => (
              <article className="season-flow-step" key={title} style={{ animationDelay: `${index * 90}ms` }}>
                <span className="season-flow-number">{String(index + 1).padStart(2, "0")}</span>
                <Icon size={22} />
                <div><h3>{title}</h3><p>{copy}</p></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="competition-system">
        <article className="system-feature system-feature-dark">
          <div className="ow-container system-feature-grid">
            <div className="system-feature-copy">
              <span className="ow-eyebrow"><Ban size={16} /> Match rules</span>
              <p className="system-index">01</p>
              <h2>Hero bans</h2>
              <p>Teams can ban up to two heroes per role between them on each map. A banned hero cannot be banned again on any later map in the match.</p>
              <p>After every map, the team that lost starts the next ban phase.</p>
            </div>
            <figure className="system-feature-media">
              <img src="/landing/hero-bans.webp" alt="Overwatch hero ban screen" />
            </figure>
          </div>
        </article>

        <article className="system-feature system-feature-light">
          <div className="ow-container system-feature-grid reverse">
            <div className="system-feature-copy">
              <span className="ow-eyebrow"><Map size={16} /> Weekly rotation</span>
              <p className="system-index">02</p>
              <h2>Map pool</h2>
              <p>The map pool is prepared by league admins before each match week. Every map in the pool is used across the weekly schedule.</p>
              <p>Modes and locations are selected to keep the rotation as varied as possible.</p>
            </div>
            <figure className="system-feature-media map-pool-media">
              <img src="/landing/map-pool.webp" alt="Selection of Overwatch maps" />
            </figure>
          </div>
        </article>
      </section>

      <section className="realtime-section">
        <div className="realtime-visual">
          <img src="/landing/realtime.webp" alt="Overwatch match interaction" />
          <div className="realtime-overlay" />
        </div>
        <div className="ow-container realtime-content">
          <div className="realtime-copy">
            <span className="ow-eyebrow"><RadioTower size={16} /> Real-time interactions</span>
            <h2>Connected match operations</h2>
            <p>The website connects the match workflow in real time. Captains use the draft app to submit picks and bans during the pre-match phase.</p>
            <p>Every update is sent directly to the broadcast overlay used on stream, keeping captains, staff and viewers on the same match state.</p>
            <div className="realtime-points">
              <span><GitBranch size={18} /> Captain draft app</span>
              <span><Radio size={18} /> Live stream overlay</span>
              <span><CalendarDays size={18} /> Match state updates</span>
            </div>
          </div>
        </div>
      </section>

      <section className="league-history-expanded ow-section">
        <div className="ow-container league-history-header">
          <div><span className="ow-eyebrow">League history</span><h2>Overtime Productions</h2></div>
          <div className="league-history-intro">
            <p>Overtime Productions started in 2023 with Goonginga, an Overwatch competition organized among friends.</p>
            <p>Goonginga developed into recurring seasons with drafted teams, weekly matches, broadcasts, standings and playoffs. It remains the Overwatch league operated by Overtime Productions.</p>
          </div>
        </div>
        <div className="ow-container history-image-grid">
          <figure className="history-image-item">
            <img src="/emotionalsupport.png" alt="Goonginga League match broadcast" />
            <figcaption><span>01</span><strong>Match broadcasts</strong><p>Live coverage, overlays and recorded season results.</p></figcaption>
          </figure>
          <figure className="history-image-item">
            <img src="/community.png" alt="Goonginga Overwatch community" />
            <figcaption><span>02</span><strong>Eight completed seasons</strong><p>Drafted rosters, regular-season standings and playoffs.</p></figcaption>
          </figure>
        </div>
        <div className="ow-container league-history-footer">
          <div><strong>2023</strong><span>Founded</span></div>
          <div><strong>08</strong><span>Completed seasons</span></div>
          <div><strong>122</strong><span>Maps in Season 8</span></div>
          <a href="https://www.twitch.tv/goongingatournament" target="_blank" rel="noopener noreferrer"><Radio size={18} /> Goonginga on Twitch <ExternalLink size={15} /></a>
        </div>
      </section>

      <section className="ow-section members-section">
        <div className="ow-container">
          <div className="section-lead compact">
            <div><span className="ow-eyebrow">Goonginga Network</span><h2>New members</h2></div>
            <Link href="/login" className="section-link">Join through Discord <ArrowRight size={18} /></Link>
          </div>
          {members.length ? (
            <div className="members-strip">
              {members.map((member, index) => (
                <div className="member-cell" key={member.id} style={{ animationDelay: `${index * 70}ms` }}>
                  <Avatar src={member.avatarUrl || undefined} fallback={member.username} />
                  <div className="min-w-0"><p>{member.username}</p><span>{roleLabels[member.roles[0] || "MEMBER"]}</span></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="members-empty"><Users size={23} /> New Discord members will appear here.</div>
          )}
        </div>
      </section>

      <section className="season-registration-band">
        <div className="ow-container season-registration-grid">
          <div><span className="ow-eyebrow">Season 9</span><h2>Registration is open</h2><p>Join the Goonginga Discord before registering for the season.</p></div>
          <div className="season-registration-actions">
            <Link href="/login" className="ow-button"><MessageCircle size={19} /> Register with Discord</Link>
            <Link href="/season-9" className="ow-button ow-button-secondary">Season details</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
