"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  ExternalLink,
  Minus,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { ImageUploadField } from "@/components/ui/ImageUploadField";
import { getCurrentNetworkMember } from "@/lib/api/networkMember";
import { resetManagerMatch } from "@/lib/api/match";
import { getDraftShareInfo } from "@/lib/api/draft";
import {
  createDevMatch,
  createDevTeam,
  deleteDevMatch,
  deleteDevTeam,
  getDevDraftAppState,
  setDevBans,
  setDevScores,
  setDevCaptains,
  type DevCaptainMember,
  type DevDraftAppState,
} from "@/lib/api/devDraftApp";
import { DEV_MATCH_ID } from "@/lib/matchReference";
import type { HeroRole, Team } from "@/lib/api/types";
import { readNetworkSessionToken } from "@/features/networkSession/storage";
import { deleteBlobImage } from "@/lib/blobUpload";
import { resolveHeroImageUrl, resolveGenericBackendAsset } from "@/lib/assetUrls";
import styles from "./dev-draft-app.module.css";

const HERO_ROLES: Array<"ALL" | HeroRole> = ["ALL", "TANK", "DPS", "SUPPORT"];

const OVERLAYS = [
  { id: "draft", label: "Draft broadcast", path: "/draft-table/999?broadcast=1", compact: false },
  { id: "header", label: "Match header", path: "/overlay/match-header/999", compact: true },
  { id: "header-reversed", label: "Reversed header", path: "/overlay/match-header-reversed/999", compact: true },
  { id: "winner", label: "Winner cards", path: "/overlay/wincards/999", compact: false },
  { id: "hero-bans", label: "Stream hero bans", path: "/overlay/casting/999?view=hero-bans", compact: false },
] as const;

type OverlayId = (typeof OVERLAYS)[number]["id"];
type BanSide = "teamA" | "teamB";

function CaptainSelectors({ members, teamAName, teamBName, captainAId, captainBId, gameNameA, gameNameB, disabled, onChange, onGameNameChange }: {
  members: DevCaptainMember[];
  teamAName: string;
  teamBName: string;
  captainAId: number | null;
  captainBId: number | null;
  gameNameA: string;
  gameNameB: string;
  disabled: boolean;
  onChange: (side: BanSide, id: number | null) => void;
  onGameNameChange: (side: BanSide, value: string) => void;
}) {
  return <div className={styles.teamSelectors}>
    {(["teamA", "teamB"] as BanSide[]).map((side) => <div className={styles.captainFields} key={side}><label>
      <span>{side === "teamA" ? teamAName : teamBName} captain</span>
      <select value={(side === "teamA" ? captainAId : captainBId) ?? ""} disabled={disabled}
        onChange={(event) => onChange(side, Number(event.target.value) || null)}>
        <option value="">Select Network Member</option>
        {members.map((member) => <option key={member.id} value={member.id}
          disabled={member.id === (side === "teamA" ? captainBId : captainAId)}>
          {member.nickname || member.username}{member.nickname && member.nickname !== member.username ? ` (@${member.username})` : ""}
        </option>)}
      </select>
    </label><label><span>Overwatch name (optional)</span><input className={styles.textInput}
      value={side === "teamA" ? gameNameA : gameNameB} disabled={disabled} maxLength={80}
      pattern="[^#]*" title="Use the in-game name without the #BattleTag suffix."
      placeholder="Name shown in Workshop logs" onChange={(event) => onGameNameChange(side, event.target.value)} />
      <small>Identifies this team in Workshop logs.</small></label></div>)}
  </div>;
}

function parseScoreDraft(value: string) {
  if (!/^\d+$/.test(value)) return null;
  const score = Number(value);
  return Number.isInteger(score) && score <= 2147483647 ? score : null;
}

function getTeam(state: DevDraftAppState, side: BanSide) {
  if (!state.match) return null;
  const id = side === "teamA" ? state.match.teamAId : state.match.teamBId;
  return state.teams.find((team) => team.id === id) ?? null;
}

function TeamLogo({ team }: { team: Team | null }) {
  return team?.logo ? (
    <img className={styles.teamLogo} src={resolveGenericBackendAsset(team.logo)} alt="" />
  ) : (
    <span className={styles.teamInitial}>{team?.name?.slice(0, 1) || "?"}</span>
  );
}

function OverlayPreview({ path, label, compact }: { path: string; label: string; compact: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const update = () => setScale(container.clientWidth / 1920);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={`${styles.previewFrame} ${compact ? styles.previewFrameHeader : ""}`} ref={containerRef}>
      <iframe
        src={path}
        title={`${label} preview`}
        style={{ transform: `scale(${scale})` }}
      />
    </div>
  );
}

export function DevDraftApp() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<DevDraftAppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [teamLogo, setTeamLogo] = useState("");
  const [teamAId, setTeamAId] = useState<number | null>(null);
  const [teamBId, setTeamBId] = useState<number | null>(null);
  const [deleteTeamId, setDeleteTeamId] = useState<number | null>(null);
  const [confirmDeleteMatch, setConfirmDeleteMatch] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [banSide, setBanSide] = useState<BanSide>("teamA");
  const [heroRole, setHeroRole] = useState<"ALL" | HeroRole>("ALL");
  const [heroSearch, setHeroSearch] = useState("");
  const [activeOverlay, setActiveOverlay] = useState<OverlayId>("draft");
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [scoreDraft, setScoreDraft] = useState({ teamA: "0", teamB: "0" });
  const [captainAId, setCaptainAId] = useState<number | null>(null);
  const [captainBId, setCaptainBId] = useState<number | null>(null);
  const [gameNameA, setGameNameA] = useState("");
  const [gameNameB, setGameNameB] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [shareKey, setShareKey] = useState("");
  const [shareError, setShareError] = useState<string | null>(null);

  useEffect(() => {
    const sessionToken = readNetworkSessionToken();
    if (!sessionToken) {
      router.replace("/login?next=%2Fdev%2Fdraft-app");
      return;
    }

    let cancelled = false;
    Promise.all([
      getCurrentNetworkMember(sessionToken),
      getDevDraftAppState(sessionToken),
    ])
      .then(([member, loadedState]) => {
        if (cancelled) return;
        if (!member.roles.includes("DEVELOPER")) {
          router.replace("/");
          return;
        }
        setToken(sessionToken);
        setState(loadedState);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "Draft app could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!token || !state?.match || pending) return;
    let active = true;
    const refresh = async () => {
      if (document.hidden) return;
      try {
        const next = await getDevDraftAppState(token);
        if (active) setState(next);
      } catch { /* Keep the last confirmed preview during a temporary disconnect. */ }
    };
    const interval = window.setInterval(() => void refresh(), 5000);
    window.addEventListener("focus", refresh);
    return () => { active = false; window.clearInterval(interval); window.removeEventListener("focus", refresh); };
  }, [token, state?.match?.id, pending]);

  useEffect(() => {
    if (!state || state.match) return;
    const teamIds = new Set(state.teams.map((team) => team.id));
    setTeamAId((current) => (current && teamIds.has(current) ? current : state.teams[0]?.id ?? null));
    setTeamBId((current) => (current && teamIds.has(current) ? current : state.teams[1]?.id ?? null));
  }, [state]);

  useEffect(() => {
    if (!state?.match) return;
    setScoreDraft({
      teamA: String(state.match.mapWinsTeamA),
      teamB: String(state.match.mapWinsTeamB),
    });
  }, [state?.match?.id, state?.match?.mapWinsTeamA, state?.match?.mapWinsTeamB]);

  useEffect(() => {
    setCaptainAId(state?.captains.teamA?.id ?? null);
    setCaptainBId(state?.captains.teamB?.id ?? null);
    setGameNameA(state?.captains.teamA?.gameName ?? "");
    setGameNameB(state?.captains.teamB?.gameName ?? "");
  }, [state?.captains.teamA?.id, state?.captains.teamB?.id, state?.captains.teamA?.gameName, state?.captains.teamB?.gameName, state?.match?.id]);

  useEffect(() => {
    setShareKey("");
    setShareError(null);
    if (!token || !state?.match) return;
    let active = true;
    void getDraftShareInfo(token, state.match.id)
      .then((info) => { if (active) setShareKey(info.key); })
      .catch((failure) => { if (active) setShareError(failure instanceof Error ? failure.message : "Broadcast links could not be loaded."); });
    return () => { active = false; };
  }, [token, state?.match?.id]);

  const selectedOverlay = OVERLAYS.find((overlay) => overlay.id === activeOverlay) ?? OVERLAYS[0];
  const broadcastPath = (path: string) => shareKey ? `${path}${path.includes("?") ? "&" : "?"}key=${encodeURIComponent(shareKey)}` : path;
  const teamA = state ? getTeam(state, "teamA") : null;
  const teamB = state ? getTeam(state, "teamB") : null;
  const usedTeamIds = new Set(state?.match ? [state.match.teamAId, state.match.teamBId] : []);

  const filteredHeroes = useMemo(() => {
    const query = heroSearch.trim().toLowerCase();
    return (state?.heroes ?? []).filter(
      (hero) =>
        (heroRole === "ALL" || hero.role === heroRole) &&
        (!query || hero.name.toLowerCase().includes(query))
    );
  }, [heroRole, heroSearch, state?.heroes]);

  async function handleCreateTeam(event: FormEvent) {
    event.preventDefault();
    if (!token || !teamName.trim() || !teamLogo.trim()) return;
    setPending("create-team");
    setError(null);
    try {
      const next = await createDevTeam(token, { name: teamName.trim(), logo: teamLogo.trim() });
      setState(next);
      setTeamName("");
      setTeamLogo("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Team could not be created.");
    } finally {
      setPending(null);
    }
  }

  async function handleDeleteTeam(team: Team) {
    if (!token) return;
    setPending(`delete-team-${team.id}`);
    setError(null);
    try {
      const next = await deleteDevTeam(token, team.id);
      setState(next);
      setDeleteTeamId(null);
      try {
        await deleteBlobImage(team.logo);
      } catch (uploadError) {
        setError(uploadError instanceof Error ? uploadError.message : "The team was deleted, but its upload could not be removed.");
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Team could not be deleted.");
    } finally {
      setPending(null);
    }
  }

  async function handleCreateMatch() {
    if (!token || !state?.maps.length || !teamAId || !teamBId || teamAId === teamBId || !captainAId || !captainBId || captainAId === captainBId) return;
    setPending("create-match");
    setError(null);
    try {
      const next = await createDevMatch(token, {
        teamAId,
        teamBId,
        mapIds: state.maps.map((map) => map.id),
        teamACaptainId: captainAId,
        teamBCaptainId: captainBId,
        teamAGameName: gameNameA.trim() || null,
        teamBGameName: gameNameB.trim() || null,
      });
      setState(next);
      setConfirmDeleteMatch(false);
      setNotice("Match 999 created. Both captains can open their draft table with their own Discord accounts.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Developer match could not be created.");
    } finally {
      setPending(null);
    }
  }

  async function handleSaveCaptains(event: FormEvent) {
    event.preventDefault();
    if (!token || !captainAId || !captainBId || captainAId === captainBId) return;
    setPending("captains");
    setError(null);
    setNotice(null);
    try {
      setState(await setDevCaptains(token, { teamACaptainId: captainAId, teamBCaptainId: captainBId,
        teamAGameName: gameNameA.trim() || null, teamBGameName: gameNameB.trim() || null }));
      setNotice("Captains assigned to match 999. Each member can mark ready, pick and ban for their own team.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Captains could not be assigned.");
    } finally { setPending(null); }
  }

  function changeCaptain(side: BanSide, id: number | null) {
    if (side === "teamA") { setCaptainAId(id); setGameNameA(""); }
    else { setCaptainBId(id); setGameNameB(""); }
    setNotice(null);
  }

  function changeGameName(side: BanSide, value: string) {
    if (side === "teamA") setGameNameA(value);
    else setGameNameB(value);
    setNotice(null);
  }

  async function handleDeleteMatch() {
    if (!token) return;
    setPending("delete-match");
    setError(null);
    try {
      const next = await deleteDevMatch(token);
      setState(next);
      setConfirmDeleteMatch(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Developer match could not be deleted.");
    } finally {
      setPending(null);
    }
  }

  async function handleRestartDraft() {
    if (!token || !state?.match) return;
    setPending("restart");
    setError(null);
    try {
      await resetManagerMatch(token, state.match.id);
      setState(await getDevDraftAppState(token));
      setConfirmRestart(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The practice draft could not be restarted.");
    } finally { setPending(null); }
  }

  function adjustScore(side: BanSide, delta: number) {
    setScoreDraft((current) => {
      const score = parseScoreDraft(current[side]) ?? 0;
      const next = Math.max(0, score + delta);
      return { ...current, [side]: String(Number.isSafeInteger(next) ? next : score) };
    });
  }

  async function handleSaveScores(event: FormEvent) {
    event.preventDefault();
    const mapWinsTeamA = parseScoreDraft(scoreDraft.teamA);
    const mapWinsTeamB = parseScoreDraft(scoreDraft.teamB);
    if (!token || !state?.match || mapWinsTeamA === null || mapWinsTeamB === null) return;
    setPending("scores");
    setError(null);
    try {
      setState(await setDevScores(token, { mapWinsTeamA, mapWinsTeamB }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Header scores could not be saved.");
    } finally {
      setPending(null);
    }
  }

  async function commitBans(side: BanSide, nextIds: number[]) {
    if (!token || !state) return;
    const payload = {
      teamABans: side === "teamA" ? nextIds : state.bans.teamA,
      teamBBans: side === "teamB" ? nextIds : state.bans.teamB,
    };
    setPending("bans");
    setError(null);
    try {
      setState(await setDevBans(token, payload));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Hero bans could not be updated.");
    } finally {
      setPending(null);
    }
  }

  async function toggleHeroBan(heroId: number) {
    if (!state) return;
    const current = state.bans[banSide];
    if (current.includes(heroId)) {
      await commitBans(banSide, current.filter((id) => id !== heroId));
      return;
    }
    if (current.length >= 2) return;
    await commitBans(banSide, [...current, heroId]);
  }

  async function copyOverlay(path: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopiedPath(path);
      window.setTimeout(() => setCopiedPath((current) => (current === path ? null : current)), 1600);
    } catch {
      setError("Clipboard access is unavailable in this browser.");
    }
  }

  if (loading) {
    return <main className={styles.centerState}>Loading draft app…</main>;
  }

  if (!state || !token) {
    return (
      <main className={styles.centerState}>
        <p>{error || "Developer access is required."}</p>
        <button type="button" className={styles.secondaryButton} onClick={() => window.location.reload()}>
          Retry
        </button>
      </main>
    );
  }

  const allBanIds = [...state.bans.teamA, ...state.bans.teamB];
  const roleCounts = allBanIds.reduce<Record<HeroRole, number>>(
    (counts, id) => {
      const role = state.heroes.find((hero) => hero.id === id)?.role;
      if (role) counts[role] += 1;
      return counts;
    },
    { TANK: 0, DPS: 0, SUPPORT: 0 }
  );
  const scoreA = parseScoreDraft(scoreDraft.teamA);
  const scoreB = parseScoreDraft(scoreDraft.teamB);
  const scoresChanged = Boolean(
    state.match && (scoreA !== state.match.mapWinsTeamA || scoreB !== state.match.mapWinsTeamB)
  );

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1>Developer / Match 999</h1>
          <p>Two captains, the full match flow and live stream previews</p>
        </div>
        <span className={styles.status} data-active={state.match ? "true" : "false"}>
          {state.match ? "Dev match ready" : "No dev match"}
        </span>
      </header>

      {error ? (
        <div className={styles.alert} role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss error">
            <X size={16} aria-hidden />
          </button>
        </div>
      ) : null}
      {notice && <p role="status" className={styles.notice}>{notice}</p>}

      <section className={styles.labGuide} aria-label="Draft animation walkthrough">
        <div>
          <h2>Test the full match with two captains</h2>
          <p>Assign two Network Members. Each signs in with Discord and opens /draft-table/999 to mark ready, pick maps and ban heroes. The operator manages phases, pauses and results; the casting table prepares OBS scenes.</p>
          <p className={styles.labNote}>This shared practice match is separate from the season schedule. Other developers see the same test state. The score and ban controls below change overlay previews; restarting clears those overrides.</p>
        </div>
        {state.match && <a className={styles.primaryButton} href="/draft-table/999" target="_blank" rel="noreferrer"><ExternalLink size={16} aria-hidden /> Open match 999</a>}
      </section>

      <div className={styles.workspace}>
        <aside className={styles.teamPanel}>
          <div className={styles.sectionHead}>
            <div>
              <h2>Team pool</h2>
              <p>{state.teams.length} saved</p>
            </div>
          </div>

          <form className={styles.teamForm} onSubmit={handleCreateTeam}>
            <label className={styles.fieldLabel} htmlFor="dev-team-name">Team name</label>
            <input
              id="dev-team-name"
              className={styles.textInput}
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
              placeholder="Team name"
              maxLength={60}
              required
            />
            <ImageUploadField
              label="Team logo"
              value={teamLogo}
              onChange={setTeamLogo}
              type="logo"
              previewAlt="Team logo preview"
              placeholder="Logo URL or upload"
            />
            <button
              type="submit"
              className={styles.primaryButton}
              disabled={pending !== null || !teamName.trim() || !teamLogo.trim()}
            >
              <Plus size={16} aria-hidden />
              {pending === "create-team" ? "Creating…" : "Create team"}
            </button>
          </form>

          <div className={styles.teamList}>
            {state.teams.length === 0 ? (
              <p className={styles.emptyState}>Create two teams to build the dev match.</p>
            ) : (
              state.teams.map((team) => {
                const isUsed = usedTeamIds.has(team.id);
                const confirming = deleteTeamId === team.id;
                return (
                  <div className={styles.teamRow} key={team.id}>
                    <div className={styles.teamIdentity}>
                      <TeamLogo team={team} />
                      <div>
                        <strong>{team.name}</strong>
                        <span>{isUsed ? "In current match" : "Available"}</span>
                      </div>
                    </div>
                    {confirming ? (
                      <div className={styles.inlineConfirm}>
                        <button type="button" onClick={() => setDeleteTeamId(null)}>Cancel</button>
                        <button
                          type="button"
                          className={styles.dangerText}
                          onClick={() => void handleDeleteTeam(team)}
                          disabled={pending !== null}
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={styles.iconButton}
                        onClick={() => setDeleteTeamId(team.id)}
                        disabled={isUsed || pending !== null}
                        aria-label={`Delete ${team.name}`}
                        title={isUsed ? "Delete the dev match first" : `Delete ${team.name}`}
                      >
                        <Trash2 size={16} aria-hidden />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </aside>

        <section className={styles.mainPanel}>
          {!state.match ? (
            <div className={styles.matchBuilder}>
              <div className={styles.sectionHead}>
                <div>
                  <h2>Create match {DEV_MATCH_ID}</h2>
                  <p>Select two teams and their captains. Each round uses the full map catalog for its mode.</p>
                </div>
              </div>

              <div className={styles.teamSelectors}>
                <label>
                  <span>Team A</span>
                  <select value={teamAId ?? ""} onChange={(event) => setTeamAId(Number(event.target.value) || null)}>
                    <option value="">Select team</option>
                    {state.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                  </select>
                </label>
                <span className={styles.versus}>VS</span>
                <label>
                  <span>Team B</span>
                  <select value={teamBId ?? ""} onChange={(event) => setTeamBId(Number(event.target.value) || null)}>
                    <option value="">Select team</option>
                    {state.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                  </select>
                </label>
              </div>

              <CaptainSelectors members={state.members} teamAName="Team A" teamBName="Team B"
                captainAId={captainAId} captainBId={captainBId} gameNameA={gameNameA} gameNameB={gameNameB}
                disabled={pending !== null} onChange={changeCaptain} onGameNameChange={changeGameName} />
              {!state.members.length && <p className={styles.labNote}>Members must sign in with Discord before they can be selected as test captains.</p>}

              <div className={styles.builderFooter}>
                <span>{state.maps.length} maps in the catalog</span>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => void handleCreateMatch()}
                  disabled={
                    pending !== null ||
                    !teamAId ||
                    !teamBId ||
                    teamAId === teamBId ||
                    !captainAId || !captainBId || captainAId === captainBId ||
                    state.maps.length === 0
                  }
                >
                  {pending === "create-match" ? "Creating…" : "Create dev match"}
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.matchWorkspace}>
              <section className={styles.matchStrip}>
                <div className={styles.matchTeam}>
                  <TeamLogo team={teamA} />
                  <strong>{teamA?.name}</strong>
                </div>
                <div className={styles.matchCenter}>
                  <span>Match 999</span>
                  <strong>VS</strong>
                </div>
                <div className={`${styles.matchTeam} ${styles.matchTeamRight}`}>
                  <strong>{teamB?.name}</strong>
                  <TeamLogo team={teamB} />
                </div>
                <div className={styles.matchActions}>
                  {confirmRestart ? <div className={styles.inlineConfirm}>
                    <span>Clear test progress, scores and bans?</span>
                    <button type="button" disabled={pending !== null} onClick={() => setConfirmRestart(false)}>Cancel</button>
                    <button type="button" disabled={pending !== null} className={styles.dangerText} onClick={() => void handleRestartDraft()}>{pending === "restart" ? "Restarting…" : "Restart draft"}</button>
                  </div> : <button type="button" className={styles.secondaryButton} disabled={pending !== null} onClick={() => { setConfirmRestart(true); setConfirmDeleteMatch(false); }}><RotateCcw size={15} aria-hidden /> Restart draft</button>}
                  {confirmDeleteMatch ? (
                    <div className={styles.deleteMatchConfirm}>
                      <span>Delete this match?</span>
                      <button type="button" onClick={() => setConfirmDeleteMatch(false)}>Cancel</button>
                      <button
                        type="button"
                        className={styles.dangerButton}
                        onClick={() => void handleDeleteMatch()}
                        disabled={pending !== null}
                      >
                        {pending === "delete-match" ? "Deleting…" : "Delete match"}
                      </button>
                    </div>
                  ) : (
                      <button type="button" className={styles.iconButton} onClick={() => { setConfirmDeleteMatch(true); setConfirmRestart(false); }} aria-label="Delete dev match" title="Delete dev match">
                      <Trash2 size={17} aria-hidden />
                    </button>
                  )}
                </div>
              </section>

              <form className={styles.controlSection} onSubmit={(event) => void handleSaveCaptains(event)}>
                <div className={styles.sectionHead}><div><h2>Test captains</h2><p>Two distinct Network Members, with access to their own side of match 999.</p></div></div>
                <CaptainSelectors members={state.members} teamAName={teamA?.name || "Team A"} teamBName={teamB?.name || "Team B"}
                  captainAId={captainAId} captainBId={captainBId} gameNameA={gameNameA} gameNameB={gameNameB}
                  disabled={pending !== null} onChange={changeCaptain} onGameNameChange={changeGameName} />
                <div className={styles.captainActions}>
                  <button type="submit" className={styles.primaryButton} disabled={pending !== null || !captainAId || !captainBId || captainAId === captainBId
                    || (captainAId === state.captains.teamA?.id && captainBId === state.captains.teamB?.id
                      && gameNameA.trim() === (state.captains.teamA?.gameName ?? "") && gameNameB.trim() === (state.captains.teamB?.gameName ?? ""))}>{pending === "captains" ? "Saving…" : "Save captains"}</button>
                  <a href="/draft-table/999" target="_blank" rel="noreferrer" className={styles.secondaryButton}><ExternalLink size={15} aria-hidden /> Captain / operator table</a>
                  <button type="button" className={styles.secondaryButton} onClick={() => void copyOverlay("/draft-table/999")}><Copy size={15} aria-hidden />{copiedPath === "/draft-table/999" ? "Captain link copied" : "Copy captain link"}</button>
                  <a href="/casting-table/999" target="_blank" rel="noreferrer" className={styles.secondaryButton}><ExternalLink size={15} aria-hidden /> Casting & OBS</a>
                </div>
                <p className={styles.labNote}>Captain assignments apply to this test match. Restart preserves both assignments and clears the match progress.</p>
              </form>

              <form className={styles.controlSection} onSubmit={(event) => void handleSaveScores(event)}>
                <div className={styles.sectionHead}>
                  <div>
                    <h2>Header scores</h2>
                    <p>Set the map wins shown on both match headers.</p>
                  </div>
                  <span className={styles.saveState}>{pending === "scores" ? "Saving…" : "Live"}</span>
                </div>
                <div className={styles.scoreControls}>
                  {(["teamA", "teamB"] as BanSide[]).map((side) => {
                    const team = side === "teamA" ? teamA : teamB;
                    return (
                      <div className={styles.scoreField} key={side}>
                        <label htmlFor={`dev-score-${side}`}>{team?.name || (side === "teamA" ? "Team A" : "Team B")}</label>
                        <div className={styles.scoreStepper}>
                          <button
                            type="button"
                            onClick={() => adjustScore(side, -1)}
                            disabled={pending !== null || (parseScoreDraft(scoreDraft[side]) ?? 0) <= 0}
                            aria-label={`Decrease ${team?.name || side} score`}
                          ><Minus size={16} aria-hidden /></button>
                          <input
                            id={`dev-score-${side}`}
                            type="number"
                            inputMode="numeric"
                            min="0"
                            max="2147483647"
                            step="1"
                            value={scoreDraft[side]}
                            onChange={(event) => setScoreDraft((current) => ({ ...current, [side]: event.target.value }))}
                            disabled={pending !== null}
                          />
                          <button
                            type="button"
                            onClick={() => adjustScore(side, 1)}
                            disabled={pending !== null || (parseScoreDraft(scoreDraft[side]) ?? 0) >= 2147483647}
                            aria-label={`Increase ${team?.name || side} score`}
                          ><Plus size={16} aria-hidden /></button>
                        </div>
                      </div>
                    );
                  })}
                  <button
                    type="submit"
                    className={styles.primaryButton}
                    disabled={pending !== null || scoreA === null || scoreB === null || !scoresChanged}
                  >{pending === "scores" ? "Saving…" : "Save scores"}</button>
                </div>
                {(scoreA === null || scoreB === null) ? (
                  <p className={styles.scoreHint} role="alert">Enter whole numbers from 0 to 2147483647.</p>
                ) : null}
              </form>

              <section className={styles.controlSection}>
                <div className={styles.sectionHead}>
                  <div>
                    <h2>Hero bans</h2>
                    <p>Two per team, with a maximum of two heroes from the same role.</p>
                  </div>
                  <span className={styles.saveState}>{pending === "bans" ? "Saving…" : "Live"}</span>
                </div>

                <div className={styles.banTeams}>
                  {(["teamA", "teamB"] as BanSide[]).map((side) => {
                    const team = side === "teamA" ? teamA : teamB;
                    return (
                      <button
                        type="button"
                        key={side}
                        className={styles.banTeam}
                        data-active={banSide === side ? "true" : "false"}
                        onClick={() => setBanSide(side)}
                      >
                        <TeamLogo team={team} />
                        <span>{team?.name}</span>
                        <strong>{state.bans[side].length}/2</strong>
                      </button>
                    );
                  })}
                </div>

                <div className={styles.banSlots}>
                  {(["teamA", "teamB"] as BanSide[]).map((side) => (
                    <div className={styles.banSlotGroup} key={side}>
                      <span>{side === "teamA" ? teamA?.name : teamB?.name}</span>
                      <div>
                        {[0, 1].map((slot) => {
                          const heroId = state.bans[side][slot];
                          const hero = state.heroes.find((candidate) => candidate.id === heroId);
                          return hero ? (
                            <button
                              type="button"
                              className={styles.filledBanSlot}
                              key={slot}
                              onClick={() => void commitBans(side, state.bans[side].filter((id) => id !== hero.id))}
                              disabled={pending === "bans"}
                              aria-label={`Remove ${hero.name} from ${side === "teamA" ? teamA?.name : teamB?.name}`}
                            >
                              <img src={resolveHeroImageUrl(hero.imgPath)} alt="" />
                              <span>{hero.name}</span>
                              <X size={13} aria-hidden />
                            </button>
                          ) : (
                            <span className={styles.emptyBanSlot} key={slot}>Empty ban</span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className={styles.heroToolbar}>
                  <div className={styles.roleFilters}>
                    {HERO_ROLES.map((role) => (
                      <button
                        type="button"
                        key={role}
                        data-active={heroRole === role ? "true" : "false"}
                        onClick={() => setHeroRole(role)}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                  <input
                    className={styles.heroSearch}
                    type="search"
                    value={heroSearch}
                    onChange={(event) => setHeroSearch(event.target.value)}
                    placeholder="Search hero"
                    aria-label="Search heroes"
                  />
                </div>

                <div className={styles.heroGrid}>
                  {filteredHeroes.map((hero) => {
                    const selectedHere = state.bans[banSide].includes(hero.id);
                    const selectedElsewhere = state.bans[banSide === "teamA" ? "teamB" : "teamA"].includes(hero.id);
                    const atTeamLimit = state.bans[banSide].length >= 2;
                    const atRoleLimit = roleCounts[hero.role] >= 2;
                    const disabled = pending === "bans" || selectedElsewhere || (!selectedHere && (atTeamLimit || atRoleLimit));
                    return (
                      <button
                        type="button"
                        className={styles.heroCard}
                        data-selected={selectedHere ? "true" : "false"}
                        key={hero.id}
                        onClick={() => void toggleHeroBan(hero.id)}
                        disabled={disabled}
                        aria-pressed={selectedHere}
                        title={selectedElsewhere ? "Already banned by the other team" : hero.name}
                      >
                        <img src={resolveHeroImageUrl(hero.imgPath)} alt="" />
                        <span>{hero.name}</span>
                        <small>{hero.role}</small>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className={styles.previewSection}>
                <div className={styles.sectionHead}>
                  <div>
                    <h2>Draft & overlay previews</h2>
                    <p>OBS links include a read-only broadcast key and use a 1920 × 1080 canvas. Captains use the separate captain link above.</p>
                  </div>
                </div>
                {shareError && <p role="alert" className={styles.labNote}>{shareError} Reload this page to retry.</p>}
                <div className={styles.overlayList}>
                  {OVERLAYS.map((overlay) => (
                    <div className={styles.overlayRow} data-active={activeOverlay === overlay.id ? "true" : "false"} key={overlay.id}>
                      <button type="button" className={styles.overlaySelect} onClick={() => setActiveOverlay(overlay.id)}>
                        <strong>{overlay.label}</strong>
                        <span>{overlay.path}</span>
                      </button>
                      <button type="button" className={styles.iconButton} disabled={!shareKey} onClick={() => void copyOverlay(broadcastPath(overlay.path))} aria-label={`Copy ${overlay.label} link`} title={`Copy ${overlay.label} link`}>
                        {copiedPath === broadcastPath(overlay.path) ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
                      </button>
                      <a className={styles.iconButton} href={broadcastPath(overlay.path)} target="_blank" rel="noreferrer" aria-label={`Open ${overlay.label}`} title={`Open ${overlay.label}`}>
                        <ExternalLink size={16} aria-hidden />
                      </a>
                    </div>
                  ))}
                </div>
                <OverlayPreview
                  path={broadcastPath(selectedOverlay.path)}
                  label={selectedOverlay.label}
                  compact={selectedOverlay.compact}
                />
              </section>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
