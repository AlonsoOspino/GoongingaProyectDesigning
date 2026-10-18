"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { CalendarDays, Copy, ExternalLink, ListChecks, Pencil, Plus, Radio, RefreshCw, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { useSeasonOperations } from "@/components/admin/useSeasonOperations";
import { NoActiveSeason, OperationMessage, OperationTeamLogo, localMatchDate } from "@/components/admin/SeasonOperationUi";
import { adminCreateMatch, adminGenerateRoundRobin, adminUpdateMatch } from "@/lib/api/admin";
import { getDraftShareInfo } from "@/lib/api/draft";
import { regularSeasonDivision } from "@/features/tournament/divisions";
import type { Match } from "@/lib/api/types";

interface MatchForm {
  id: number | null;
  divisionId: string;
  teamAId: string;
  teamBId: string;
  week: string;
  startDate: string;
  bestOf: string;
  title: string;
  type: Match["type"];
  locked: boolean;
}
const overlayRoutes = [
  { route: "match-header", label: "Match header · left / right banners" },
  { route: "match-header-reversed", label: "Match header · reversed sides" },
  { route: "map-pool-clean", label: "Map pool" },
  { route: "wincards", label: "Win cards" },
  { route: "roster-a", label: "Team A roster" },
  { route: "roster-b", label: "Team B roster" },
  { route: "leaderboard", label: "Standings" },
  { route: "casting", label: "Casting" },
];

export default function SeasonSchedulePage() {
  const { token, ready, loading, error, tournament, teams, matches, refresh } = useSeasonOperations("/admin-dashboard/schedule");
  const [divisionFilter, setDivisionFilter] = useState("");
  const [weekFilter, setWeekFilter] = useState("");
  const [stage, setStage] = useState("ROUNDROBIN");
  const [form, setForm] = useState<MatchForm | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [streamMatch, setStreamMatch] = useState<Match | null>(null);
  const [streamKey, setStreamKey] = useState<string | null>(null);
  const [streamLoading, setStreamLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const teamsById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const divisions = tournament?.divisions ?? [];
  const canCreateWeeklyMatch = Boolean(tournament && ["SCHEDULED", "ROUNDROBIN"].includes(tournament.state));
  const weeks = Array.from(new Set(matches.filter((match) => match.type === "ROUNDROBIN").map((match) => match.semanas || 1))).sort((a, b) => a - b);
  const regularMatches = matches.filter((match) => match.type === "ROUNDROBIN");
  const filtered = matches.filter((match) => (!stage || (stage === "PLAYOFFS" ? ["PLAYINS", "PLAYOFFS", "SEMIFINALS", "FINALS"].includes(match.type) : match.type === stage)) && (!weekFilter || String(match.semanas || 1) === weekFilter));
  const displayedWeeks = stage === "ROUNDROBIN" ? (weekFilter ? [Number(weekFilter)] : weeks) : [0];
  const formTeams = teams.filter((team) => form?.type !== "ROUNDROBIN" || !divisions.length || String(team.divisionId) === form?.divisionId);
  const matchupName = (match: Match) => `${teamsById.get(match.teamAId)?.name || "Team A"} vs ${teamsById.get(match.teamBId)?.name || "Team B"}`;

  useEffect(() => {
    if (!ready || !token || !tournament) return;
    const interval = window.setInterval(() => { if (!document.hidden && !form && !busy) void refresh(token, true).catch(() => undefined); }, 15000);
    return () => window.clearInterval(interval);
  }, [ready, token, tournament, form, busy, refresh]);

  useEffect(() => {
    setStreamKey(null);
    if (!streamMatch || !token) return;
    let cancelled = false;
    setStreamLoading(true);
    getDraftShareInfo(token, streamMatch.id).then((share) => {
      if (!cancelled) setStreamKey(share.key);
    }).catch((reason) => {
      if (!cancelled) setDialogError(reason instanceof Error ? reason.message : "Unable to prepare the draft broadcast link.");
    }).finally(() => { if (!cancelled) setStreamLoading(false); });
    return () => { cancelled = true; };
  }, [streamMatch, token]);

  const streamPath = (route: string, matchId: number) => `/overlay/${route}/${matchId}${streamKey ? `?key=${encodeURIComponent(streamKey)}` : ""}`;

  function openMatch(match?: Match, divisionId?: number | null, week?: number) {
    setDialogError(null);
    const selectedDivision = match ? regularSeasonDivision(match, teamsById) : divisionId ?? (divisionFilter ? Number(divisionFilter) : divisions[0]?.id);
    setForm({ id: match?.id || null, divisionId: selectedDivision == null ? "" : String(selectedDivision), teamAId: match ? String(match.teamAId) : "", teamBId: match ? String(match.teamBId) : "", week: String(match?.semanas || week || Number(weekFilter) || 1), startDate: localMatchDate(match?.startDate), bestOf: String(match?.bestOf || 5), title: match?.title || "", type: match?.type || "ROUNDROBIN", locked: Boolean(match && (match.status !== "SCHEDULED" || match.gameNumber > 0)) });
  }

  async function saveMatch(event: FormEvent) {
    event.preventDefault();
    if (!form || !token || !tournament) return;
    setBusy(true); setDialogError(null); setNotice(null);
    try {
      const teamAId = Number(form.teamAId), teamBId = Number(form.teamBId), week = Number(form.week);
      if (!teamAId || !teamBId || teamAId === teamBId) throw new Error("Choose two different teams.");
      if (form.type === "ROUNDROBIN" && (!Number.isInteger(week) || week < 1)) throw new Error("Choose a valid week number.");
      if (form.type === "ROUNDROBIN" && divisions.length && (!form.divisionId || teamsById.get(teamAId)?.divisionId !== teamsById.get(teamBId)?.divisionId)) throw new Error("Both teams must belong to the selected division.");
      const startDate = form.startDate ? new Date(form.startDate).toISOString() : null;
      const scheduling = { semanas: form.type === "ROUNDROBIN" ? week : null, startDate, title: form.title.trim() };
      if (form.id) {
        await adminUpdateMatch(token, form.id, form.locked ? scheduling : { ...scheduling, teamAId, teamBId, bestOf: Number(form.bestOf), type: form.type });
      } else {
        await adminCreateMatch(token, { ...scheduling, tournamentId: tournament.id, teamAId, teamBId, type: form.type, bestOf: Number(form.bestOf) });
      }
      await refresh(token, true); setForm(null);
      setNotice(form.id ? "Match updated. The public schedule is up to date." : "Match created with its draft table. The public schedule and stream overlays use this fixture.");
    } catch (reason) { setDialogError(reason instanceof Error ? reason.message : "Unable to save this match."); }
    finally { setBusy(false); }
  }

  async function generateSchedule() {
    if (!token || !tournament) return;
    setBusy(true); setDialogError(null);
    try {
      const generated = await adminGenerateRoundRobin(token, { tournamentId: tournament.id, confirmationText: "CONFIRM ROUND ROBIN" });
      await refresh(token, true); setGenerateOpen(false);
      setNotice(`${generated.length} best-of-5 fixtures generated. Each week contains matches for both divisions; add broadcast dates next.`);
    } catch (reason) { setDialogError(reason instanceof Error ? reason.message : "Unable to generate the schedule."); }
    finally { setBusy(false); }
  }

  async function copyStreamUrl(route: string, matchId: number) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${streamPath(route, matchId)}`);
      setNotice("Overlay URL copied. Add it as a Browser Source in OBS.");
    } catch { setDialogError("Could not copy automatically. Open the overlay and copy its address."); }
  }

  return <main>
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-border-subtle pb-5"><div><p className="font-mono text-[0.66rem] uppercase tracking-[0.3em] text-accent">Season operations</p><h1 className="mt-1 font-otp text-6xl uppercase leading-[0.9]">Schedule & results</h1><p className="mt-3 text-sm text-muted">{tournament?.name || "Weekly fixtures"} · One shared week, a separate schedule for every division.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => token && void refresh(token).catch(() => undefined)} disabled={!ready || loading}><RefreshCw size={14} /> Refresh</Button><Button onClick={() => openMatch()} disabled={!ready || !canCreateWeeklyMatch}><Plus size={16} /> Create match</Button></div></header>
    <OperationMessage error={error} notice={notice} />
    {!ready || loading ? <p className="py-8 text-sm text-muted">Loading weekly schedule…</p> : !tournament ? <NoActiveSeason /> : <>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">{[{ label: "Scheduled", value: matches.filter((match) => match.status === "SCHEDULED").length }, { label: "Live", value: matches.filter((match) => match.status === "ACTIVE").length }, { label: "Results", value: matches.filter((match) => match.status === "FINISHED").length }].map((stat) => <div key={stat.label} className="rounded-sm border border-border bg-surface-1 px-5 py-4"><p className="text-xs uppercase tracking-wider text-muted">{stat.label}</p><p className="mt-1 font-display text-3xl">{stat.value}</p></div>)}</div>
      {!regularMatches.length && ["SCHEDULED", "ROUNDROBIN"].includes(tournament.state) && <section className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-sm border border-accent/30 bg-surface-1 p-5"><div><h2 className="font-medium">Generate the full regular season</h2><p className="mt-1 max-w-xl text-xs leading-6 text-muted">Weekly fixtures stay within each division. Each team plays at most once per week, and every match has a draft table.</p></div><Button onClick={() => { setDialogError(null); setGenerateOpen(true); }} disabled={teams.length < 2}><ListChecks size={16} /> Generate schedule</Button></section>}
      <div className="mb-7 grid gap-3 sm:grid-cols-3"><Select label="Stage" value={stage} options={[{ value: "ROUNDROBIN", label: "Regular season" }, { value: "PLAYOFFS", label: "Playoffs" }, { value: "", label: "All stages" }]} onChange={(event) => { setStage(event.target.value); setWeekFilter(""); }} /><Select label="Division / league" value={divisionFilter} options={[{ value: "", label: "All divisions" }, ...divisions.map((division) => ({ value: String(division.id), label: division.name }))]} onChange={(event) => setDivisionFilter(event.target.value)} /><Select label="Week" disabled={stage !== "ROUNDROBIN"} value={weekFilter} options={[{ value: "", label: "All weeks" }, ...weeks.map((week) => ({ value: String(week), label: `Week ${week}` }))]} onChange={(event) => setWeekFilter(event.target.value)} /></div>
      <div className="space-y-8">{displayedWeeks.map((week) => {
        const weekMatches = filtered.filter((match) => !week || (match.semanas || 1) === week);
        const groups = stage === "ROUNDROBIN" && divisions.length ? divisions.filter((division) => !divisionFilter || String(division.id) === divisionFilter).map((division) => ({ id: division.id, name: division.name, matches: weekMatches.filter((match) => regularSeasonDivision(match, teamsById) === division.id) })) : [{ id: null, name: stage === "PLAYOFFS" ? "Playoffs" : "Fixtures", matches: weekMatches.filter((match) => !divisionFilter || teamsById.get(match.teamAId)?.divisionId === Number(divisionFilter) || teamsById.get(match.teamBId)?.divisionId === Number(divisionFilter)) }];
        return <section key={week}><div className="mb-4 flex items-center gap-2 border-b border-border-subtle pb-3"><CalendarDays size={17} className="text-accent" /><h2 className="font-display text-2xl uppercase">{week ? `Week ${week}` : "Matches"}</h2></div><div className={`grid gap-5 ${groups.length > 1 ? "xl:grid-cols-2" : ""}`}>{groups.map((group) => <section key={group.id ?? "all"} className="min-w-0 rounded-sm border border-border bg-surface-1"><header className="flex items-center justify-between gap-2 border-b border-border bg-surface-inset px-4 py-3"><h3 className="font-display text-xl uppercase">{group.name}</h3>{stage === "ROUNDROBIN" && <Button size="sm" variant="ghost" disabled={!canCreateWeeklyMatch} onClick={() => openMatch(undefined, group.id, week)}><Plus size={13} /> Match</Button>}</header><div className="divide-y divide-border">{group.matches.length ? group.matches.sort((a, b) => (a.startDate || "9999").localeCompare(b.startDate || "9999") || a.id - b.id).map((match) => {
          const a = teamsById.get(match.teamAId), b = teamsById.get(match.teamBId);
          return <article key={match.id} className="p-4"><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted">{match.startDate ? new Date(match.startDate).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Date to be announced"} · BO{match.bestOf}</p><Badge variant={match.status === "ACTIVE" ? "primary" : match.status === "FINISHED" ? "success" : "default"}>{match.status === "ACTIVE" ? "Live" : match.status === "FINISHED" ? "Final" : "Scheduled"}</Badge></div><div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3"><div className="flex min-w-0 flex-col items-center gap-2 text-center"><OperationTeamLogo team={a} /><span className="text-sm font-medium">{a?.name || `Team #${match.teamAId}`}</span></div><p className="whitespace-nowrap font-mono text-xl text-accent">{match.status === "SCHEDULED" ? "VS" : `${match.mapWinsTeamA} – ${match.mapWinsTeamB}`}</p><div className="flex min-w-0 flex-col items-center gap-2 text-center"><OperationTeamLogo team={b} /><span className="text-sm font-medium">{b?.name || `Team #${match.teamBId}`}</span></div></div><div className="mt-4 flex flex-wrap items-center gap-2"><Link href={`/draft-table/${match.id}`} className="inline-flex items-center gap-1.5 rounded-sm bg-brand-bright px-3 py-1.5 text-xs font-medium text-text-inverse"><ExternalLink size={13} />{match.status === "FINISHED" ? "View result / draft" : "Draft & results"}</Link><Button size="sm" variant="outline" onClick={() => openMatch(match)}><Pencil size={13} /> Edit</Button><Button size="sm" variant="ghost" onClick={() => { setDialogError(null); setStreamKey(null); setStreamLoading(true); setStreamMatch(match); }}><Radio size={13} /> Stream</Button></div>{match.mapResults?.length ? <p className="mt-3 text-xs text-muted">{match.mapResults.map((result) => `Map ${result.gameNumber}: ${result.isDraw ? "Draw" : teamsById.get(result.winnerTeamId || 0)?.name || "Pending"}`).join(" · ")}</p> : null}</article>;
        }) : <p className="p-5 text-sm text-muted">No matches in this division for this week.</p>}</div></section>)}</div></section>;
      })}</div>
      {(!displayedWeeks.length || !filtered.length) && <div className="rounded-sm border border-dashed border-border p-8 text-center"><CalendarDays className="mx-auto mb-3 text-muted" /><p className="text-sm text-muted">No fixtures in this view. Create weekly matches or generate the regular-season schedule.</p></div>}
      <p className="mt-6 text-xs leading-6 text-muted">Times are shown in {Intl.DateTimeFormat().resolvedOptions().timeZone}. Submit map winners from Draft & results; scores and standings update together. <Link className="text-accent underline" href="/schedule">View public schedule</Link> · <Link className="text-accent underline" href="/manager-dashboard">Open live match control</Link></p>
    </>}

    <Modal isOpen={Boolean(form)} onClose={() => { if (!busy) setForm(null); }} title={form?.id ? "Edit match" : "Create weekly match"}>
      {form && <form onSubmit={(event) => void saveMatch(event)} className="space-y-4"><OperationMessage error={dialogError} /><fieldset disabled={busy} className="space-y-4">
        {!form.id && divisions.length > 0 && !regularMatches.length && <p className="rounded-sm border border-accent/30 bg-accent/5 p-3 text-xs leading-6">Complete your team setup first. Creating the first regular-season fixture locks team creation and division assignments. Player and captain assignments remain editable.</p>}
        {form.type === "ROUNDROBIN" && <div className="grid gap-4 sm:grid-cols-2"><Select label="Division / league" disabled={form.locked || !divisions.length} value={form.divisionId} options={divisions.length ? [{ value: "", label: "Select division" }, ...divisions.map((division) => ({ value: String(division.id), label: division.name }))] : [{ value: "", label: "Single pool" }]} onChange={(event) => setForm({ ...form, divisionId: event.target.value, teamAId: "", teamBId: "" })} /><Input label="Week" type="number" min={1} required value={form.week} onChange={(event) => setForm({ ...form, week: event.target.value })} /></div>}
        <div className="grid gap-4 sm:grid-cols-2"><Select label="Team A" disabled={form.locked} value={form.teamAId} options={[{ value: "", label: "Select team" }, ...formTeams.map((team) => ({ value: String(team.id), label: team.name }))]} onChange={(event) => setForm({ ...form, teamAId: event.target.value })} required /><Select label="Team B" disabled={form.locked} value={form.teamBId} options={[{ value: "", label: "Select opponent" }, ...formTeams.filter((team) => String(team.id) !== form.teamAId).map((team) => ({ value: String(team.id), label: team.name }))]} onChange={(event) => setForm({ ...form, teamBId: event.target.value })} required /></div>
        {form.locked && <p className="text-xs text-muted">The match is underway or complete. Teams and format are fixed; dates and labels remain editable.</p>}
        <div className="grid gap-4 sm:grid-cols-2"><Input label="Broadcast date & time" type="datetime-local" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /><Select label="Format" disabled={form.locked} value={form.bestOf} options={[{ value: "3", label: "Best of 3" }, { value: "5", label: "Best of 5" }, { value: "7", label: "Best of 7" }]} onChange={(event) => setForm({ ...form, bestOf: event.target.value })} /></div>
        <Input label="Match title (optional)" placeholder={`Week ${form.week}`} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /><p className="text-xs text-muted">Leave the date empty to announce it later. Your timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}.</p>
      </fieldset><div className="flex justify-end gap-2 border-t border-border pt-4"><Button type="button" variant="ghost" disabled={busy} onClick={() => setForm(null)}>Cancel</Button><Button type="submit" isLoading={busy}><Save size={15} /> Save match</Button></div></form>}
    </Modal>
    <Modal isOpen={generateOpen} onClose={() => { if (!busy) setGenerateOpen(false); }} title="Generate weekly schedule"><OperationMessage error={dialogError} /><p className="text-sm leading-7 text-muted">Create all best-of-5 round-robin fixtures for {tournament?.name}. Teams play within their division, once per week. This requires at least two teams in every division and a division assignment for every team.</p><p className="mt-3 text-xs text-muted">Already created fixtures prevent regeneration. You can edit broadcast dates individually afterwards.</p><div className="mt-5 flex justify-end gap-3"><Button variant="ghost" disabled={busy} onClick={() => setGenerateOpen(false)}>Cancel</Button><Button isLoading={busy} onClick={() => void generateSchedule()}>Generate fixtures</Button></div></Modal>
    <Modal isOpen={Boolean(streamMatch)} onClose={() => setStreamMatch(null)} title="Stream sources" className="max-w-2xl">{streamMatch && <><OperationMessage error={dialogError} notice={notice} /><p className="mb-4 text-sm text-muted">{matchupName(streamMatch)} · Add these URLs as Browser Sources in OBS, at 1920 × 1080 for full-canvas overlays.</p>{streamLoading && <p className="mb-3 text-xs text-muted">Preparing authenticated broadcast sources…</p>}<div className="max-h-[60vh] space-y-2 overflow-y-auto">{overlayRoutes.map((overlay) => <div key={overlay.route} className="flex items-center justify-between gap-3 rounded-sm border border-border p-3"><span className="text-sm">{overlay.label}</span><div className="flex gap-2">{streamLoading || (overlay.route === "casting" && !streamKey) ? <span aria-disabled="true" className="p-2 text-muted"><ExternalLink size={15} /></span> : <Link href={streamPath(overlay.route, streamMatch.id)} target="_blank" rel="noreferrer" aria-label={`Open ${overlay.label}`} className="p-2 text-accent"><ExternalLink size={15} /></Link>}<Button size="sm" variant="outline" disabled={streamLoading || (overlay.route === "casting" && !streamKey)} onClick={() => void copyStreamUrl(overlay.route, streamMatch.id)}><Copy size={13} /> Copy</Button></div></div>)}</div><Link href={`/draft-table/${streamMatch.id}`} className="mt-5 inline-flex items-center gap-2 text-sm text-accent underline">Open draft table & match results <ExternalLink size={14} /></Link></>}</Modal>
  </main>;
}
