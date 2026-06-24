import Link from "next/link";

export const metadata = {
  title: "Developer | Goonginga League",
  description: "System map and broadcast pipeline for Goonginga League.",
};

const pipeline = [
  {
    name: "Twitch",
    type: "Community",
    detail: "Viewers, chat, stream night",
    tone: "border-[#9146FF] text-[#c7a7ff]",
  },
  {
    name: "Overwatch",
    type: "Game",
    detail: "Match is played, maps and results happen",
    tone: "border-warning text-warning",
  },
  {
    name: "Web App",
    type: "Control",
    detail: "Schedule, teams, draft, stats, admin tools",
    tone: "border-primary text-primary",
  },
  {
    name: "Database",
    type: "Source of truth",
    detail: "Matches, teams, members, stats, assets",
    tone: "border-success text-success",
  },
  {
    name: "Overlay",
    type: "Browser scenes",
    detail: "Reads match data and renders stream graphics",
    tone: "border-accent text-accent",
  },
  {
    name: "Launcher",
    type: "Operator",
    detail: "Local bridge for stream controls",
    tone: "border-white/70 text-white",
  },
  {
    name: "OBS",
    type: "Production",
    detail: "Combines gameplay, overlays, audio",
    tone: "border-danger text-danger",
  },
  {
    name: "Twitch",
    type: "Output",
    detail: "Final broadcast goes live",
    tone: "border-[#9146FF] text-[#c7a7ff]",
  },
];

const dataModels = [
  ["Tournament", "Season state, stages, active league"],
  ["Match", "Teams, date, score, status, maps"],
  ["DraftTable", "Map pick, bans, turn timer, phase"],
  ["Team", "Roster, logos, records, map stats"],
  ["Member", "Roles, captain/admin/editor access"],
  ["PlayerStat", "OCR stats, per-10 numbers, rankings"],
  ["News", "Announcements and articles"],
  ["OverlayAsset", "Broadcast graphics and scene assets"],
];

const appSurfaces = [
  {
    title: "Public Site",
    routes: ["/", "/schedule", "/standings", "/teams", "/stats", "/news"],
    reads: "Reads published league data",
  },
  {
    title: "Dashboards",
    routes: ["/admin-dashboard", "/manager-dashboard", "/captain-dashboard", "/editor-dashboard"],
    reads: "Creates and updates match data",
  },
  {
    title: "Draft Table",
    routes: ["/draft-table/[matchId]", "/draft"],
    reads: "Turns match state into map and ban flow",
  },
  {
    title: "OBS Overlays",
    routes: ["/overlay/match-header", "/overlay/roster", "/overlay/map-pool", "/overlay/wincards"],
    reads: "Renders database state as stream scenes",
  },
];

const connections = [
  ["Match", "DraftTable", "starts draft flow"],
  ["Match", "PlayerStat", "receives post-game stats"],
  ["Team", "Member", "owns roster"],
  ["Match", "Overlay", "feeds live graphics"],
  ["OverlayAsset", "OBS", "becomes browser source media"],
  ["PlayerStat", "Stats Page", "builds rankings"],
];

function SectionTitle({
  kicker,
  title,
  copy,
}: {
  kicker: string;
  title: string;
  copy?: string;
}) {
  return (
    <div className="mb-6 grid gap-3 md:grid-cols-[320px_1fr] md:items-end">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.24em] text-primary">{kicker}</p>
        <h2 className="mt-2 font-display text-5xl uppercase leading-none text-white md:text-6xl">{title}</h2>
      </div>
      {copy && <p className="max-w-3xl text-sm leading-6 text-zinc-400 md:text-base">{copy}</p>}
    </div>
  );
}

export default function DevPage() {
  return (
    <div className="min-h-screen bg-[#080d10] text-foreground">
      <section className="border-b border-white/10 bg-[linear-gradient(135deg,#111820_0%,#080d10_56%,#141016_100%)]">
        <div className="mx-auto max-w-7xl px-4 py-14 lg:px-8 lg:py-20">
          <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-end">
            <div>
              <div className="mb-5 flex flex-wrap gap-2">
                <span className="border border-primary bg-primary/15 px-3 py-1 text-xs font-black uppercase tracking-widest text-primary">
                  Developer Page
                </span>
                <span className="border border-accent bg-accent/15 px-3 py-1 text-xs font-black uppercase tracking-widest text-accent">
                  System Map
                </span>
                <span className="border border-warning bg-warning/15 px-3 py-1 text-xs font-black uppercase tracking-widest text-warning">
                  OBS Pipeline
                </span>
              </div>
              <h1 className="font-display text-6xl uppercase leading-[0.9] text-white md:text-8xl lg:text-9xl">
                Goonginga League System
              </h1>
              <p className="mt-6 max-w-3xl text-base leading-7 text-zinc-300 md:text-lg">
                This page explains how the league website, database, overlays, launcher, OBS, and Twitch connect.
                Less mystery, more map.
              </p>
            </div>

            <div className="border border-white/15 bg-black/25 p-5">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-zinc-500">Current purpose</p>
              <p className="mt-4 text-2xl font-black leading-tight text-white">
                One project controlling both league operations and broadcast graphics.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2 text-xs font-black uppercase tracking-wider">
                <span className="border border-primary/40 bg-primary/10 p-3 text-primary">Website</span>
                <span className="border border-success/40 bg-success/10 p-3 text-success">Database</span>
                <span className="border border-accent/40 bg-accent/10 p-3 text-accent">Overlay</span>
                <span className="border border-danger/40 bg-danger/10 p-3 text-danger">OBS</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-10 lg:px-8 lg:py-14">
        <section className="mb-14">
          <SectionTitle
            kicker="Main Flow"
            title="Broadcast Chain"
            copy="This is the presentation version of the stream route. Each block is one step, and each step either produces data, transforms it, or broadcasts it."
          />

          <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {pipeline.map((step, index) => (
              <article key={`${step.name}-${index}`} className={`grid min-h-48 grid-rows-[auto_auto_1fr_auto] border bg-white/[0.035] p-4 ${step.tone}`}>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[11px] font-black uppercase tracking-widest opacity-80">{step.type}</p>
                  <span className="font-mono text-xs text-zinc-500">{String(index + 1).padStart(2, "0")}</span>
                </div>
                <h3 className="mt-2 text-2xl font-black text-white">{step.name}</h3>
                <p className="mt-4 text-sm leading-6 text-zinc-400">{step.detail}</p>
                <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-3 text-[11px] font-black uppercase tracking-widest text-zinc-500">
                  <span>{index === 0 ? "Start" : "Receives"}</span>
                  <span>{index === pipeline.length - 1 ? "Live" : "Next ->"}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mb-14">
          <SectionTitle
            kicker="Data Structure"
            title="What talks to what"
            copy="The database is the center. Pages and overlays do not invent their own state; they read or update these shared records."
          />

          <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
            <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {dataModels.map(([model, detail]) => (
                <article key={model} className="min-h-40 border border-white/12 bg-surface/70 p-4">
                  <p className="font-mono text-xs uppercase tracking-widest text-primary">{model}</p>
                  <p className="mt-4 text-sm leading-6 text-zinc-400">{detail}</p>
                </article>
              ))}
            </div>

            <div className="border border-success/40 bg-success/10 p-5">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-success">Database role</p>
              <h3 className="mt-3 text-3xl font-black text-white">Single source of truth</h3>
              <p className="mt-4 text-sm leading-6 text-zinc-300">
                The site, dashboards, draft table, and overlays are different windows into the same league data.
                That is what makes stream graphics stay in sync with match operations.
              </p>
              <div className="mt-5 grid gap-2">
                {connections.map(([from, to, label]) => (
                  <div key={`${from}-${to}`} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border border-white/10 bg-black/20 p-2 text-xs">
                    <span className="font-bold text-white">{from}</span>
                    <span className="text-zinc-500">-&gt;</span>
                    <span className="font-bold text-white">{to}</span>
                    <span className="col-span-3 text-zinc-500">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mb-14">
          <SectionTitle
            kicker="App Surfaces"
            title="Where the data appears"
            copy="These are the actual areas of the app. The important distinction is who uses them: public viewers, staff, captains, or OBS."
          />

          <div className="grid auto-rows-fr gap-4 md:grid-cols-2 xl:grid-cols-4">
            {appSurfaces.map((surface) => (
              <article key={surface.title} className="grid min-h-72 grid-rows-[auto_1fr_auto] border border-white/12 bg-card/70 p-5">
                <div>
                  <h3 className="text-2xl font-black text-white">{surface.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{surface.reads}</p>
                </div>
                <div className="mt-5 space-y-2">
                  {surface.routes.map((route) => (
                    <div key={route} className="border border-white/10 bg-black/25 px-3 py-2 font-mono text-xs text-zinc-300">
                      {route}
                    </div>
                  ))}
                </div>
                <div className="mt-5 h-1 bg-gradient-to-r from-primary via-accent to-transparent" />
              </article>
            ))}
          </div>
        </section>

        <section className="border border-[#9146FF]/40 bg-[#9146FF]/10 p-6 md:p-8">
          <div className="grid gap-6 lg:grid-cols-[330px_1fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[#c7a7ff]">OBS explanation</p>
              <h2 className="mt-2 font-display text-5xl uppercase leading-none text-white md:text-6xl">Why OBS is here</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <article className="min-h-36 border border-white/15 bg-black/25 p-4">
                <h3 className="font-black text-white">1. Capture</h3>
                <p className="mt-3 text-sm leading-6 text-zinc-400">OBS receives Overwatch gameplay and caster audio.</p>
              </article>
              <article className="min-h-36 border border-white/15 bg-black/25 p-4">
                <h3 className="font-black text-white">2. Compose</h3>
                <p className="mt-3 text-sm leading-6 text-zinc-400">OBS loads overlay routes as browser sources.</p>
              </article>
              <article className="min-h-36 border border-white/15 bg-black/25 p-4">
                <h3 className="font-black text-white">3. Broadcast</h3>
                <p className="mt-3 text-sm leading-6 text-zinc-400">The final scene goes back to Twitch as the stream.</p>
              </article>
            </div>
          </div>
        </section>

        <div className="mt-10 flex justify-end">
          <Link
            href="/"
            className="border border-primary bg-primary/10 px-5 py-3 text-sm font-black uppercase tracking-wider text-primary transition-colors hover:bg-primary hover:text-white"
          >
            Back to League
          </Link>
        </div>
      </main>
    </div>
  );
}
