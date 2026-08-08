"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getApiBase, getMvpVoting, voteForMvp, type MvpCampaign } from "@/lib/api";
import { readNetworkSessionToken } from "@/features/networkSession/storage";

export default function MvpVotingPage() {
  const [campaign, setCampaign] = useState<MvpCampaign | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [voted, setVoted] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { getMvpVoting({ cache: "no-store" }).then((data) => { setCampaign(data.campaign); setLoaded(true); }).catch(() => { setError("MVP voting is unavailable right now."); setLoaded(true); }); }, []);
  const winner = useMemo(() => campaign?.candidates.find((candidate) => candidate.id === campaign.winnerCandidateId) || null, [campaign]);
  async function submitVote() {
    const token = readNetworkSessionToken();
    if (!token) { window.location.href = `${getApiBase()}/network-auth/discord?return_to=${encodeURIComponent(`${window.location.origin}/mvp-voting`)}`; return; }
    if (!selected) return;
    setBusy(true); setError("");
    try { await voteForMvp(token, selected); setVoted(true); } catch (voteError) { setError(voteError instanceof Error ? voteError.message : "Could not submit your vote."); } finally { setBusy(false); }
  }

  if (!loaded) return <main className="min-h-screen grid place-items-center bg-background text-foreground"><p className="text-muted">Loading the MVP ballot...</p></main>;
  if (!campaign) return <main className="min-h-screen grid place-items-center bg-background text-foreground p-6"><Card className="max-w-lg p-8 text-center"><Badge variant="primary">GRAND FINALS</Badge><h1 className="mt-4 text-3xl font-bold">{error ? "MVP voting is unavailable" : "MVP voting is not live yet"}</h1><p className="mt-3 text-muted">{error || "The ballot unlocks when the finished Grand Finals roster is ready."}</p><Link href="/"><Button className="mt-6">Back home</Button></Link></Card></main>;

  return <main className="min-h-screen bg-background text-foreground px-4 py-12 md:py-20"><div className="mx-auto max-w-6xl"><header className="mx-auto max-w-3xl text-center"><Badge variant="primary">GOONGINGA LEAGUE · GRAND FINALS</Badge><h1 className="mt-5 text-5xl font-black tracking-tight md:text-7xl">Choose the <span className="text-primary">MVP</span>.</h1><p className="mt-5 text-lg leading-relaxed text-muted">Five players. One championship performance. Your vote crowns the most valuable player of the Grand Finals.</p></header>
    {campaign.status === "CLOSED" && winner ? <section className="mvp-winner-reveal mx-auto mt-12 max-w-3xl text-center"><div className="rounded-3xl border border-primary/40 bg-primary/10 p-8 md:p-14"><p className="font-mono text-sm uppercase tracking-[0.3em] text-primary">Grand Finals MVP</p><h2 className="mt-4 text-5xl font-black md:text-7xl">{winner.displayName}</h2>{winner.imageUrl && <img src={winner.imageUrl} alt={winner.displayName} className="mx-auto mt-8 aspect-square w-64 rounded-2xl object-cover shadow-2xl" />}</div></section> : <><div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">{campaign.candidates.map((candidate) => <button type="button" key={candidate.id} onClick={() => setSelected(candidate.id)} className={`group overflow-hidden rounded-2xl border text-left transition ${selected === candidate.id ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/60"}`}><div className="aspect-[4/5] bg-card">{candidate.imageUrl ? <img src={candidate.imageUrl} alt={candidate.displayName} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="grid h-full place-items-center text-sm text-muted">Image coming soon</div>}</div><div className="bg-card p-4"><p className="font-mono text-xs text-primary">CANDIDATE {candidate.sortOrder + 1}</p><h2 className="mt-1 text-xl font-bold">{candidate.displayName}</h2></div></button>)}</div><div className="mt-10 flex flex-col items-center gap-4 text-center">{voted ? <p className="rounded-full bg-primary/15 px-6 py-3 font-semibold text-primary">Vote locked in. Thank you for making the call.</p> : <Button size="lg" disabled={!selected || busy} onClick={submitVote}>{busy ? "Submitting..." : "Cast my MVP vote"}</Button>}{error && <p className="text-sm text-destructive">{error}</p>}<p className="text-sm text-muted">One vote per Network Member. Voting closes when the manager publishes the result.</p></div></>}</div></main>;
}
