"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  ExternalLink,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { ImageUploadField } from "@/components/ui/ImageUploadField";
import { MapPoolControl } from "@/components/manager/MapPoolControl";
import { getCurrentNetworkMember } from "@/lib/api/networkMember";
import {
  createDevMatch,
  createDevTeam,
  deleteDevMatch,
  deleteDevTeam,
  getDevDraftAppState,
  setDevBans,
  setDevOverlayFocus,
  type DevDraftAppState,
  type DevOverlayFocusPayload,
} from "@/lib/api/devDraftApp";
import type { HeroRole, MapType, Team } from "@/lib/api/types";
import { readNetworkSessionToken } from "@/features/networkSession/storage";
import { deleteBlobImage } from "@/lib/blobUpload";
import { resolveHeroImageUrl, resolveMapImageUrl, resolveGenericBackendAsset } from "@/lib/assetUrls";
import styles from "./dev-draft-app.module.css";

const MAP_TYPES: MapType[] = ["CONTROL", "HYBRID", "PAYLOAD", "PUSH", "FLASHPOINT"];
const HERO_ROLES: Array<"ALL" | HeroRole> = ["ALL", "TANK", "DPS", "SUPPORT"];

const OVERLAYS = [
  { id: "map-pool", label: "Map pool", path: "/overlay/map-pool/dev" },
  { id: "header", label: "Match header", path: "/overlay/match-header/dev" },
  { id: "header-reversed", label: "Reversed header", path: "/overlay/match-header-reversed/dev" },
] as const;

type OverlayId = (typeof OVERLAYS)[number]["id"];
type BanSide = "teamA" | "teamB";

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
  const [selectedMapIds, setSelectedMapIds] = useState<Set<number>>(new Set());
  const [deleteTeamId, setDeleteTeamId] = useState<number | null>(null);
  const [confirmDeleteMatch, setConfirmDeleteMatch] = useState(false);
  const [banSide, setBanSide] = useState<BanSide>("teamA");
  const [heroRole, setHeroRole] = useState<"ALL" | HeroRole>("ALL");
  const [heroSearch, setHeroSearch] = useState("");
  const [activeOverlay, setActiveOverlay] = useState<OverlayId>("map-pool");
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  useEffect(() => {
    const sessionToken = readNetworkSessionToken();
    if (!sessionToken) {
      router.replace("/login");
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
    if (!state || state.match) return;
    const teamIds = new Set(state.teams.map((team) => team.id));
    setTeamAId((current) => (current && teamIds.has(current) ? current : state.teams[0]?.id ?? null));
    setTeamBId((current) => (current && teamIds.has(current) ? current : state.teams[1]?.id ?? null));
  }, [state]);

  const mapsByType = useMemo(() => {
    const grouped = new Map<MapType, DevDraftAppState["maps"]>();
    for (const type of MAP_TYPES) grouped.set(type, []);
    for (const map of state?.maps ?? []) grouped.get(map.type)?.push(map);
    return grouped;
  }, [state?.maps]);

  const selectedOverlay = OVERLAYS.find((overlay) => overlay.id === activeOverlay) ?? OVERLAYS[0];
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

  function toggleMap(mapId: number) {
    setSelectedMapIds((current) => {
      const next = new Set(current);
      if (next.has(mapId)) next.delete(mapId);
      else next.add(mapId);
      return next;
    });
  }

  async function handleCreateMatch() {
    if (!token || !teamAId || !teamBId || teamAId === teamBId || selectedMapIds.size === 0) return;
    setPending("create-match");
    setError(null);
    try {
      const next = await createDevMatch(token, {
        teamAId,
        teamBId,
        mapIds: [...selectedMapIds],
      });
      setState(next);
      setConfirmDeleteMatch(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Developer match could not be created.");
    } finally {
      setPending(null);
    }
  }

  async function handleDeleteMatch() {
    if (!token) return;
    setPending("delete-match");
    setError(null);
    try {
      const next = await deleteDevMatch(token);
      setState(next);
      setConfirmDeleteMatch(false);
      setSelectedMapIds(new Set());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Developer match could not be deleted.");
    } finally {
      setPending(null);
    }
  }

  const handleOverlayFocus = useCallback(
    async (payload: DevOverlayFocusPayload) => {
      if (!token) throw new Error("Developer session is unavailable.");
      const next = await setDevOverlayFocus(token, payload);
      setState(next);
      return next.match;
    },
    [token]
  );

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

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1>Developer / Draft app</h1>
          <p>Persistent team pool · Match alias /dev</p>
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
                  <h2>Create dev match</h2>
                  <p>Select two teams and the maps available to the overlay.</p>
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

              <div className={styles.mapGroups}>
                {MAP_TYPES.map((type) => (
                  <section className={styles.mapGroup} key={type}>
                    <div className={styles.mapGroupHead}>
                      <h3>{type === "PAYLOAD" ? "ESCORT" : type}</h3>
                      <span>{mapsByType.get(type)?.filter((map) => selectedMapIds.has(map.id)).length ?? 0} selected</span>
                    </div>
                    <div className={styles.mapGrid}>
                      {(mapsByType.get(type) ?? []).map((map) => {
                        const selected = selectedMapIds.has(map.id);
                        return (
                          <button
                            type="button"
                            className={styles.mapCard}
                            data-selected={selected ? "true" : "false"}
                            aria-pressed={selected}
                            key={map.id}
                            onClick={() => toggleMap(map.id)}
                          >
                            <img src={resolveMapImageUrl(map.imgPath)} alt="" />
                            <span>{map.description}</span>
                            {selected ? <Check size={15} aria-hidden /> : null}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>

              <div className={styles.builderFooter}>
                <span>{selectedMapIds.size} maps selected</span>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => void handleCreateMatch()}
                  disabled={
                    pending !== null ||
                    !teamAId ||
                    !teamBId ||
                    teamAId === teamBId ||
                    selectedMapIds.size === 0
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
                  <span>/dev</span>
                  <strong>VS</strong>
                </div>
                <div className={`${styles.matchTeam} ${styles.matchTeamRight}`}>
                  <strong>{teamB?.name}</strong>
                  <TeamLogo team={teamB} />
                </div>
                <div className={styles.matchActions}>
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
                    <button type="button" className={styles.iconButton} onClick={() => setConfirmDeleteMatch(true)} aria-label="Delete dev match" title="Delete dev match">
                      <Trash2 size={17} aria-hidden />
                    </button>
                  )}
                </div>
              </section>

              <section className={styles.controlSection}>
                <div className={styles.sectionHead}>
                  <div>
                    <h2>Map pool control</h2>
                    <p>Focus a map type or a single map on the live overlay.</p>
                  </div>
                </div>
                <MapPoolControl
                  match={state.match}
                  token={token}
                  overlayMatchReference="dev"
                  updateFocus={handleOverlayFocus}
                />
              </section>

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
                    <h2>Overlay previews</h2>
                    <p>All links resolve the persistent developer match.</p>
                  </div>
                </div>
                <div className={styles.overlayList}>
                  {OVERLAYS.map((overlay) => (
                    <div className={styles.overlayRow} data-active={activeOverlay === overlay.id ? "true" : "false"} key={overlay.id}>
                      <button type="button" className={styles.overlaySelect} onClick={() => setActiveOverlay(overlay.id)}>
                        <strong>{overlay.label}</strong>
                        <span>{overlay.path}</span>
                      </button>
                      <button type="button" className={styles.iconButton} onClick={() => void copyOverlay(overlay.path)} aria-label={`Copy ${overlay.label} link`} title={`Copy ${overlay.label} link`}>
                        {copiedPath === overlay.path ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
                      </button>
                      <a className={styles.iconButton} href={overlay.path} target="_blank" rel="noreferrer" aria-label={`Open ${overlay.label}`} title={`Open ${overlay.label}`}>
                        <ExternalLink size={16} aria-hidden />
                      </a>
                    </div>
                  ))}
                </div>
                <OverlayPreview
                  path={selectedOverlay.path}
                  label={selectedOverlay.label}
                  compact={selectedOverlay.id !== "map-pool"}
                />
              </section>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
