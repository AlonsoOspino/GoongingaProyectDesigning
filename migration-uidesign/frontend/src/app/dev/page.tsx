import Link from "next/link";

export const metadata = {
  title: "Developer | Goonginga League",
  description: "How Goonginga League connects matches, data, overlays, OBS, and Twitch.",
};

const streamFlow = [
  {
    title: "Twitch",
    eyebrow: "Broadcast",
    body: "The public stream is the final stage and the main entry point for viewers.",
  },
  {
    title: "Overwatch",
    eyebrow: "Match",
    body: "Teams play the series while match data, maps, bans, and results are tracked.",
  },
  {
    title: "Web + DB",
    eyebrow: "Control room",
    body: "The platform stores teams, schedules, draft state, stats, users, news, and assets.",
  },
  {
    title: "Overlay",
    eyebrow: "Graphics",
    body: "Browser scenes render match headers, rosters, map pools, win cards, and leaderboards.",
  },
  {
    title: "Launcher",
    eyebrow: "Operator",
    body: "The launcher coordinates the local broadcast setup and keeps stream tools easy to trigger.",
  },
  {
    title: "OBS",
    eyebrow: "Production",
    body: "OBS captures gameplay and browser overlays, then sends the composed show back to Twitch.",
  },
];

const platformAreas = [
  {
    title: "League Site",
    items: ["Schedule", "Standings", "Teams", "News", "Player stats"],
  },
  {
    title: "Match Operations",
    items: ["Ready checks", "Map flow", "Hero bans", "Result submission", "Captain tools"],
  },
  {
    title: "Broadcast Layer",
    items: ["OBS browser sources", "Live overlays", "Roster graphics", "Map pool screens", "Win cards"],
  },
  {
    title: "Data Pipeline",
    items: ["Prisma models", "REST API", "OCR stat intake", "Asset upload", "Role permissions"],
  },
];

const stack = [
  "Next.js App Router",
  "React + TypeScript",
  "Tailwind CSS",
  "Node + Express",
  "Prisma",
  "Google Vision OCR",
  "OBS browser overlays",
];

function ArrowIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={`h-5 w-5 text-primary/70 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  );
}

export default function DevPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="border-b border-border/60 bg-surface/30">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 lg:grid-cols-[1fr_340px] lg:px-8 lg:py-16">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Developer Notes
            </div>
            <h1 className="max-w-4xl text-4xl font-bold leading-tight text-foreground md:text-5xl">
              Goonginga League, from match night to broadcast.
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-muted md:text-lg">
              This project started as a community league site and has grown into a small production system:
              teams, schedules, drafts, stats, overlays, and OBS-facing tools all working from the same data.
            </p>
          </div>

          <aside className="rounded-lg border border-border/70 bg-card/80 p-5 shadow-lg shadow-black/20">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 overflow-hidden rounded-lg border border-border bg-surface">
                <img src="/LuffyRlbaf.jpg" alt="Developer avatar" className="h-full w-full object-cover" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Built by the league</p>
                <p className="mt-1 text-sm text-muted">First big web project, now running the competitive workflow end to end.</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {stack.slice(0, 4).map((item) => (
                <span key={item} className="rounded-md border border-border/70 bg-surface/80 px-2.5 py-1 text-xs text-muted">
                  {item}
                </span>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-10 lg:px-8 lg:py-12">
        <section className="mb-10 rounded-lg border border-border/70 bg-card/70 p-5 shadow-lg shadow-black/20 md:p-6">
          <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Stream Pipeline</p>
              <h2 className="mt-1 text-2xl font-bold text-foreground">How a match becomes a Twitch show</h2>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-muted">
              The loop is intentionally simple: gameplay creates data, data feeds the site and overlays, OBS packages it,
              and Twitch sends it back to the community.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            {streamFlow.map((step, index) => (
              <article key={step.title} className="relative min-h-40 rounded-lg border border-border/70 bg-surface/70 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="rounded bg-primary/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
                    {step.eyebrow}
                  </span>
                  <span className="font-mono text-xs text-muted">0{index + 1}</span>
                </div>
                <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted">{step.body}</p>
                {index < streamFlow.length - 1 && (
                  <ArrowIcon className="absolute right-4 top-4 hidden xl:block" />
                )}
              </article>
            ))}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-lg border border-border/70 bg-card/70 p-5 md:p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Current Platform</p>
            <h2 className="mt-1 text-2xl font-bold text-foreground">What exists now</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {platformAreas.map((area) => (
                <article key={area.title} className="rounded-lg border border-border/60 bg-surface/60 p-4">
                  <h3 className="font-semibold text-foreground">{area.title}</h3>
                  <ul className="mt-3 space-y-2 text-sm text-muted">
                    {area.items.map((item) => (
                      <li key={item} className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-border/70 bg-card/70 p-5 md:p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">OBS Intro</p>
            <h2 className="mt-1 text-2xl font-bold text-foreground">Why OBS matters here</h2>
            <p className="mt-4 text-sm leading-6 text-muted">
              OBS is the broadcast bridge. The web app generates clean browser-source overlays, the launcher helps
              prepare the local stream setup, and OBS combines those graphics with gameplay before sending everything
              to Twitch.
            </p>
            <div className="mt-6 rounded-lg border border-primary/25 bg-primary/10 p-4">
              <p className="text-sm font-semibold text-foreground">Practical result</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                Stream scenes can stay synced with the same match data used by the website instead of being rebuilt
                manually every match night.
              </p>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {stack.map((item) => (
                <span key={item} className="rounded-md border border-border/70 bg-surface/80 px-2.5 py-1 text-xs text-muted">
                  {item}
                </span>
              ))}
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-lg border border-border/70 bg-surface/50 p-5 md:p-6">
          <div className="grid gap-6 md:grid-cols-[220px_1fr] md:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Next Focus</p>
              <h2 className="mt-1 text-2xl font-bold text-foreground">Make match night smoother</h2>
            </div>
            <p className="text-sm leading-6 text-muted">
              The next useful improvements are around fewer manual steps: cleaner OBS/launcher controls, stronger
              overlay states, and more reliable stat capture after games.
            </p>
          </div>
        </section>

        <div className="mt-10">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-elevated px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary/50 hover:bg-surface"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19 3 12m0 0 7-7m-7 7h18" />
            </svg>
            Back to Home
          </Link>
        </div>
      </main>
    </div>
  );
}
