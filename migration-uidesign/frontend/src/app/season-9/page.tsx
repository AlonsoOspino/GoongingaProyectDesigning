import Link from "next/link";
import { ArrowRight, CalendarClock, Check, MessageCircle, Users } from "lucide-react";

export const metadata = { title: "Season 9" };

export default function SeasonNinePage() {
  return (
    <div>
      <section className="season-nine-hero">
        <div className="ow-container season-nine-grid">
          <div><span className="ow-eyebrow">Goonginga League</span><h1 className="mt-3 font-display text-7xl uppercase md:text-8xl">Season 9</h1><p className="mt-4 max-w-2xl text-base leading-7 text-text-secondary">Registration is open. Teams and the match calendar will be published here.</p><Link href="/login" className="ow-button mt-7">Register with Discord <ArrowRight size={18} /></Link></div>
          <div className="season-nine-number">09</div>
        </div>
      </section>
      <section className="ow-section"><div className="ow-container grid gap-4 md:grid-cols-3">{[
        { icon: MessageCircle, title: "Discord registration", copy: "One Network Member profile for registration and community roles." },
        { icon: Users, title: "Teams coming soon", copy: "Rosters will appear after registration and team formation are complete." },
        { icon: CalendarClock, title: "Dates being finalized", copy: "The schedule and match windows will be posted before the season begins." },
      ].map(({ icon: Icon, title, copy }) => <article className="ow-panel p-6" key={title}><Icon className="text-accent" size={24} /><h2 className="mt-5 text-lg font-extrabold">{title}</h2><p className="mt-2 text-sm leading-6 text-muted">{copy}</p></article>)}</div></section>
      <section className="border-y border-border bg-white py-12"><div className="ow-container"><span className="ow-eyebrow">Confirmed rule</span><div className="mt-4 flex flex-col justify-between gap-6 md:flex-row md:items-center"><div><h2 className="font-display text-5xl uppercase">2 bans per map</h2><p className="mt-2 text-sm text-muted">Two bans maximum per role between both teams.</p></div><div className="flex items-center gap-3 text-sm font-bold text-success"><Check size={20} /> Included in the Season 9 format</div></div></div></section>
    </div>
  );
}
