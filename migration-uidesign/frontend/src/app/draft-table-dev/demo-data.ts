import type { DraftAction, DraftState, GameMap, Hero, MapType, Team } from "@/lib/api";

export const DRAFT_MAP_TYPES = [
  "CONTROL",
  "HYBRID",
  "PAYLOAD",
  "PUSH",
  "FLASHPOINT",
] as const;

export type DraftMapType = (typeof DRAFT_MAP_TYPES)[number];
export type DraftHeroRole = "TANK" | "DPS" | "SUPPORT";

export interface DraftTableDevTeam {
  id: number;
  name: string;
  shortName: string;
  captain: string;
  logo: string;
  accent: string;
}

export interface DraftTableDevMap {
  id: number;
  name: string;
  type: DraftMapType;
  image: string;
}

export interface DraftTableDevHero {
  id: number;
  name: string;
  role: DraftHeroRole;
  image: string;
}

export interface DraftTableDevData {
  version: number;
  match: {
    id: number;
    title: string;
    bestOf: number;
    initialPickerTeamId: number;
  };
  teams: [DraftTableDevTeam, DraftTableDevTeam];
  maps: DraftTableDevMap[];
  heroes: DraftTableDevHero[];
  rules: {
    firstMapType: "CONTROL";
    mapTypesAfterControl: Exclude<DraftMapType, "CONTROL">[];
    bansPerTeam: number;
    roleBanLimit: number;
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isPositiveInteger = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) > 0;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isMapType = (value: unknown): value is DraftMapType =>
  typeof value === "string" && DRAFT_MAP_TYPES.includes(value as DraftMapType);

const isHeroRole = (value: unknown): value is DraftHeroRole =>
  value === "TANK" || value === "DPS" || value === "SUPPORT";

export function parseDraftTableDevData(value: unknown): DraftTableDevData {
  if (!isRecord(value) || !isRecord(value.match) || !isRecord(value.rules)) {
    throw new Error("The demo fixture must contain match and rules objects.");
  }

  if (!Array.isArray(value.teams) || value.teams.length !== 2) {
    throw new Error("The demo fixture must contain exactly two teams.");
  }
  if (!Array.isArray(value.maps) || value.maps.length === 0) {
    throw new Error("The demo fixture must contain at least one map.");
  }
  if (!Array.isArray(value.heroes) || value.heroes.length < 4) {
    throw new Error("The demo fixture must contain at least four heroes.");
  }

  const teams = value.teams.map((team, index) => {
    if (
      !isRecord(team) ||
      !isPositiveInteger(team.id) ||
      !isNonEmptyString(team.name) ||
      !isNonEmptyString(team.shortName) ||
      !isNonEmptyString(team.captain) ||
      !isNonEmptyString(team.logo) ||
      !isNonEmptyString(team.accent)
    ) {
      throw new Error(`Team ${index + 1} is invalid.`);
    }
    return team as unknown as DraftTableDevTeam;
  }) as [DraftTableDevTeam, DraftTableDevTeam];

  const maps = value.maps.map((map, index) => {
    if (
      !isRecord(map) ||
      !isPositiveInteger(map.id) ||
      !isNonEmptyString(map.name) ||
      !isMapType(map.type) ||
      !isNonEmptyString(map.image)
    ) {
      throw new Error(`Map ${index + 1} is invalid.`);
    }
    return map as unknown as DraftTableDevMap;
  });

  const heroes = value.heroes.map((hero, index) => {
    if (
      !isRecord(hero) ||
      !isPositiveInteger(hero.id) ||
      !isNonEmptyString(hero.name) ||
      !isHeroRole(hero.role) ||
      !isNonEmptyString(hero.image)
    ) {
      throw new Error(`Hero ${index + 1} is invalid.`);
    }
    return hero as unknown as DraftTableDevHero;
  });

  const mapTypesAfterControl = value.rules.mapTypesAfterControl;
  if (
    value.rules.firstMapType !== "CONTROL" ||
    !Array.isArray(mapTypesAfterControl) ||
    mapTypesAfterControl.length === 0 ||
    mapTypesAfterControl.some((mapType) => !isMapType(mapType) || mapType === "CONTROL") ||
    !isPositiveInteger(value.rules.bansPerTeam) ||
    !isPositiveInteger(value.rules.roleBanLimit)
  ) {
    throw new Error("The demo draft rules are invalid.");
  }

  const initialPickerTeamId = value.match.initialPickerTeamId;
  if (
    !isPositiveInteger(value.match.id) ||
    !isNonEmptyString(value.match.title) ||
    !isPositiveInteger(value.match.bestOf) ||
    !isPositiveInteger(initialPickerTeamId) ||
    !teams.some((team) => team.id === initialPickerTeamId)
  ) {
    throw new Error("The demo match configuration is invalid.");
  }

  const configuredTypes = new Set<DraftMapType>([
    "CONTROL",
    ...(mapTypesAfterControl as DraftMapType[]),
  ]);
  for (const mapType of configuredTypes) {
    if (!maps.some((map) => map.type === mapType)) {
      throw new Error(`The demo fixture has no ${mapType} map.`);
    }
  }

  return {
    version: isPositiveInteger(value.version) ? value.version : 1,
    match: value.match as unknown as DraftTableDevData["match"],
    teams,
    maps,
    heroes,
    rules: {
      firstMapType: "CONTROL",
      mapTypesAfterControl: mapTypesAfterControl as Exclude<DraftMapType, "CONTROL">[],
      bansPerTeam: value.rules.bansPerTeam,
      roleBanLimit: value.rules.roleBanLimit,
    },
  };
}

const DEMO_TOURNAMENT_ID = 9001;
const DEMO_PHASE_STARTED_AT = "2026-08-22T00:00:00.000Z";
const DEMO_TURN_SECONDS = 95;

function getDemoMaps(data: DraftTableDevData): GameMap[] {
  return data.maps.map((map) => ({
    id: map.id,
    type: map.type,
    description: map.name,
    imgPath: map.image,
  }));
}

function getDemoHeroes(data: DraftTableDevData): Hero[] {
  return data.heroes.map((hero) => ({
    id: hero.id,
    name: hero.name,
    role: hero.role,
    imgPath: hero.image,
    heroGift: null,
  }));
}

export function createDraftTableDevTeams(data: DraftTableDevData): Team[] {
  return data.teams.map((team) => ({
    id: team.id,
    name: team.name,
    logo: team.logo,
    victories: 0,
    defeats: 0,
    mapWins: 0,
    mapLoses: 0,
    tournamentId: DEMO_TOURNAMENT_ID,
    state: "ACTIVE",
  }));
}

function getOtherTeamId(data: DraftTableDevData, teamId: number): number {
  const otherTeam = data.teams.find((team) => team.id !== teamId);
  if (!otherTeam) throw new Error("The demo fixture must contain an opposing team.");
  return otherTeam.id;
}

function getCurrentGame(state: DraftState): number {
  return (state.match.gameNumber || 0) + 1;
}

function nextTimestamp(): string {
  return new Date().toISOString();
}

function withDerivedDemoData(state: DraftState, data: DraftTableDevData): DraftState {
  const allMaps = getDemoMaps(data);
  const currentGame = getCurrentGame(state);
  const allowedMapTypes: MapType[] =
    currentGame === 1 ? [data.rules.firstMapType] : [...data.rules.mapTypesAfterControl];
  const pickedMaps = state.pickedMaps || [];
  const availableMapTypes = allowedMapTypes.filter((mapType) =>
    allMaps.some((map) => map.type === mapType && !pickedMaps.includes(map.id))
  );
  const availableMaps = state.selectedMapType
    ? allMaps.filter(
        (map) => map.type === state.selectedMapType && !pickedMaps.includes(map.id)
      )
    : [];

  return {
    ...state,
    remainingSeconds: DEMO_TURN_SECONDS,
    allowedMapTypes,
    availableMapTypes,
    availableMaps,
    allMaps,
    heroes: getDemoHeroes(data),
  };
}

export function createDraftTableDevState(data: DraftTableDevData): DraftState {
  return withDerivedDemoData(
    {
      id: data.match.id + 100_000,
      matchId: data.match.id,
      currentTurnTeamId: data.match.initialPickerTeamId,
      phase: "STARTING",
      phaseStartedAt: DEMO_PHASE_STARTED_AT,
      remainingSeconds: DEMO_TURN_SECONDS,
      actions: [],
      bannedHeroes: [],
      pickedMaps: [],
      currentMapId: null,
      selectedMapType: null,
      match: {
        id: data.match.id,
        type: "ROUNDROBIN",
        status: "SCHEDULED",
        bestOf: data.match.bestOf,
        startDate: DEMO_PHASE_STARTED_AT,
        tournamentId: DEMO_TOURNAMENT_ID,
        teamAId: data.teams[0].id,
        teamBId: data.teams[1].id,
        teamAready: 0,
        teamBready: 0,
        mapWinsTeamA: 0,
        mapWinsTeamB: 0,
        gameNumber: 0,
        semanas: 1,
        title: data.match.title,
        mapsAllowedByRound: { "1": data.maps.map((map) => map.id) },
        mapResults: [],
        mapStartedAt: null,
        mapTimerPaused: false,
        mapTimerPausedAt: null,
        pauseRequestedBy: null,
        pauseRequestedAt: null,
      },
    },
    data
  );
}

function assertDemoPhase(state: DraftState, phase: string): void {
  if (state.phase !== phase) {
    throw new Error(`The demo draft must be in ${phase} phase.`);
  }
}

function appendDemoAction(
  state: DraftState,
  action: Omit<DraftAction, "id" | "draftId" | "order" | "createdAt">
): DraftAction[] {
  const nextId = state.actions.reduce((max, item) => Math.max(max, item.id), 0) + 1;
  const nextOrder = state.actions.reduce((max, item) => Math.max(max, item.order), 0) + 1;
  return [
    ...state.actions,
    {
      ...action,
      id: nextId,
      draftId: state.id,
      order: nextOrder,
      createdAt: nextTimestamp(),
    },
  ];
}

export function startDraftTableDevMapPicking(
  state: DraftState,
  data: DraftTableDevData
): DraftState {
  const isFirstGame = getCurrentGame(state) === 1;
  return withDerivedDemoData(
    {
      ...state,
      phase: isFirstGame ? "MAPPICKING" : "MAPTYPEPICKING",
      phaseStartedAt: nextTimestamp(),
      currentMapId: null,
      selectedMapType: isFirstGame ? "CONTROL" : null,
      match: { ...state.match, status: "ACTIVE" },
    },
    data
  );
}

export function pickDraftTableDevMapType(
  state: DraftState,
  data: DraftTableDevData,
  mapType: MapType
): DraftState {
  assertDemoPhase(state, "MAPTYPEPICKING");
  const available = withDerivedDemoData(state, data).availableMapTypes || [];
  if (!available.includes(mapType)) throw new Error(`${mapType} is not available in the demo pool.`);
  return withDerivedDemoData(
    {
      ...state,
      phase: "MAPPICKING",
      selectedMapType: mapType,
      phaseStartedAt: nextTimestamp(),
    },
    data
  );
}

export function pickDraftTableDevMap(
  state: DraftState,
  data: DraftTableDevData,
  mapId: number
): DraftState {
  assertDemoPhase(state, "MAPPICKING");
  const map = getDemoMaps(data).find((candidate) => candidate.id === mapId);
  if (!map || map.type !== state.selectedMapType || state.pickedMaps.includes(mapId)) {
    throw new Error("That map is not available for the selected demo mode.");
  }
  if (!state.currentTurnTeamId) throw new Error("The demo draft has no active team.");
  const currentGame = getCurrentGame(state);
  const actions = appendDemoAction(state, {
    teamId: state.currentTurnTeamId,
    action: "PICK",
    value: mapId,
    gameNumber: currentGame,
  });
  return withDerivedDemoData(
    {
      ...state,
      actions,
      currentMapId: mapId,
      pickedMaps: [...state.pickedMaps, mapId],
      phaseStartedAt: nextTimestamp(),
    },
    data
  );
}

export function startDraftTableDevBans(
  state: DraftState,
  data: DraftTableDevData
): DraftState {
  assertDemoPhase(state, "MAPPICKING");
  const currentGame = getCurrentGame(state);
  const mapPick = state.actions.find(
    (action) => action.action === "PICK" && action.gameNumber === currentGame
  );
  if (!mapPick) throw new Error("Pick a demo map before opening bans.");
  return withDerivedDemoData(
    {
      ...state,
      phase: "BAN",
      currentTurnTeamId: mapPick.teamId,
      phaseStartedAt: nextTimestamp(),
    },
    data
  );
}

export function banDraftTableDevHero(
  state: DraftState,
  data: DraftTableDevData,
  heroId: number | null
): DraftState {
  assertDemoPhase(state, "BAN");
  if (!state.currentTurnTeamId) throw new Error("The demo draft has no active team.");
  const currentGame = getCurrentGame(state);
  const bans = state.actions.filter(
    (action) => action.action === "BAN" && action.gameNumber === currentGame
  );
  const teamBans = bans.filter((action) => action.teamId === state.currentTurnTeamId);
  if (teamBans.length >= data.rules.bansPerTeam) throw new Error("This team already used both bans.");

  if (heroId !== null) {
    const hero = getDemoHeroes(data).find((candidate) => candidate.id === heroId);
    if (!hero) throw new Error("Hero not found in the demo fixture.");
    if (bans.some((action) => action.value === heroId)) throw new Error("That hero is already banned.");
    const roleBans = bans.filter((action) => {
      const bannedHero = getDemoHeroes(data).find((candidate) => candidate.id === action.value);
      return bannedHero?.role === hero.role;
    });
    if (roleBans.length >= data.rules.roleBanLimit) {
      throw new Error(`The ${hero.role} role ban limit has been reached.`);
    }
  }

  const actingTeamId = state.currentTurnTeamId;
  const actions = appendDemoAction(state, {
    teamId: actingTeamId,
    action: "BAN",
    value: heroId,
    gameNumber: currentGame,
  });
  const totalBansAfter = bans.length + 1;
  return withDerivedDemoData(
    {
      ...state,
      actions,
      bannedHeroes:
        heroId === null ? state.bannedHeroes : [...state.bannedHeroes, heroId],
      currentTurnTeamId: getOtherTeamId(data, actingTeamId),
      phase: totalBansAfter >= data.rules.bansPerTeam * 2 ? "PLAYING" : "BAN",
      phaseStartedAt: nextTimestamp(),
    },
    data
  );
}

export function endDraftTableDevGame(
  state: DraftState,
  data: DraftTableDevData
): DraftState {
  assertDemoPhase(state, "PLAYING");
  return withDerivedDemoData(
    { ...state, phase: "ENDMAP", phaseStartedAt: nextTimestamp() },
    data
  );
}

export function submitDraftTableDevResult(
  state: DraftState,
  data: DraftTableDevData,
  winnerTeamId: number | null
): DraftState {
  assertDemoPhase(state, "ENDMAP");
  const currentGame = getCurrentGame(state);
  const teamAId = state.match.teamAId;
  const teamBId = state.match.teamBId;
  const nextWinsA = state.match.mapWinsTeamA + (winnerTeamId === teamAId ? 1 : 0);
  const nextWinsB = state.match.mapWinsTeamB + (winnerTeamId === teamBId ? 1 : 0);
  const requiredWins = Math.floor(state.match.bestOf / 2) + 1;
  const isFinished = nextWinsA >= requiredWins || nextWinsB >= requiredWins;
  const pick = state.actions.find(
    (action) => action.action === "PICK" && action.gameNumber === currentGame
  );
  const nextTurnTeamId = winnerTeamId
    ? getOtherTeamId(data, winnerTeamId)
    : getOtherTeamId(data, pick?.teamId || teamAId);
  const mapResults = [
    ...(state.match.mapResults || []),
    {
      gameNumber: currentGame,
      mapId: state.currentMapId,
      winnerTeamId,
      isDraw: winnerTeamId === null,
    },
  ];

  return withDerivedDemoData(
    {
      ...state,
      phase: isFinished ? "FINISHED" : "STARTING",
      phaseStartedAt: nextTimestamp(),
      currentMapId: null,
      selectedMapType: null,
      currentTurnTeamId: isFinished ? null : nextTurnTeamId,
      match: {
        ...state.match,
        status: isFinished ? "FINISHED" : "ACTIVE",
        mapWinsTeamA: nextWinsA,
        mapWinsTeamB: nextWinsB,
        gameNumber: currentGame,
        teamAready: 0,
        teamBready: 0,
        mapResults,
      },
    },
    data
  );
}

export function readyNextDraftTableDevCaptain(
  state: DraftState,
  data: DraftTableDevData
): DraftState {
  const match = state.match.teamAready === 0
    ? { ...state.match, teamAready: 1 }
    : { ...state.match, teamBready: 1 };
  return withDerivedDemoData({ ...state, match }, data);
}

export function yieldDraftTableDevFirstPick(
  state: DraftState,
  data: DraftTableDevData
): DraftState {
  if (!state.currentTurnTeamId) return state;
  return withDerivedDemoData(
    { ...state, currentTurnTeamId: getOtherTeamId(data, state.currentTurnTeamId) },
    data
  );
}

export function undoDraftTableDevResult(
  state: DraftState,
  data: DraftTableDevData
): DraftState {
  const results = state.match.mapResults || [];
  const lastResult = results[results.length - 1];
  if (!lastResult) return state;
  const map = getDemoMaps(data).find((candidate) => candidate.id === lastResult.mapId);
  return withDerivedDemoData(
    {
      ...state,
      phase: "ENDMAP",
      currentMapId: lastResult.mapId,
      selectedMapType: map?.type || null,
      currentTurnTeamId: null,
      match: {
        ...state.match,
        status: "ACTIVE",
        gameNumber: Math.max(0, state.match.gameNumber - 1),
        mapWinsTeamA:
          lastResult.winnerTeamId === state.match.teamAId
            ? Math.max(0, state.match.mapWinsTeamA - 1)
            : state.match.mapWinsTeamA,
        mapWinsTeamB:
          lastResult.winnerTeamId === state.match.teamBId
            ? Math.max(0, state.match.mapWinsTeamB - 1)
            : state.match.mapWinsTeamB,
        mapResults: results.slice(0, -1),
      },
    },
    data
  );
}
