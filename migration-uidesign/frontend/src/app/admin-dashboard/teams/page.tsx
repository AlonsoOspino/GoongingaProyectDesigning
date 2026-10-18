"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { Crown, ImagePlus, Pencil, Plus, Save, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { useSeasonOperations } from "@/components/admin/useSeasonOperations";
import { NoActiveSeason, OperationMessage, OperationTeamLogo } from "@/components/admin/SeasonOperationUi";
import { adminCreateTeam, adminUpdateTeam, adminUploadTeamImage, type TeamImageCategory } from "@/lib/api/admin";
import { updateSeasonRosterMember, type SeasonRole } from "@/lib/api/seasonRoster";
import { resolveGenericBackendAsset } from "@/lib/assetUrls";
import type { Team } from "@/lib/api/types";

interface TeamForm {
  id: number | null;
  name: string;
  divisionId: string;
  logo: string;
  roster: string;
  bannerLeft: string;
  bannerRight: string;
  discordRoleId: string;
}
const emptyTeam = (): TeamForm => ({ id: null, name: "", divisionId: "", logo: "", roster: "", bannerLeft: "", bannerRight: "", discordRoleId: "" });
const assetLabels: Record<TeamImageCategory, string> = { logo: "Team logo", roster: "Roster artwork", bannerLeft: "Left banner", bannerRight: "Right banner" };

export default function SeasonTeamsPage() {
  const { token, ready, loading, error, setError, tournament, teams, matches, roster, refresh } = useSeasonOperations("/admin-dashboard/teams", true);
  const [form, setForm] = useState<TeamForm | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [divisionFilter, setDivisionFilter] = useState("");
  const [memberId, setMemberId] = useState("");
  const [memberRole, setMemberRole] = useState<SeasonRole>("PLAYER");
  const divisions = tournament?.divisions ?? [];
  const divisionsLocked = matches.some((match) => match.type === "ROUNDROBIN");
  const teamCreationLocked = divisions.length > 0 && divisionsLocked;
  const visibleTeams = teams.filter((team) => !divisionFilter || String(team.divisionId) === divisionFilter);
  const availableMembers = useMemo(() => {
    if (!roster) return [];
    const assigned = roster.assigned.map((player) => ({ ...player.member, teamId: player.teamId }));
    return [...assigned, ...roster.unassigned.map((member) => ({ ...member, teamId: null }))]
      .sort((a, b) => (a.nickname || a.username).localeCompare(b.nickname || b.username));
  }, [roster]);

  function openTeam(team?: Team) {
    setDialogError(null); setMemberId(""); setMemberRole("PLAYER");
    setForm(team ? { id: team.id, name: team.name, divisionId: team.divisionId == null ? "" : String(team.divisionId), logo: team.logo || "", roster: team.roster || "", bannerLeft: team.bannerLeft || "", bannerRight: team.bannerRight || "", discordRoleId: team.discordRoleId || "" } : emptyTeam());
  }

  async function uploadImage(category: TeamImageCategory, file?: File) {
    if (!file || !token) return;
    setBusy(category); setDialogError(null);
    try {
      if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) throw new Error("Choose a PNG, JPG, WebP or GIF image.");
      if (file.size > 5 * 1024 * 1024) throw new Error("Images must be 5 MB or smaller.");
      const result = await adminUploadTeamImage(token, file, category);
      setForm((current) => current ? { ...current, [category]: result.imageUrl } : current);
    } catch (reason) {
      setDialogError(reason instanceof Error ? reason.message : "Unable to upload this image.");
    } finally { setBusy(null); }
  }

  async function saveTeam(event: FormEvent) {
    event.preventDefault();
    if (!token || !tournament || !form) return;
    setBusy("team"); setDialogError(null); setNotice(null);
    try {
      if (!form.name.trim()) throw new Error("Enter a team name.");
      const { id, divisionId, ...fields } = form;
      const payload = { ...fields, name: form.name.trim(), divisionId: divisionId ? Number(divisionId) : null, logo: fields.logo.trim() || null, roster: fields.roster.trim() || null, bannerLeft: fields.bannerLeft.trim() || null, bannerRight: fields.bannerRight.trim() || null, discordRoleId: fields.discordRoleId.trim() || null };
      if (id) await adminUpdateTeam(token, id, payload);
      else await adminCreateTeam(token, { ...payload, tournamentId: tournament.id });
      await refresh(token, true);
      setForm(null); setNotice(`${form.name.trim()} saved. Its images are available to the schedule and stream overlays.`);
    } catch (reason) { setDialogError(reason instanceof Error ? reason.message : "Unable to save this team."); }
    finally { setBusy(null); }
  }

  async function assignMember(targetMemberId: number, teamId: number | null, role: SeasonRole) {
    if (!token || !tournament) return;
    setBusy("member"); setDialogError(null); setError(null);
    try {
      const result = await updateSeasonRosterMember(token, tournament.id, targetMemberId, { teamId, role });
      await refresh(token, true); setMemberId("");
      setNotice(result.demoted ? `${result.demoted.username} is now a player. The new captain has draft access.` : "Season roster saved. Captain permissions and draft access are up to date.");
    } catch (reason) { setDialogError(reason instanceof Error ? reason.message : "Unable to assign this member."); }
    finally { setBusy(null); }
  }

  return <main>
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-border-subtle pb-5">
      <div><p className="font-mono text-[0.66rem] uppercase tracking-[0.3em] text-accent">Season operations</p><h1 className="mt-1 font-otp text-6xl uppercase leading-[0.9]">Teams & captains</h1><p className="mt-3 text-sm text-muted">{tournament?.name || "Team setup"} · Logos, rosters and both stream banners in one place.</p></div>
      <Button onClick={() => openTeam()} disabled={!ready || !tournament || tournament.state === "FINISHED" || teamCreationLocked}><Plus size={16} /> Create team</Button>
    </header>
    <OperationMessage error={error} notice={notice} />
    {!ready || loading ? <p className="py-8 text-sm text-muted">Loading season teams…</p> : !tournament ? <NoActiveSeason /> : <>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[{ label: "Teams", value: teams.length }, { label: "Assigned players", value: roster?.assigned.filter((player) => player.teamId != null).length || 0 }, { label: "Captains", value: roster?.assigned.filter((player) => player.role === "CAPTAIN" && player.teamId != null).length || 0 }].map((stat) => <div key={stat.label} className="rounded-sm border border-border bg-surface-1 px-5 py-4"><p className="text-xs uppercase tracking-wider text-muted">{stat.label}</p><p className="mt-1 font-display text-3xl">{stat.value}</p></div>)}
      </div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><div className="w-full sm:w-64"><Select aria-label="Filter teams by division" value={divisionFilter} options={[{ value: "", label: "All divisions" }, ...divisions.map((division) => ({ value: String(division.id), label: division.name }))]} onChange={(event) => setDivisionFilter(event.target.value)} /></div><Link href="/admin-dashboard/schedule" className="text-sm text-accent underline underline-offset-4">Next: weekly schedule →</Link></div>
      {teamCreationLocked && <p className="mb-5 text-xs leading-6 text-muted">Team creation and division assignments are locked while regular-season fixtures exist. You can continue updating artwork, players and captains.</p>}
      {!teams.length && <div className="rounded-sm border border-dashed border-border p-10 text-center"><Users className="mx-auto mb-3 text-muted" /><h2 className="text-xl">Build your first team</h2><p className="mt-2 text-sm text-muted">Add a name and division, upload its artwork, then assign players and a captain.</p><Button className="mt-5" onClick={() => openTeam()}>Create team</Button></div>}
      <div className="grid gap-5 md:grid-cols-2">
        {visibleTeams.map((team) => {
          const players = roster?.assigned.filter((player) => player.teamId === team.id) || [];
          const captain = players.find((player) => player.role === "CAPTAIN");
          const missing = (Object.keys(assetLabels) as TeamImageCategory[]).filter((category) => !team[category]);
          return <article key={team.id} className="overflow-hidden rounded-sm border border-border bg-surface-1">
            <div className="relative flex min-h-20 items-center overflow-hidden border-b border-border bg-surface-inset">
              {team.bannerLeft && <img src={resolveGenericBackendAsset(team.bannerLeft)} alt={`${team.name} left banner`} className="h-20 w-1/2 object-contain" />}
              {team.bannerRight && <img src={resolveGenericBackendAsset(team.bannerRight)} alt={`${team.name} right banner`} className="ml-auto h-20 w-1/2 object-contain" />}
              {!team.bannerLeft && !team.bannerRight && <span className="px-5 text-xs uppercase tracking-widest text-muted">Stream banners</span>}
            </div>
            <div className="p-5"><div className="flex items-center gap-3"><OperationTeamLogo team={team} size="lg" /><div className="min-w-0 flex-1"><p className="text-xs text-accent">{team.divisionName || divisions.find((division) => division.id === team.divisionId)?.name || "No division assigned"}</p><h2 className="truncate font-display text-2xl uppercase">{team.name}</h2></div><Button size="sm" variant="outline" onClick={() => openTeam(team)}><Pencil size={14} /> Edit</Button></div>
              <p className="mt-4 flex items-center gap-2 text-sm"><Crown size={15} className={captain ? "text-accent" : "text-muted"} />{captain ? captain.member.nickname || captain.member.username : "Assign a captain"}</p>
              <p className="mt-2 text-xs leading-5 text-muted">{players.length ? players.map((player) => player.member.nickname || player.member.username).join(" · ") : "No players assigned yet"}</p>
              <p className={`mt-4 border-t border-border pt-3 text-xs ${missing.length ? "text-muted" : "text-accent"}`}>{missing.length ? `Artwork pending: ${missing.map((category) => assetLabels[category].toLowerCase()).join(", ")}` : "All stream artwork ready"}</p>
            </div>
          </article>;
        })}
      </div>
      <p className="mt-6 text-xs leading-6 text-muted">Assign any active Network Member to the season. <Link href="/admin-dashboard" className="text-accent underline">Manage Network Members</Link> or <Link href="/admin-dashboard/roster" className="text-accent underline">open the full season roster</Link>.</p>
    </>}

    <Modal isOpen={Boolean(form)} onClose={() => { if (!busy) setForm(null); }} title={form?.id ? `Edit ${form.name}` : "Create team"} className="max-w-3xl">
      {form && <div className="max-h-[75vh] overflow-y-auto pr-1">
        <OperationMessage error={dialogError} />
        <form onSubmit={(event) => void saveTeam(event)} className="space-y-5">
          <fieldset disabled={busy !== null} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2"><Input label="Team name" value={form.name} maxLength={80} required onChange={(event) => setForm({ ...form, name: event.target.value })} /><Select label="League / division" value={form.divisionId} disabled={Boolean(form.id) && divisionsLocked} options={[{ value: "", label: "Select division" }, ...divisions.map((division) => ({ value: String(division.id), label: division.name }))]} onChange={(event) => setForm({ ...form, divisionId: event.target.value })} /></div>
            {divisionsLocked && form.id && <p className="text-xs text-muted">Divisions are fixed once regular-season fixtures exist. Team artwork and roster remain editable.</p>}
            <div className="grid gap-4 sm:grid-cols-2">{(Object.keys(assetLabels) as TeamImageCategory[]).map((category) => <div key={category} className="rounded-sm border border-border bg-surface-inset p-3">
              <p className="mb-2 text-sm font-medium">{assetLabels[category]}</p>
              <div className={`mb-3 flex items-center justify-center overflow-hidden rounded-sm border border-dashed border-border bg-surface-1 ${category === "logo" ? "h-28" : "aspect-video"}`}>{form[category] ? <img src={resolveGenericBackendAsset(form[category])} alt={`${assetLabels[category]} preview`} className="h-full w-full object-contain" /> : <ImagePlus size={24} className="text-muted" />}</div>
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-accent"><ImagePlus size={14} />{busy === category ? "Uploading…" : "Upload image"}<input aria-label={`Upload ${assetLabels[category].toLowerCase()}`} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={busy !== null} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void uploadImage(category, file); }} /></label>
              <Input aria-label={`${assetLabels[category]} URL`} className="mt-3 text-xs" placeholder="Or paste an image URL" value={form[category]} onChange={(event) => setForm({ ...form, [category]: event.target.value })} />
            </div>)}</div>
            <p className="text-xs text-muted">PNG, JPG, WebP or GIF · Up to 5 MB each. Transparent logos are supported. Save the team to publish uploaded artwork.</p>
            <Input label="Discord role ID (optional)" value={form.discordRoleId} onChange={(event) => setForm({ ...form, discordRoleId: event.target.value })} />
          </fieldset>
          <div className="flex justify-end gap-3 border-t border-border pt-4"><Button type="button" variant="ghost" disabled={busy !== null} onClick={() => setForm(null)}>Close</Button><Button type="submit" isLoading={busy === "team"} disabled={busy !== null}><Save size={15} /> Save team</Button></div>
        </form>
        {form.id && <section className="mt-6 border-t border-border pt-5"><h3 className="flex items-center gap-2 text-lg font-medium"><Users size={18} /> Players & captain</h3><p className="mt-1 text-xs text-muted">Assignments save immediately. Each team has one captain with access to its draft table.</p>
          <div className="mt-4 space-y-2">{roster?.assigned.filter((player) => player.teamId === form.id).map((player) => <div key={player.id} className="flex flex-wrap items-center gap-2 rounded-sm border border-border p-2.5"><span className="min-w-24 flex-1 text-sm">{player.member.nickname || player.member.username}</span><Button size="sm" variant={player.role === "CAPTAIN" ? "secondary" : "outline"} disabled={busy !== null} onClick={() => void assignMember(player.memberId, form.id, player.role === "CAPTAIN" ? "PLAYER" : "CAPTAIN")}><Crown size={13} />{player.role === "CAPTAIN" ? "Captain → player" : "Make captain"}</Button><Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => void assignMember(player.memberId, null, "PLAYER")}>Unassign</Button></div>)}</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_9rem]"><Select label="Add a season member" value={memberId} options={[{ value: "", label: "Select member" }, ...availableMembers.filter((member) => member.teamId !== form.id).map((member) => ({ value: String(member.id), label: `${member.nickname || member.username}${member.teamId ? ` · ${teams.find((team) => team.id === member.teamId)?.name || "another team"}` : ""}` }))]} onChange={(event) => setMemberId(event.target.value)} disabled={busy !== null} /><Select label="Season role" value={memberRole} options={[{ value: "PLAYER", label: "Player" }, { value: "CAPTAIN", label: "Captain" }]} onChange={(event) => setMemberRole(event.target.value as SeasonRole)} disabled={busy !== null} /></div>
          {availableMembers.find((member) => String(member.id) === memberId)?.teamId && <p className="mt-2 text-xs text-warning">This assignment moves the member from their current team.</p>}
          <Button className="mt-3" size="sm" disabled={!memberId || busy !== null} isLoading={busy === "member"} onClick={() => void assignMember(Number(memberId), form.id, memberRole)}>Assign member</Button>
        </section>}
      </div>}
    </Modal>
  </main>;
}
