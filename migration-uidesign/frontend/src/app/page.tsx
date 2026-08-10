import Link from "next/link";
import { ArrowRight, Ban, CalendarDays, ExternalLink, History, Play, Radio, ShieldCheck, Swords, Users } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { getRecentNetworkMembers } from "@/lib/api/networkMember";
import type { NetworkMemberRole } from "@/lib/api/types";

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

const rules = [
  { icon: Ban, title: "2 bans per map", copy: "Two bans limit per role between both teams. Both sides share that limit and must coordinate their choices." },
  { icon: Swords, title: "Regular season", copy: "Scheduled team matches build the standings before the highest seeds advance to playoffs." },
  { icon: ShieldCheck, title: "Role structure", copy: "Every lineup is organized around Tank, Damage, and Support roles." },
  { icon: CalendarDays, title: "Published match nights", copy: "Schedules, results, and format updates stay available throughout the season." },
];

export default async function HomePage() {
  const members = await getRecentNetworkMembers().catch(() => []);

  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="home-hero-shade" />
        <div className="home-hero-accent" />
        <div className="ow-container home-hero-content">
          <span className="ow-eyebrow">Goonginga League</span>
          <h1 className="display-title">Season 9</h1>
          <p>Season 9 registration is now open.</p>
          <div className="home-hero-actions">
            <Link href="/login" className="ow-button">Register with Discord <ArrowRight size={20} /></Link>
            <Link href="/season-9" className="ow-button ow-button-secondary">Season 9 details</Link>
          </div>
          <div className="home-hero-meta"><span>Est. 2023</span><span>8 completed seasons</span><span>Overwatch</span><span>Community league</span></div>
        </div>
      </section>

      <section className="ow-section format-section">
        <div className="ow-container">
          <div className="section-lead">
            <div><span className="ow-eyebrow">Competition format</span><h2>How the season works</h2></div>
            <p>Season 9 teams, dates and match windows will be published after registration.</p>
          </div>

          <div className="format-grid">
            <div className="format-image">
              <img src="/PREMATCH.png" alt="Goonginga match broadcast" />
              <div className="format-image-label"><Play size={18} /> Match night format</div>
            </div>
            <div className="format-rules">
              {rules.map(({ icon: Icon, title, copy }, index) => (
                <article className="format-rule" key={title} style={{ animationDelay: `${index * 80}ms` }}>
                  <div className="format-rule-number">0{index + 1}</div>
                  <div className="format-rule-icon"><Icon size={24} /></div>
                  <div><strong>{title}</strong><p>{copy}</p></div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="league-story">
        <div className="ow-container league-story-grid">
          <div className="league-story-media">
            <img className="story-main-image" src="/emotionalsupport.png" alt="Goonginga League match night" />
            <img className="story-secondary-image" src="/community.png" alt="Goonginga League community" />
            <div className="story-image-caption"><Radio size={18} /> Goonginga since 2023</div>
          </div>
          <div className="league-story-copy">
            <span className="ow-eyebrow">League history</span>
            <h2>Goonginga<br />since 2023</h2>
            <p>Goonginga is an Overwatch league founded in 2023. The league has completed eight seasons with drafted teams, regular-season matches, broadcasts and playoffs.</p>
            <p>Season results, team rosters and player statistics are preserved in the league archive.</p>
            <div className="league-story-facts">
              <div><strong>2023</strong><span>First season</span></div>
              <div><strong>08</strong><span>Completed seasons</span></div>
              <div><strong>122</strong><span>Maps in Season 8</span></div>
            </div>
            <a href="https://www.twitch.tv/goongingatournament" target="_blank" rel="noopener noreferrer" className="story-link"><Radio size={19} /> Watch Goonginga on Twitch <ExternalLink size={16} /></a>
          </div>
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

      <section className="home-history-band">
        <div className="ow-container home-history-grid">
          <div><span className="ow-eyebrow">League archive</span><h2>Season 8 is preserved</h2><p>Final standings, category leaders, rosters, playoffs, Grand Finals, MVP, and Wrapped media now live in one static snapshot.</p></div>
          <Link href="/history" className="ow-button"><History size={20} /> Explore History</Link>
        </div>
      </section>
    </div>
  );
}
