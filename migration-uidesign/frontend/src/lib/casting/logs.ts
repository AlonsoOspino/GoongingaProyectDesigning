/**
 * Read-only SupaScrim (M3FFX) / ScrimTime Inspector integration.
 * Row indexes are verified against the published ScrimTime schema and real logs:
 * https://github.com/luxdotdev/parsertime/blob/main/apps/web/src/lib/parser/schema.ts
 * Push's SupaScrim extension is deliberately pending validation against a real log.
 */
export interface LogRosterMember {
  username: string;
  teamId: number;
}

export interface WorkshopGameSession {
  matchId: number;
  gameNumber: number;
  mapName: string;
  /** Local time when this map was armed, not an Inspector elapsed timestamp. */
  startedAt: number;
}

export interface MatchedLogPlayer extends LogRosterMember {
  logTeam: string;
}

export interface WorkshopGameStart {
  eventId: string;
  logIdentity: string;
  matchId: number;
  gameNumber: number;
  mapName: string;
  mode: string;
  sourceFile: string;
  matchedPlayers: MatchedLogPlayer[];
}

export interface WorkshopGameResult extends WorkshopGameStart {
  winnerTeamId: number | null;
  isDraw: boolean;
  scores: [number, number];
  roundNumber: number;
}

export type WorkshopParseStatus = "unrecognized" | "incomplete" | "review" | "started" | "complete";
export interface WorkshopParseResult {
  status: WorkshopParseStatus;
  message: string;
  mapName?: string;
  mode?: string;
  start?: WorkshopGameStart;
  result?: WorkshopGameResult;
  /** Independent of filenames and the web match, used to reject copied logs. */
  logIdentity?: string;
}

interface InspectorRow {
  fields: string[];
  offset: number;
}

const SINGLE_PLAYER_EVENTS = new Set([
  "hero_spawn", "hero_swap", "ability_1_used", "ability_2_used",
  "ultimate_charged", "ultimate_start", "ultimate_end", "offensive_assist",
  "defensive_assist", "dva_remech", "remech_charged", "echo_duplicate_start",
  "echo_duplicate_end",
]);
const TWO_PLAYER_EVENTS = new Set(["kill", "damage", "healing", "mercy_rez"]);
const VERIFIED_MODES = new Set(["control", "escort", "hybrid", "flashpoint", "clash"]);

function normalizedName(value: string): string {
  // BattleTag suffixes are not logged. Preserve accents/punctuation in the name;
  // any duplicate base name across registered accounts is rejected below.
  return value.normalize("NFC").trim().replace(/#\d+$/, "").toLocaleLowerCase("en-US");
}

function normalizedMap(value: string): string {
  return value.normalize("NFC").trim().replace(/[’‘]/g, "'").toLocaleLowerCase("en-US");
}

function normalizedTeam(value: string): string {
  return value.normalize("NFC").trim().toLocaleLowerCase("en-US");
}

function numeric(value: string | undefined): number | null {
  if (value === undefined || !/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(value.trim())) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function csvFields(text: string): string[] | null {
  const fields: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { current += '"'; i++; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) { fields.push(current.trim()); current = ""; }
    else current += char;
  }
  if (quoted) return null;
  fields.push(current.trim());
  return fields;
}

function inspectorRows(text: string): InspectorRow[] {
  const rows: InspectorRow[] = [];
  let offset = 0;
  // Do not interpret an unfinished trailing write as a complete terminal event.
  for (const line of text.split(/\n/).slice(0, -1)) {
    const trimmed = line.replace(/\r$/, "").replace(/^\uFEFF/, "");
    const raw = trimmed.replace(/^\[\d{2}:\d{2}:\d{2}(?:\.\d+)?\]\s*/, "").replace(/^,/, "");
    const fields = csvFields(raw);
    if (fields && /^[a-z][a-z_\d]*$/.test(fields[0] || "")) rows.push({ fields, offset });
    offset += line.length + 1;
  }
  return rows;
}

/** Pure parser. Equal integer scores do not prove a draw on payload/hybrid maps. */
export function parseWorkshopLog(
  text: string,
  options: {
    roster: readonly LogRosterMember[];
    session: WorkshopGameSession;
    sourceFile?: string;
    /** A setup_complete event must be newly appended after this boundary. */
    minimumLiveOffset?: number;
  },
): WorkshopParseResult {
  const rows = inspectorRows(text);
  const starts = rows.filter(({ fields }) => fields[0] === "match_start");
  if (!starts.length) return { status: "unrecognized", message: "Waiting for a complete ScrimTime match_start row." };
  if (starts.length !== 1) return { status: "review", message: "This file contains multiple game sessions. Review its result manually." };
  const start = starts[0].fields;
  const base = { mapName: start[2], mode: start[3] };
  if (start.length !== 6 || numeric(start[1]) === null || !start[2] || !start[3] || !start[4] || !start[5] || normalizedTeam(start[4]) === normalizedTeam(start[5])) {
    return { ...base, status: "review", message: "The match_start fields or team names are invalid." };
  }
  if (normalizedMap(start[2]) !== normalizedMap(options.session.mapName)) {
    return { ...base, status: "review", message: `The log is for ${start[2]}, not the selected map ${options.session.mapName}.` };
  }
  const endRows = rows.filter(({ fields }) => fields[0] === "match_end");
  const distinctEnds = new Set(endRows.map(({ fields }) => JSON.stringify(fields)));
  if (distinctEnds.size > 1) return { ...base, status: "review", message: "The file contains conflicting final results." };
  const end = endRows[0]?.fields;
  const identityRows = rows.filter(({ fields }) => fields[0] === "hero_spawn" || fields[0] === "player_stat");
  const logIdentity = JSON.stringify({
    start,
    players: [...new Set(identityRows.map(({ fields }) => JSON.stringify(fields.slice(fields[0] === "player_stat" ? 3 : 2, fields[0] === "player_stat" ? 5 : 4))))].sort(),
    end,
  });

  const rosterNames = new Map<string, LogRosterMember[]>();
  for (const member of options.roster) {
    const name = normalizedName(member.username);
    if (!name || !Number.isInteger(member.teamId)) continue;
    const entries = rosterNames.get(name) || [];
    // Repeated identical API entries are harmless; different accounts/teams are not.
    if (!entries.some((entry) => entry.username === member.username && entry.teamId === member.teamId)) entries.push(member);
    rosterNames.set(name, entries);
  }
  const observed = new Map<string, Set<string>>();
  const addPlayer = (team: string | undefined, name: string | undefined) => {
    if (!team || !name || !rosterNames.has(normalizedName(name))) return;
    const sides = observed.get(normalizedName(name)) || new Set<string>();
    sides.add(normalizedTeam(team));
    observed.set(normalizedName(name), sides);
  };
  for (const { fields } of rows) {
    if (SINGLE_PLAYER_EVENTS.has(fields[0]) && fields.length >= 5) addPlayer(fields[2], fields[3]);
    else if (fields[0] === "player_stat" && fields.length >= 6) addPlayer(fields[3], fields[4]);
    else if (TWO_PLAYER_EVENTS.has(fields[0]) && fields.length >= 8) {
      addPlayer(fields[2], fields[3]);
      addPlayer(fields[5], fields[6]);
    }
  }
  const matchedPlayers: MatchedLogPlayer[] = [];
  const sides = new Map<string, Set<number>>();
  const logTeams = [start[4], start[5]];
  for (const [name, observedSides] of observed) {
    const members = rosterNames.get(name)!;
    if (members.length !== 1 || observedSides.size !== 1) {
      return { ...base, logIdentity, status: "review", message: "A player name is duplicated or appears on both teams. Review team identity manually." };
    }
    const side = [...observedSides][0];
    const originalTeam = logTeams.find((team) => normalizedTeam(team) === side);
    if (!originalTeam) return { ...base, logIdentity, status: "review", message: "A registered player has an unknown log team." };
    const teamIds = sides.get(side) || new Set<number>();
    teamIds.add(members[0].teamId);
    sides.set(side, teamIds);
    matchedPlayers.push({ ...members[0], logTeam: originalTeam });
  }
  const side1 = sides.get(normalizedTeam(start[4]));
  const side2 = sides.get(normalizedTeam(start[5]));
  if (matchedPlayers.length < 2 || side1?.size !== 1 || side2?.size !== 1 || [...side1][0] === [...side2][0]) {
    return { ...base, logIdentity, status: end ? "review" : "incomplete", message: "Match at least two unique website usernames, including one player on each team." };
  }
  const setup = rows.find(({ fields, offset }) => fields[0] === "setup_complete" && fields.length === 4 && fields[2] === "1" && numeric(fields[1]) !== null && numeric(fields[3]) !== null && offset >= (options.minimumLiveOffset || 0));
  if (!setup) return { ...base, logIdentity, status: end ? "review" : "incomplete", message: "Waiting for a new round-one setup_complete event after Playing was armed." };

  const eventBase = {
    matchId: options.session.matchId,
    gameNumber: options.session.gameNumber,
    mapName: start[2],
    mode: start[3],
    sourceFile: options.sourceFile || "Workshop log",
    matchedPlayers: matchedPlayers.sort((a, b) => a.username.localeCompare(b.username)),
    logIdentity,
  };
  const startIdentity = JSON.stringify({ start, setup: setup.fields, teamIds: [[...side1][0], [...side2][0]] });
  const gameStart: WorkshopGameStart = { ...eventBase, eventId: `workshop-start:${options.session.matchId}:${options.session.gameNumber}:${startIdentity}` };
  if (!end) return { ...base, logIdentity, status: "started", message: "Current map started. Waiting for its final match_end event.", start: gameStart };
  if (end.length !== 5 || numeric(end[1]) === null || numeric(end[1])! <= 0 || numeric(end[1])! < Number(setup.fields[1]) || endRows[0].offset < setup.offset || numeric(end[2]) === null || !Number.isInteger(Number(end[2])) || Number(end[2]) < 1 || numeric(end[3]) === null || numeric(end[4]) === null || !Number.isInteger(Number(end[3])) || !Number.isInteger(Number(end[4]))) {
    return { ...base, logIdentity, status: "review", message: "The final match_end row is incomplete or invalid. Review the result manually.", start: gameStart };
  }
  const scores: [number, number] = [Number(end[3]), Number(end[4])];
  if (!VERIFIED_MODES.has(start[3].toLocaleLowerCase("en-US")) || scores[0] === scores[1]) {
    return { ...base, logIdentity, status: "review", message: start[3].toLocaleLowerCase("en-US") === "push" ? "Push needs a validated SupaScrim result sample. Confirm the winner manually." : "The final scores require a tiebreak or draw check. Confirm the result manually.", start: gameStart };
  }
  const result: WorkshopGameResult = {
    ...eventBase,
    eventId: `workshop-end:${options.session.matchId}:${options.session.gameNumber}:${logIdentity}`,
    winnerTeamId: [...(scores[0] > scores[1] ? side1 : side2)][0],
    isDraw: false,
    scores,
    roundNumber: Number(end[2]),
  };
  return { ...base, logIdentity, status: "complete", message: "Final map result verified from match_end and both team identities.", start: gameStart, result };
}

export type WorkshopWatcherStatus = "unsupported" | "disconnected" | "selecting" | "ready" | "watching" | "review" | "permission-denied" | "error";
export interface WorkshopWatcherState {
  status: WorkshopWatcherStatus;
  message: string;
  folderName?: string;
  fileName?: string;
}

export interface WorkshopFileHandle {
  kind: "file";
  name: string;
  getFile(): Promise<Pick<File, "size" | "lastModified" | "text">>;
}
export interface WorkshopDirectoryHandle {
  kind: "directory";
  name: string;
  queryPermission(options: { mode: "read" }): Promise<"granted" | "denied" | "prompt">;
  values(): AsyncIterable<WorkshopFileHandle | WorkshopDirectoryHandle>;
}
type WorkshopPicker = (options: { mode: "read"; id: string; startIn: "documents" }) => Promise<WorkshopDirectoryHandle>;

export interface WorkshopLogWatcher {
  selectFolder(): Promise<boolean>;
  arm(session: WorkshopGameSession): Promise<void>;
  setRoster(roster: readonly LogRosterMember[]): void;
  disarm(): void;
  stop(): void;
  /** Exposed for tests and a user-triggered refresh; normal polling is automatic. */
  poll(): Promise<void>;
}

export function createWorkshopLogWatcher(options: {
  roster: readonly LogRosterMember[];
  onState(state: WorkshopWatcherState): void;
  onGameStart?(event: WorkshopGameStart): void | Promise<void>;
  onResult(event: WorkshopGameResult): void | Promise<void>;
  pollIntervalMs?: number;
  /** Dependency injection for deterministic read-only tests. */
  picker?: WorkshopPicker;
}): WorkshopLogWatcher {
  let roster = options.roster;
  let directory: WorkshopDirectoryHandle | null = null;
  let session: WorkshopGameSession | null = null;
  let stopped = false;
  let generation = 0;
  let polling = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const baseline = new Map<string, number>();
  const staleLogs = new Set<string>();
  const deliveredResults = new Set<string>();
  const deliveredStarts = new Set<string>();
  const fingerprints = new Map<string, { signature: string; observations: number }>();
  const browser = typeof window === "undefined" ? undefined : window as unknown as { isSecureContext: boolean; showDirectoryPicker?: WorkshopPicker };
  const picker = options.picker || (browser?.isSecureContext ? browser.showDirectoryPicker?.bind(window) : undefined);
  const state = (status: WorkshopWatcherStatus, message: string, fileName?: string) => {
    if (!stopped) options.onState({ status, message, folderName: directory?.name, fileName });
  };
  const clearTimer = () => { if (timer) clearTimeout(timer); timer = null; };
  const fileHandles = async (handle: WorkshopDirectoryHandle) => {
    const files: WorkshopFileHandle[] = [];
    for await (const entry of handle.values()) if (entry.kind === "file" && /^Log[-_].*\.txt$/i.test(entry.name)) files.push(entry);
    return files;
  };
  const checkPermission = async (handle: WorkshopDirectoryHandle) => {
    if (await handle.queryPermission({ mode: "read" }) === "granted") return true;
    session = null;
    generation++;
    clearTimer();
    state("permission-denied", "Folder access was revoked. Select the Workshop folder again to resume.");
    return false;
  };
  const takeBaseline = async (handle: WorkshopDirectoryHandle, version: number) => {
    const captured = new Map<string, number>();
    const files = await fileHandles(handle);
    for (const entry of files) {
      const file = await entry.getFile();
      if (file.size > 4 * 1024 * 1024) continue;
      const text = await file.text();
      captured.set(entry.name, text.length);
      // Capture all completed logs before arming, including copies under new names.
      if (session) {
        const parsed = parseWorkshopLog(text, { roster, session });
        if (parsed.logIdentity && inspectorRows(text).some(({ fields }) => fields[0] === "match_end")) staleLogs.add(parsed.logIdentity);
      }
    }
    if (stopped || generation !== version) return;
    baseline.clear();
    for (const [name, length] of captured) baseline.set(name, length);
    fingerprints.clear();
  };
  const schedule = () => {
    clearTimer();
    if (!stopped && session && directory) timer = setTimeout(() => { void poll(); }, Math.max(250, options.pollIntervalMs || 2000));
  };
  const poll = async () => {
    if (polling || stopped || !directory || !session) return;
    polling = true;
    const active = session;
    const handle = directory;
    const version = generation;
    const stillActive = () => !stopped && generation === version && session === active;
    try {
      if (!await checkPermission(handle) || !stillActive()) return;
      const candidates: WorkshopParseResult[] = [];
      const terminalCandidates = new Set<string>();
      for (const entry of await fileHandles(handle)) {
        const file = await entry.getFile();
        if (!stillActive()) return;
        if (file.lastModified < active.startedAt || file.size > 4 * 1024 * 1024) continue;
        const text = await file.text();
        if (!stillActive()) return;
        const boundary = baseline.get(entry.name) || 0;
        if (text.length <= boundary) continue;
        const signature = `${file.size}:${file.lastModified}:${text.length}`;
        const previous = fingerprints.get(entry.name);
        const observations = previous?.signature === signature ? previous.observations + 1 : 1;
        fingerprints.set(entry.name, { signature, observations });
        const parsed = parseWorkshopLog(text, { roster, session: active, sourceFile: entry.name, minimumLiveOffset: boundary });
        if (parsed.logIdentity && staleLogs.has(parsed.logIdentity)) continue;
        if (parsed.result) terminalCandidates.add(parsed.result.eventId);
        // Final results must survive two consecutive unchanged observations, so
        // subsequent player_stat writes or a partial match_end cannot race us.
        if (parsed.result && observations < 2) { candidates.push({ ...parsed, result: undefined, status: "started" }); continue; }
        candidates.push(parsed);
      }
      if (!stillActive()) return;
      if (terminalCandidates.size > 1) {
        state("review", "More than one new log matches this map. Confirm the result manually.");
        return;
      }
      for (const candidate of candidates) {
        if (candidate.start && !deliveredStarts.has(candidate.start.eventId)) {
          await options.onGameStart?.(candidate.start);
          if (!stillActive()) return;
          deliveredStarts.add(candidate.start.eventId);
        }
        if (candidate.result && !deliveredResults.has(candidate.result.eventId)) {
          await options.onResult(candidate.result);
          if (!stillActive()) return;
          deliveredResults.add(candidate.result.eventId);
          staleLogs.add(candidate.result.logIdentity);
          state("watching", "Map result delivered. Start the next round manually when ready.", candidate.result.sourceFile);
          return;
        }
      }
      const review = candidates.find((candidate) => candidate.status === "review");
      if (review) state("review", review.message);
      else state("watching", candidates.some((candidate) => candidate.start) ? "Current map started. Waiting for a stable final match_end result." : "Watching for a new game on the selected map.");
    } catch (error) {
      if (!stillActive()) return;
      const name = error instanceof Error ? error.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        session = null;
        generation++;
        state("permission-denied", "Folder access is unavailable. Select the Workshop folder again.");
      } else state("error", error instanceof Error ? error.message : "Unable to read the Workshop folder.");
    } finally {
      polling = false;
      schedule();
    }
  };

  state(picker ? "disconnected" : "unsupported", picker ? "Select Documents / Overwatch / Workshop to connect game logs." : "Folder access is unavailable. Open this page in Chrome or Edge over HTTPS, or use manual results.");
  return {
    async selectFolder() {
      if (stopped || !picker) return false;
      state("selecting", "Select Documents / Overwatch / Workshop. Only read access is requested.");
      try {
        // Must be reached directly from a click; do not await anything before it.
        const selected = await picker({ mode: "read", id: "goonginga-workshop-logs", startIn: "documents" });
        if (stopped) return false;
        directory = selected;
        const version = ++generation;
        clearTimer();
        if (!await checkPermission(selected)) return false;
        await takeBaseline(selected, version);
        if (generation !== version || stopped) return false;
        state(session ? "watching" : "ready", session ? "Folder connected. Watching for the next new game event." : "Folder connected. Game logs will be armed when Playing starts.");
        schedule();
        return true;
      } catch (error) {
        const name = error instanceof Error ? error.name : "";
        if (name === "AbortError") state(directory ? session ? "watching" : "ready" : "disconnected", "Folder selection cancelled.");
        else state(name === "SecurityError" || name === "NotAllowedError" ? "permission-denied" : "error", error instanceof Error ? error.message : "Unable to select the Workshop folder.");
        return false;
      }
    },
    async arm(nextSession) {
      if (stopped) return;
      const version = ++generation;
      clearTimer();
      session = nextSession;
      if (!directory) { state(picker ? "disconnected" : "unsupported", picker ? "Select the Workshop folder to enable automatic game events." : "Use Chrome or Edge over HTTPS for folder access, or confirm results manually."); return; }
      try {
        if (!await checkPermission(directory)) return;
        await takeBaseline(directory, version);
        if (generation !== version || stopped) return;
        state("watching", "Playing armed. Existing logs are ignored; waiting for a new game start.");
        schedule();
      } catch (error) {
        if (generation === version) { session = null; state("error", error instanceof Error ? error.message : "Unable to read the Workshop folder."); }
      }
    },
    setRoster(nextRoster) { roster = nextRoster; },
    disarm() {
      generation++;
      session = null;
      clearTimer();
      state(directory ? "ready" : picker ? "disconnected" : "unsupported", directory ? "Folder connected. Waiting for the next Playing stage." : picker ? "Select the Workshop folder to connect game logs." : "Use Chrome or Edge over HTTPS for folder access, or confirm results manually.");
    },
    stop() { stopped = true; generation++; session = null; clearTimer(); directory = null; },
    poll,
  };
}
