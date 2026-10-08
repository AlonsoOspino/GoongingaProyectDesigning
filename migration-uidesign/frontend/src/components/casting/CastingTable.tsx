"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ExternalLink, FolderOpen, Monitor, Radio, Settings, X } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { readNetworkSessionToken, readNetworkSessionUser, type NetworkSessionUser } from "@/features/networkSession/storage";
import { apiRequest, getDraftByMatchId, getDraftShareInfo, getTeams, startMapPicking, startBan, endGame, submitMatchResult, managerSetOverlayFocus, getMemberProfileById, type DraftState, type Team, type MapType } from "@/lib/api";
import { resolveMapImageUrl } from "@/lib/assetUrls";
import { BROADCAST_VIEWS, automaticView, belongsToCurrentMap, canCast, currentMapNumber, heroVideo, loadHeroVideos, mapPoolIds, type BroadcastView, type HeroVideoManifest } from "@/lib/casting/model";
import { ObsClient, ensureCastingScenes, switchCastingScene, buildCastingOverlayUrl, type CastingSceneSetup } from "@/lib/casting/obs";
import { createWorkshopLogWatcher, type LogRosterMember, type WorkshopLogWatcher, type WorkshopWatcherState, type WorkshopGameResult, type WorkshopGameStart } from "@/lib/casting/logs";
import styles from "./control-room.module.css";

interface Preferences { monitors: 1 | 2; theme: "dark" | "bright"; hideHeader: boolean; automatic: boolean }
const INITIAL: Preferences = { monitors: 1, theme: "dark", hideHeader: false, automatic: false };
const POOL_TYPES: MapType[] = ["CONTROL", "HYBRID", "PAYLOAD", "PUSH", "FLASHPOINT"];
const messageOf = (error: unknown) => error instanceof Error ? error.message : "Unable to complete this action.";

export function CastingTable({ matchId }: { matchId: number }) {
  const router = useRouter();
  const [user, setUser] = useState<NetworkSessionUser | null>(null);
  const [token, setToken] = useState("");
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [roster, setRoster] = useState<LogRosterMember[]>([]);
  const [shareKey, setShareKey] = useState("");
  const [origin, setOrigin] = useState("");
  const [preferences, setPreferences] = useState<Preferences>(INITIAL);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [view, setView] = useState<BroadcastView>("waiting");
  const [obsUrl, setObsUrl] = useState("ws://127.0.0.1:4455");
  const [password, setPassword] = useState("");
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [obsMessage, setObsMessage] = useState("Connect OBS to prepare this match's scenes.");
  const [setup, setSetup] = useState<CastingSceneSetup | null>(null);
  const [setupPending, setSetupPending] = useState(false);
  const [captures, setCaptures] = useState<string[]>([]);
  const [capture, setCapture] = useState("");
  const [program, setProgram] = useState<{sceneName:string;imageData:string} | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [logState, setLogState] = useState<WorkshopWatcherState>({ status:"disconnected", message:"Select your Workshop log folder to connect game events." });
  const [logResult, setLogResult] = useState<WorkshopGameResult | null>(null);
  const [gameStarted, setGameStarted] = useState<WorkshopGameStart | null>(null);
  const [manifest, setManifest] = useState<HeroVideoManifest>({});
  const [libraryError, setLibraryError] = useState("");
  const settingsRef = useRef<HTMLDivElement>(null);
  const matchRef = useRef(matchId);
  matchRef.current = matchId;
  const clientRef = useRef<ObsClient | null>(null);
  const watcherRef = useRef<WorkshopLogWatcher | null>(null);
  const stateRef = useRef({ draft, preferences, setup, connected, token });
  stateRef.current = { draft, preferences, setup, connected, token };
  const armedRef = useRef("");
  const actionLock = useRef(false);
  const mutationEpoch = useRef(0);
  const sceneQueue = useRef<Promise<void>>(Promise.resolve());
  const viewRef = useRef<BroadcastView>("waiting");
  const initialSceneRef = useRef(false);
  const automaticSceneRef = useRef("");
  const automaticResultRef = useRef("");
  const switchRef = useRef<(next: BroadcastView) => Promise<void>>(async () => {});
  const registerRef = useRef<(winner: number | null, result?: WorkshopGameResult) => Promise<void>>(async () => {});

  const refresh = useCallback(async () => {
    if (!token) return;
    const next = await getDraftByMatchId(matchId, { token });
    if (next.matchId === matchRef.current) setDraft(next);
    return next;
  }, [matchId, token]);

  useEffect(() => {
    if (!Number.isInteger(matchId) || matchId <= 0) { setError("Invalid match id."); return; }
    const current = readNetworkSessionUser();
    const auth = readNetworkSessionToken();
    if (!current || !auth || !canCast(current.roles)) { router.replace(`/login?next=/casting-table/${matchId}`); return; }
    setUser(current); setToken(auth); setOrigin(window.location.origin);
    setDraft(null); setTeams([]); setRoster([]); setLogResult(null); setGameStarted(null);
    setConnected(false); setSetup(null); setProgram(null); setShareKey(""); setPassword("");
    armedRef.current = ""; automaticSceneRef.current = ""; automaticResultRef.current = "";
    setView("waiting"); viewRef.current = "waiting"; mutationEpoch.current++;
    try {
      const saved = JSON.parse(localStorage.getItem(`gg.casting.preferences.${current.id}`) || "{}");
      setPreferences({ monitors:saved.monitors === 2 ? 2 : 1, theme:saved.theme === "bright" ? "bright" : "dark", hideHeader:saved.hideHeader === true, automatic:saved.automatic === true });
    } catch { /* Defaults work when storage is unavailable. */ }
    const client = new ObsClient();
    clientRef.current = client;
    const unsubscribe = client.subscribe(event => {
      if (event.type === "connected") { setConnected(true); setObsMessage(`OBS WebSocket ${event.version} connected. Preparing scenes…`); }
      if (event.type === "disconnected") { setConnected(false); setSetup(null); setProgram(null); setObsMessage(event.error || "OBS disconnected."); automaticSceneRef.current = ""; }
    });
    watcherRef.current = createWorkshopLogWatcher({ roster:[], onState:setLogState,
      onGameStart:async event => { if (event.matchId === matchId) setGameStarted(event); },
      onResult:async result => { setLogResult(result); }
    });
    return () => { watcherRef.current?.stop(); watcherRef.current = null; unsubscribe(); client.disconnect(); clientRef.current = null; };
  }, [matchId, router]);

  useEffect(() => {
    if (!token) return;
    let active = true, busy = false;
    const load = async () => {
      if (busy || actionLock.current) return; busy = true;
      const epoch = mutationEpoch.current;
      try { const state = await getDraftByMatchId(matchId, { token }); if (active && epoch === mutationEpoch.current && !actionLock.current) setDraft(state); }
      catch (failure) { if (active) setError(messageOf(failure)); }
      finally { busy = false; }
    };
    void load();
    void getTeams().then(value => { if (active) setTeams(value); }).catch(failure => { if (active) setError(messageOf(failure)); });
    let identitiesReady = false, keyReady = false;
    const loadConnections = () => {
      if (!identitiesReady) void apiRequest<LogRosterMember[]>(`/match/${matchId}/casting-roster`, { token }).then(value => { if (active) { identitiesReady = true; setRoster(value); watcherRef.current?.setRoster(value); } }).catch(failure => { if (active) setLogState({status:"review", message:`Unable to verify team identities: ${messageOf(failure)}. Retrying…`}); });
      if (!keyReady) void getDraftShareInfo(token, matchId).then(value => { if (active) { keyReady = true; setShareKey(value.key); } }).catch(failure => { if (active) setObsMessage(`Broadcast access is unavailable: ${messageOf(failure)}. Retrying…`); });
    };
    loadConnections();
    const recoveryTimer = window.setInterval(loadConnections,15000);
    const timer = window.setInterval(() => void load(), 1800);
    return () => { active = false; window.clearInterval(timer); window.clearInterval(recoveryTimer); };
  }, [matchId, token]);

  useEffect(() => {
    if (!token || !user) return;
    let active = true;
    void getMemberProfileById(user.id, token).then(profile => {
      if (!active) return;
      if (profile.obsWebsocketUrl) setObsUrl(profile.obsWebsocketUrl);
      if (profile.obsWebsocketPassword) setPassword(profile.obsWebsocketPassword);
    }).catch(() => {});
    return () => { active = false; };
  }, [token, user]);

  useEffect(() => {
    const abort = new AbortController();
    void loadHeroVideos(abort.signal).then(setManifest).catch(failure => { if (!abort.signal.aborted) setLibraryError(messageOf(failure)); });
    return () => abort.abort();
  }, []);
  useEffect(() => { if (user) { try { localStorage.setItem(`gg.casting.preferences.${user.id}`, JSON.stringify(preferences)); } catch { /* Preferences remain active this session. */ } } }, [preferences,user]);
  useEffect(() => {
    if (!settingsOpen) return;
    const close = (event: PointerEvent) => { if (!settingsRef.current?.contains(event.target as Node)) setSettingsOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setSettingsOpen(false); };
    document.addEventListener("pointerdown",close); document.addEventListener("keydown",escape);
    return () => { document.removeEventListener("pointerdown",close); document.removeEventListener("keydown",escape); };
  }, [settingsOpen]);

  // Stay on winner cards after a result. The operator explicitly starts the next map.
  useEffect(() => {
    if (!draft || !preferences.automatic || !setup?.ready || !connected) return;
    const next = automaticView(draft,gameStarted);
    const identity = `${draft.id}:${draft.phase}:${draft.currentMapId}:${draft.match.gameNumber}:${next}`;
    if (automaticSceneRef.current === identity) return;
    automaticSceneRef.current = identity;
    void switchRef.current(next).catch(failure => { automaticSceneRef.current = ""; setError(messageOf(failure)); });
  }, [draft?.id,draft?.phase,draft?.currentMapId,draft?.match.gameNumber,preferences.automatic,setup?.ready,connected,gameStarted]);

  useEffect(() => {
    if (!draft) return;
    if (draft.phase !== "PLAYING") { if (armedRef.current) { watcherRef.current?.disarm(); armedRef.current = ""; } return; }
    const identity = `${draft.id}:${currentMapNumber(draft)}:${draft.currentMapId}`;
    if (armedRef.current === identity) return;
    const map = draft.allMaps?.find(m => m.id === draft.currentMapId);
    if (!map) return;
    armedRef.current = identity;
    setLogResult(null);
    setGameStarted(null);
    automaticResultRef.current = "";
    // Arm once per map; never re-baseline when a roster/settings poll updates.
    void watcherRef.current?.arm({matchId,gameNumber:currentMapNumber(draft),mapName:map.description,startedAt:Date.now()});
  }, [draft,matchId]);

  useEffect(() => {
    if (!logResult || !preferences.automatic || !setup?.ready || !connected || pending) return;
    if (automaticResultRef.current === logResult.eventId) return;
    automaticResultRef.current = logResult.eventId;
    void registerRef.current(logResult.winnerTeamId,logResult).catch(failure => setError(messageOf(failure)));
  }, [logResult,preferences.automatic,setup?.ready,connected,pending]);

  useEffect(() => {
    if (!setup?.ready || !connected || !initialSceneRef.current) return;
    initialSceneRef.current = false;
    if (!preferences.automatic) void switchRef.current(viewRef.current).catch(failure => setError(messageOf(failure)));
  }, [setup?.ready,connected,preferences.automatic]);

  useEffect(() => {
    if (!connected || !shareKey) return;
    const client = clientRef.current;
    if (!client) return;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const prepare = async () => {
      setSetupPending(true);
      try {
        const result = await ensureCastingScenes(client,{matchId:String(matchId),origin,key:shareKey,captureInputName:capture || undefined,maxAttempts:2,signal:abort.signal,onProgress:value => { if (!abort.signal.aborted) setSetup(value); }});
        if (abort.signal.aborted) return;
        setSetup(result);
        setObsMessage(result.ready ? "All scenes configured. Check the program preview before going live." : result.issues.join(" "));
        if (!result.ready) timer = setTimeout(() => void prepare(),6000);
      } catch (failure) { if (!abort.signal.aborted) { setObsMessage(messageOf(failure)); timer = setTimeout(() => void prepare(),6000); } }
      finally { if (!abort.signal.aborted) setSetupPending(false); }
    };
    void prepare();
    return () => { abort.abort(); clearTimeout(timer); };
  }, [connected,shareKey,matchId,origin,capture]);

  useEffect(() => {
    if (!connected || preferences.monitors !== 1) return;
    let active = true, busy = false;
    const screenshot = async () => {
      if (busy) return; busy = true;
      try { const shot = await clientRef.current?.getProgramScreenshot(); if (active && shot) {
        setProgram(shot); setPreviewError("");
        const selected = BROADCAST_VIEWS.find(v => stateRef.current.setup?.scenes[v.key].sceneName === shot.sceneName);
        if (selected) { setView(selected.key); viewRef.current = selected.key; }
      } }
      catch (failure) { if (active) { setProgram(null); setPreviewError(messageOf(failure)); } }
      finally { busy = false; }
    };
    void screenshot();
    const timer = setInterval(() => void screenshot(),1500);
    return () => { active = false; clearInterval(timer); };
  }, [connected,preferences.monitors]);

  const selectScene = async (next: BroadcastView) => {
    viewRef.current = next;
    const task = sceneQueue.current.catch(() => {}).then(async () => {
      if (matchRef.current !== matchId) return;
      const current = stateRef.current;
      if (!current.connected) { setView(next); return; }
      if (!current.setup?.ready || !clientRef.current) throw new Error("Finish preparing all OBS scenes before switching the program.");
      await switchCastingScene(clientRef.current,current.setup,next);
      setView(next);
    });
    sceneQueue.current = task;
    return task;
  };
  switchRef.current = selectScene;

  const connect = async () => {
    setConnecting(true); setError("");
    try {
      initialSceneRef.current = true;
      await clientRef.current?.connect({url:obsUrl,password});
      const inputs = await clientRef.current?.request<{inputs:Array<{inputName:string;inputKind:string;unversionedInputKind?:string}>}>("GetInputList");
      setCaptures(inputs?.inputs.filter(i => /^game_capture(?:_v\d+)?$/.test(i.unversionedInputKind || i.inputKind)).map(i => i.inputName) || []);
    } catch (failure) { setObsMessage(messageOf(failure)); }
    finally { setConnecting(false); }
  };

  const perform = async (action: () => Promise<unknown>, nextView?: BroadcastView) => {
    if (actionLock.current) return;
    actionLock.current = true; mutationEpoch.current++; setPending(true); setError("");
    try { await action(); await refresh(); if (nextView) await selectScene(nextView); }
    catch (failure) { setError(messageOf(failure)); }
    finally { actionLock.current = false; setPending(false); }
  };

  const register = async (winner: number | null, result?: WorkshopGameResult) => {
    if (actionLock.current) return;
    actionLock.current = true; mutationEpoch.current++; setPending(true); setError("");
    try {
      const current = await getDraftByMatchId(matchId,{token});
      if (result) {
        if (result.matchId !== matchId) throw new Error("The log belongs to another match.");
        const recorded = current.match.mapResults?.find(r => r.gameNumber === result.gameNumber);
        if (recorded) {
          if (recorded.winnerTeamId !== winner) throw new Error("A different result is already recorded. Ask a manager to review it.");
          setLogResult(null); return;
        }
        if (!belongsToCurrentMap(current,result)) throw new Error("The log belongs to another round or map. Review the result manually.");
      }
      const expectedGameNumber = currentMapNumber(current);
      const expectedMapId = current.currentMapId;
      if (!expectedMapId) throw new Error("The current map has not been selected.");
      if (current.phase === "PLAYING") {
        const ended = await endGame(token,current.id,{expectedGameNumber,expectedMapId});
        if (currentMapNumber(ended) !== expectedGameNumber || ended.currentMapId !== expectedMapId) throw new Error("The active round changed. Review this result before retrying.");
      }
      else if (current.phase !== "ENDMAP") throw new Error("This map is not awaiting a result.");
      await submitMatchResult(token,matchId,winner,{expectedGameNumber,expectedMapId});
      watcherRef.current?.disarm(); armedRef.current = ""; setLogResult(null);
      await refresh();
      await selectScene("winner");
    } catch (failure) { setError(messageOf(failure)); }
    finally { actionLock.current = false; setPending(false); }
  };
  registerRef.current = register;

  const focusPool = (type: MapType | null, mapId?: number) => void perform(() => managerSetOverlayFocus(token,matchId,{focusType:type,focusMapId:mapId ?? null}));
  const teamA = teams.find(t => t.id === draft?.match.teamAId), teamB = teams.find(t => t.id === draft?.match.teamBId);
  const maps = draft?.allMaps?.filter(m => !draft.match.mapsAllowedByRound || mapPoolIds(draft.match).includes(m.id)) || [];
  const activeBans = draft?.heroes?.filter(h => draft.actions.some(a => a.action === "BAN" && a.gameNumber === currentMapNumber(draft) && a.value === h.id)) || [];
  const missingVideos = activeBans.filter(h => !heroVideo(manifest,h));
  const sceneUrl = origin && view !== "overwatch" ? buildCastingOverlayUrl(origin,String(matchId),view,shareKey || undefined) : "";
  const change = (value: Partial<Preferences>) => setPreferences(p => ({...p,...value}));
  const act = (next: BroadcastView) => void selectScene(next).catch(failure => setError(messageOf(failure)));
  const step = draft?.phase === "STARTING" ? 0 : ["MAPTYPEPICKING","MAPPICKING"].includes(draft?.phase || "") ? 1 : draft?.phase === "BAN" ? 2 : draft?.phase === "PLAYING" ? 3 : 4;

  if (!user) return <div className={styles.room}><p className={styles.empty}>{error || "Loading casting table…"}</p></div>;
  return <div className={styles.room} data-theme={preferences.theme}>
    {!preferences.hideHeader && <SiteHeader />}
    <header className={styles.topbar}>
      <Link className={styles.back} href="/casting-dashboard"><ArrowLeft size={18} /><span>Match lineup</span></Link>
      <div className={styles.matchTitle}><h1>{teamA?.name || "Team 1"} <span className={styles.muted}>vs</span> {teamB?.name || "Team 2"}</h1><p>CASTING TABLE · MATCH #{matchId} · {draft?.match.mapWinsTeamA || 0} — {draft?.match.mapWinsTeamB || 0}</p></div>
      <div className={styles.settingsAnchor} ref={settingsRef}><button className={styles.iconButton} aria-label="Casting settings" aria-expanded={settingsOpen} aria-controls="casting-settings" onClick={() => setSettingsOpen(!settingsOpen)}><Settings size={20} /></button>
        {settingsOpen && <div id="casting-settings" className={styles.settings}><div className={styles.inline}><h2>Casting settings</h2><button className={styles.iconButton} aria-label="Close settings" onClick={() => setSettingsOpen(false)}><X size={15} /></button></div>
          <label>Show site header <input type="checkbox" checked={!preferences.hideHeader} onChange={e => change({hideHeader:!e.target.checked})} /></label>
          <label>Monitor setup <select value={preferences.monitors} onChange={e => change({monitors:e.target.value === "2" ? 2 : 1})}><option value="1">1 monitor</option><option value="2">2 monitors</option></select></label>
          <label>Appearance <select value={preferences.theme} onChange={e => change({theme:e.target.value === "bright" ? "bright" : "dark"})}><option value="dark">Dark mode</option><option value="bright">Bright mode</option></select></label>
          <label>Automatic scenes {preferences.automatic ? "ON" : "OFF"}<input type="checkbox" checked={preferences.automatic} onChange={e => { automaticSceneRef.current = ""; change({automatic:e.target.checked}); }} /></label>
          <p className={styles.help}>Automatic mode follows draft stages and verified game logs. The next round always starts manually.</p>
        </div>}
      </div>
    </header>
    <div className={styles.container}>
      <div className={styles.inline}><span className={styles.eyebrow}><Radio size={13} /> PRODUCTION CONTROL</span><span className={styles.chip}>AUTOMATIC SCENES {preferences.automatic ? "ON" : "OFF"}</span></div>
      {preferences.monitors === 2 && <p className={styles.notice}><Monitor size={16} style={{display:"inline",marginRight:8}} />For a better experience, move OBS to your second monitor. This is recommended, but not required.</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.workspace}>
        <aside className={styles.sidebar}>
          <section className={styles.panel}><div className={styles.panelHead}><h2>Run of show</h2><span>MAP {draft ? currentMapNumber(draft) : 1}</span></div><div className={styles.panelBody}>
            {["Waiting for captains","Map picking","Hero bans","Playing","Winner cards"].map((label,index) => <div key={label} className={`${styles.step} ${index === step ? styles.active : ""}`}><span className={styles.stepNumber}>{index < step ? <Check size={13} /> : `0${index+1}`}</span><span>{label}</span></div>)}
            <div className={styles.readiness}><span>{teamA?.name || "Team 1"}</span><strong>{draft?.match.teamAready === 1 ? "Ready" : "Waiting"}</strong></div><div className={styles.readiness}><span>{teamB?.name || "Team 2"}</span><strong>{draft?.match.teamBready === 1 ? "Ready" : "Waiting"}</strong></div>
            <div className={styles.actions}>
              <button className={styles.primary} disabled={pending || (connected && !setup?.ready) || draft?.phase !== "STARTING" || draft.match.teamAready !== 1 || draft.match.teamBready !== 1} onClick={() => draft && void perform(() => startMapPicking(token,draft.id),"draft")}>{draft?.match.gameNumber ? "Start next round" : "Start map picking"}</button>
              <button className={styles.secondary} disabled={pending || (connected && !setup?.ready) || draft?.phase !== "MAPPICKING" || !draft.currentMapId} onClick={() => draft && void perform(() => startBan(token,draft.id),"draft")}>Start hero bans</button>
              <button className={styles.secondary} disabled={pending || !["PLAYING","ENDMAP"].includes(draft?.phase || "")} onClick={() => void register(null)}>Record a draw</button>
            </div><p className={styles.help}>Captains pick the map and ban heroes in their draft table. Bans appear on stream when all four turns finish.</p>
          </div></section>
          <section className={styles.panel}><div className={styles.panelHead}><h2>Scene controls</h2><span>MANUAL</span></div><div className={`${styles.panelBody} ${styles.sceneButtons}`}>
            {BROADCAST_VIEWS.map(scene => <button key={scene.key} className={`${styles.secondary} ${view === scene.key ? styles.sceneSelected : ""}`} disabled={pending || (connected && !setup?.ready) || (scene.key === "overwatch" && !connected)} onClick={() => act(scene.key)}>{scene.label}<span>{view === scene.key ? "●" : "↗"}</span></button>)}
          </div></section>
        </aside>
        <div className={styles.mainColumn}>
          {preferences.monitors === 1 && <section className={styles.panel}><div className={styles.panelHead}><h2>{connected ? "OBS program preview" : "Broadcast preview"}</h2><span>{connected ? "LIVE COMPOSITION · REFRESHES EVERY 1.5s" : "WAITING FOR OBS"}</span></div><div className={styles.preview}>
            {connected ? program ? <img src={program.imageData} alt={`OBS program: ${program.sceneName}`} /> : <p className={styles.empty}>{previewError || "Loading OBS program…"}</p> : sceneUrl ? <iframe title="Broadcast preview" src={sceneUrl} /> : <p className={styles.empty}>Waiting for captains…</p>}
          </div><div className={styles.previewFoot}><span>{program?.sceneName || BROADCAST_VIEWS.find(v => v.key === view)?.label}</span><span>{connected ? "Actual OBS program · snapshot preview" : "Overlay preview · OBS is not connected"}</span></div></section>}
          <div className={styles.integrationGrid}>
            <section className={styles.panel}><div className={styles.panelHead}><h2>01 · OBS connection</h2><span>{setup?.ready ? "READY" : connected ? "PREPARING" : "OFFLINE"}</span></div><div className={styles.panelBody}>
              <div className={styles.form}><label>WebSocket address<input value={obsUrl} onChange={e => setObsUrl(e.target.value)} placeholder="ws://127.0.0.1:4455" disabled={connected} /></label><label>WebSocket password<input type="password" autoComplete="off" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter here or save it in your profile" disabled={connected} /></label>
                {connected && <label>Overwatch Game Capture<select value={capture} disabled={setupPending} onChange={e => setCapture(e.target.value)}><option value="">Detect Overwatch automatically</option>{captures.map(name => <option key={name}>{name}</option>)}</select></label>}
                <button className={connected ? styles.secondary : styles.primary} disabled={connecting} onClick={() => connected ? clientRef.current?.disconnect() : void connect()}>{connecting ? "Connecting…" : connected ? "Disconnect OBS" : "Connect & prepare scenes"}</button>
              </div><p className={styles.status}><i className={styles.statusDot} data-ready={setup?.ready} />{setupPending ? "Preparing match scenes. Unfinished sources will be retried automatically." : obsMessage}</p>
              {!shareKey && connected && <p className={styles.help}>A broadcast share key is required before scene preparation can finish.</p>}
              {setup && <div className={styles.sceneList}>{BROADCAST_VIEWS.map(scene => { const status = setup.scenes[scene.key]; return <div key={scene.key} className={styles.sceneRow}><span>{status.ready ? "✓" : "○"}</span><div><strong>{status.sceneName}</strong>{status.error && <p>{status.error}</p>}</div></div>; })}</div>}
              <p className={styles.help}>Scenes and browser sources are tied to this match. Add a Game Capture source targeting Overwatch if it has not been configured yet.</p>
            </div></section>
            <section className={styles.panel}><div className={styles.panelHead}><h2>02 · Game events</h2><span>M3FFX</span></div><div className={styles.panelBody}>
              <a className={styles.back} href="https://workshop.codes/M3FFX" target="_blank" rel="noreferrer">SupaScrim Workshop code <ExternalLink size={12} /></a>
              <p className={styles.help}>Select the Workshop folder on the computer running Overwatch. The browser reads new log files after you grant access.</p>
              <button className={styles.secondary} style={{width:"100%",marginTop:14}} disabled={logState.status === "unsupported" || logState.status === "selecting"} onClick={() => void watcherRef.current?.selectFolder()}><FolderOpen size={16} />{logState.folderName ? "Change log folder" : "Select log folder"}</button>
              <p className={styles.status}><i className={styles.statusDot} data-ready={logState.status === "watching" || logState.status === "ready"} />{logState.message}</p>
              {logState.folderName && <p className={styles.help}>Folder: {logState.folderName}{logState.fileName ? ` · ${logState.fileName}` : ""}</p>}
              <details><summary className={styles.help}>Player names used to identify teams ({roster.length})</summary>{[draft?.match.teamAId,draft?.match.teamBId].map((id,index) => <p key={index} className={styles.help}><strong>{index === 0 ? teamA?.name : teamB?.name}:</strong> {roster.filter(r => r.teamId === id).map(r => r.username).join(", ") || "No registered names"}</p>)}</details>
              {logResult && <><p className={styles.notice}>Detected: {teams.find(t => t.id === logResult.winnerTeamId)?.name || "Draw"} · Map {logResult.gameNumber}. {preferences.automatic && !setup?.ready ? "Waiting for OBS readiness." : "Ready to register."}</p><button className={styles.primary} disabled={pending} onClick={() => void register(logResult.winnerTeamId,logResult)}>Register detected result</button></>}
              <div className={styles.resultButtons}>{[teamA,teamB].map((team,index) => <button key={index} className={styles.secondary} disabled={pending || !team || !["PLAYING","ENDMAP"].includes(draft?.phase || "")} onClick={() => team && void register(team.id)}>{team?.name || `Team ${index+1}`} wins</button>)}</div>
              <p className={styles.help}>Automatic results require a final event, the selected map and at least one matching player per team. Push and ambiguous scores need manual review.</p>
            </div></section>
          </div>
          <section className={styles.panel}><div className={styles.panelHead}><h2>03 · Map pool director</h2><button className={styles.secondary} disabled={pending || !draft} onClick={() => focusPool(null)}>Reset focus</button></div><div className={styles.panelBody}><div className={styles.pool}>
            {POOL_TYPES.map(type => <div key={type} className={styles.poolType}><button className={`${styles.secondary} ${draft?.match.overlayFocusType === type ? styles.sceneSelected : ""}`} disabled={pending || !draft} onClick={() => focusPool(type)}>{type === "PAYLOAD" ? "ESCORT" : type}</button>{maps.filter(m => m.type === type).map(map => <button key={map.id} className={`${styles.mapButton} ${draft?.match.overlayFocusMapId === map.id ? styles.mapFocused : ""}`} disabled={pending} onClick={() => focusPool(type,map.id)}><img src={resolveMapImageUrl(map.imgPath)} alt="" /><span>{map.description}</span></button>)}</div>)}
          </div><p className={styles.help}>Choose a type or map to focus the existing map pool overlay. Use “Map pool” in scene controls to put it on air.</p></div></section>
          <section className={styles.panel}><div className={styles.panelHead}><h2>04 · Hero video library</h2><span>CLOUDFLARE R2</span></div><div className={styles.panelBody}><p className={styles.help}>{libraryError || `${Object.keys(manifest).length} hero videos linked. Videos loop, play muted and crop to the center of each hero.`}</p>{missingVideos.length > 0 && <p className={styles.notice}>Video pending: {missingVideos.map(h => h.name).join(", ")}. Hero portraits remain visible until their videos are available.</p>}<p className={styles.help}>Two bans per team, left and right, over the selected map. Configure public video URLs in the hero manifest after uploading your clips.</p></div></section>
        </div>
      </div>
    </div>
  </div>;
}
