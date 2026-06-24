import Link from "next/link";

export const metadata = {
  title: "Developer | Goonginga League",
  description: "The broadcast and data system behind Goonginga League.",
};

const signalRoute = [
  {
    label: "Twitch",
    kicker: "Audience",
    color: "border-[#9146FF] bg-[#9146FF]/15 text-[#c7a7ff]",
    note: "Where the show lands.",
  },
  {
    label: "Overwatch",
    kicker: "Gameplay",
    color: "border-warning bg-warning/15 text-warning",
    note: "The actual match source.",
  },
  {
    label: "Web + Database",
    kicker: "Brain",
    color: "border-primary bg-primary/15 text-primary",
    note: "Teams, matches, draft, stats, assets.",
  },
  {
    label: "Overlay",
    kicker: "Graphics",
    color: "border-accent bg-accent/15 text-accent",
    note: "Browser scenes powered by live data.",
  },
  {
    label: "Launcher",
    kicker: "Operator",
    color: "border-success bg-success/15 text-success",
    note: "Local controls for stream night.",
  },
  {
    label: "OBS",
    kicker: "Mixer",
    color: "border-danger bg-danger/15 text-danger",
    note: "Gameplay + overlays + audio.",
  },
  {
    label: "Twitch",
    kicker: "Return",
    color: "border-[#9146FF] bg-[#9146FF]/15 text-[#c7a7ff]",
    note: "The complete broadcast returns to chat.",
  },
];

const panels = [
  {
    title: "League Website",
    subtitle: "Public hub",
    image: "/community.png",
    color: "from-primary/25 to-accent/10",
    points: ["Schedule", "Teams", "Standings", "News"],
  },
  {
    title: "Match Control",
    subtitle: "Managers + captains",
    image: "/GameCards.png",
    color: "from-warning/25 to-danger/10",
    points: ["Ready checks", "Map flow", "Hero bans", "Results"],
  },
  {
    title: "Broadcast Scenes",
    subtitle: "OBS browser sources",
    image: "/PREMATCH.png",
    color: "from-accent/25 to-[#9146FF]/10",
    points: ["Headers", "Rosters", "Map pools", "Win cards"],
  },
  {
    title: "Stats Pipeline",
    subtitle: "OCR + database",
    image: "/emotionalsupport.png",
    color: "from-success/25 to-primary/10",
    points: ["Screenshots", "Google Vision", "Player stats", "Leaderboards"],
  },
];

const buildNotes = [
  ["Frontend", "Next.js, React, TypeScript, Tailwind"],
  ["Backend", "Express services, Prisma repositories, auth roles"],
  ["Broadcast", "Overlay routes designed as OBS browser sources"],
  ["Data", "Matches, teams, members, maps, heroes, stats, news"],
];

function SignalArrow() {
  return (
    <svg className="h-7 w-7 shrink-0 text-foreground/35 lg:rotate-0 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h14m-5-5 5 5-5 5" />
    </svg>
  );
}

export default function DevPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#070b0d] text-foreground">
      <section className="relative min-h-[calc(100vh-4rem)] overflow-hidden border-b border-white/10">
        <img
          src="/PREMATCH.png"
          alt="Goonginga League broadcast graphics"
          className="absolute inset-0 h-full w-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(145,70,255,0.45),transparent_30rem),radial-gradient(circle_at_84%_22%,rgba(56,189,248,0.28),transparent_28rem),linear-gradient(90deg,rgba(7,11,13,0.96)_0%,rgba(7,11,13,0.72)_46%,rgba(7,11,13,0.42)_100%)]" />
        <div className="absolute left-0 top-0 h-full w-2 bg-gradient-to-b from-[#9146FF] via-accent to-warning" />

        <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-10 px-4 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
          <div>
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <span className="rounded bg-[#9146FF] px-3 py-1 text-xs font-black uppercase tracking-wider text-white">
                Presentation Page
              </span>
              <span className="rounded border border-accent/50 bg-accent/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-accent">
                OBS Pipeline
              </span>
              <span className="rounded border border-warning/50 bg-warning/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-warning">
                Built for match night
              </span>
            </div>

            <h1 className="max-w-5xl font-display text-6xl uppercase leading-[0.88] text-white md:text-8xl lg:text-9xl">
              The Goonginga Broadcast Machine
            </h1>
            <p className="mt-7 max-w-3xl text-lg leading-8 text-zinc-200 md:text-xl">
              A community Overwatch league system that turns schedules, drafts, rosters, stats, and stream graphics
              into one connected production workflow.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-black uppercase tracking-wider text-background transition-transform hover:-translate-y-0.5"
              >
                View site
                <span aria-hidden="true">/</span>
              </Link>
              <a
                href="https://www.twitch.tv/goongingatournament"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md border border-[#9146FF]/70 bg-[#9146FF]/20 px-5 py-3 text-sm font-black uppercase tracking-wider text-[#d8c3ff] transition-transform hover:-translate-y-0.5"
              >
                Twitch channel
                <span aria-hidden="true">/</span>
              </a>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 rotate-2 bg-gradient-to-br from-[#9146FF]/50 via-accent/30 to-warning/30 blur-2xl" />
            <div className="relative border border-white/15 bg-background/70 p-3 shadow-2xl shadow-black/50 backdrop-blur">
              <div className="grid grid-cols-[1fr_110px] gap-3">
                <div className="relative aspect-video overflow-hidden border border-white/10 bg-black">
                  <img src="/GameCards.png" alt="Match cards preview" className="h-full w-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 to-transparent p-4">
                    <p className="text-xs font-black uppercase tracking-widest text-accent">Live Data Layer</p>
                    <p className="mt-1 text-2xl font-black text-white">Match assets ready for broadcast</p>
                  </div>
                </div>
                <div className="grid gap-3">
                  <div className="border border-primary/40 bg-primary/15 p-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-primary">Scenes</p>
                    <p className="mt-2 text-3xl font-black text-white">06</p>
                  </div>
                  <div className="border border-warning/40 bg-warning/15 p-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-warning">Flow</p>
                    <p className="mt-2 text-3xl font-black text-white">LIVE</p>
                  </div>
                  <div className="border border-[#9146FF]/40 bg-[#9146FF]/15 p-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-[#c7a7ff]">Target</p>
                    <p className="mt-2 text-3xl font-black text-white">OBS</p>
                  </div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-3 text-center text-[10px] font-black uppercase tracking-wider">
                <span className="border border-white/10 bg-white/5 py-2 text-zinc-300">Draft</span>
                <span className="border border-white/10 bg-white/5 py-2 text-zinc-300">Stats</span>
                <span className="border border-white/10 bg-white/5 py-2 text-zinc-300">Overlay</span>
                <span className="border border-white/10 bg-white/5 py-2 text-zinc-300">Stream</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main>
        <section className="relative border-b border-white/10 bg-[#0b1114] px-4 py-14 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.28em] text-accent">Signal Route</p>
                <h2 className="mt-2 font-display text-5xl uppercase leading-none text-white md:text-7xl">
                  Twitch to Twitch
                </h2>
              </div>
              <p className="max-w-2xl text-sm leading-6 text-zinc-300 md:text-base">
                The important idea: the stream is not separate from the website. The same source of truth can drive
                the public pages, the match tools, and the OBS graphics.
              </p>
            </div>

            <div className="flex flex-col items-stretch gap-3 lg:flex-row lg:items-center">
              {signalRoute.map((step, index) => (
                <div key={`${step.label}-${index}`} className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
                  <article className={`min-h-44 border ${step.color} p-4 shadow-xl shadow-black/20`}>
                    <p className="text-[11px] font-black uppercase tracking-widest opacity-80">{step.kicker}</p>
                    <h3 className="mt-2 text-2xl font-black text-white">{step.label}</h3>
                    <p className="mt-3 text-sm leading-5 text-zinc-300">{step.note}</p>
                    <div className="mt-5 h-1 w-full bg-current opacity-70" />
                  </article>
                  {index < signalRoute.length - 1 && <SignalArrow />}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-background px-4 py-14 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8">
              <p className="text-sm font-black uppercase tracking-[0.28em] text-warning">What I Built</p>
              <h2 className="mt-2 font-display text-5xl uppercase leading-none text-white md:text-7xl">
                Four parts, one system
              </h2>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {panels.map((panel) => (
                <article key={panel.title} className="group overflow-hidden border border-white/10 bg-surface/70">
                  <div className={`relative aspect-[16/7] bg-gradient-to-br ${panel.color}`}>
                    <img
                      src={panel.image}
                      alt={panel.title}
                      className="absolute inset-0 h-full w-full object-cover opacity-70 transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4">
                      <p className="text-xs font-black uppercase tracking-widest text-white/65">{panel.subtitle}</p>
                      <h3 className="mt-1 text-3xl font-black text-white">{panel.title}</h3>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-px bg-white/10">
                    {panel.points.map((point) => (
                      <div key={point} className="bg-card px-4 py-3 text-sm font-semibold text-zinc-200">
                        {point}
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden border-y border-white/10 bg-[#100b1d] px-4 py-16 lg:px-8">
          <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(145,70,255,0.26),transparent_35%),linear-gradient(245deg,rgba(56,189,248,0.18),transparent_42%)]" />
          <div className="relative mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.28em] text-[#d8c3ff]">OBS Intro</p>
              <h2 className="mt-2 font-display text-5xl uppercase leading-none text-white md:text-7xl">
                OBS is the stage manager
              </h2>
              <p className="mt-5 text-base leading-7 text-zinc-200">
                The website creates browser-source overlays. The launcher helps operate the local stream setup.
                OBS combines those overlays with gameplay and pushes the final show to Twitch.
              </p>
            </div>

            <div className="relative border border-white/15 bg-black/50 p-4 shadow-2xl shadow-black/40">
              <div className="grid gap-4 md:grid-cols-[1fr_180px]">
                <div className="relative aspect-video overflow-hidden border border-white/10 bg-black">
                  <img src="/PREMATCH.png" alt="Prematch overlay preview" className="h-full w-full object-cover" />
                  <div className="absolute left-5 top-5 rounded bg-danger px-3 py-1 text-xs font-black uppercase tracking-widest text-white">
                    OBS Preview
                  </div>
                </div>
                <div className="grid gap-3">
                  {["Gameplay Capture", "Browser Overlay", "Caster Audio", "Twitch Output"].map((item, index) => (
                    <div key={item} className="border border-white/10 bg-white/5 p-3">
                      <p className="font-mono text-xs text-zinc-500">0{index + 1}</p>
                      <p className="mt-1 text-sm font-black uppercase tracking-wider text-white">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#071014] px-4 py-14 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-4 md:grid-cols-4">
              {buildNotes.map(([title, body]) => (
                <article key={title} className="border border-white/10 bg-white/[0.04] p-5">
                  <p className="text-xs font-black uppercase tracking-widest text-primary">{title}</p>
                  <p className="mt-4 text-sm leading-6 text-zinc-300">{body}</p>
                </article>
              ))}
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6">
              <p className="max-w-2xl text-sm leading-6 text-zinc-400">
                This is still a first big project, but it is not just a static site anymore. It is a league dashboard,
                a production tool, and a broadcast graphics engine sharing the same match data.
              </p>
              <Link
                href="/"
                className="rounded-md border border-primary/50 bg-primary/10 px-5 py-3 text-sm font-black uppercase tracking-wider text-primary transition-colors hover:bg-primary hover:text-white"
              >
                Back to league
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
