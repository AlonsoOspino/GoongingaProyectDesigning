"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiRequest } from "@/lib/api/client";
import type { MemberProfile } from "@/lib/api/types";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { clsx } from "clsx";

type TeamId = "alpha" | "beta";
type ViewMode = "manager" | "user";
type RoundPhase = "lobby" | "question" | "faceoff" | "control" | "steal" | "round-over";
type AnswerKind = "info" | "success" | "danger";
type GuessSource = "manager" | "player";

type QuestionAnswer = {
  word: string;
  points: number;
};

type Question = {
  id: string;
  prompt: string;
  multiplier: number;
  answers: QuestionAnswer[];
};

type Participant = {
  id: string;
  memberId: number | null;
  name: string;
  profilePic: string | null;
  joinedAt: number;
  lastSeenAt: number;
  cooldownUntilRound: number;
};

type Team = {
  id: TeamId;
  name: string;
  logoUrl: string | null;
  captainId: string | null;
  inviteToken: string;
  score: number;
  players: Participant[];
};

type RoundLog = {
  id: string;
  label: string;
  kind: AnswerKind;
};

type BoardAnswer = QuestionAnswer & {
  revealed: boolean;
};

type PendingGuess = {
  id: string;
  teamId: TeamId;
  playerId: string | null;
  word: string;
  source: GuessSource;
  createdAt: number;
};

type RoundState = {
  number: number;
  phase: RoundPhase;
  preparedQuestionIndex: number;
  activeQuestionIndex: number | null;
  multiplier: number;
  controllingTeamId: TeamId | null;
  starterTeamId: TeamId | null;
  starterPlayerId: string | null;
  faceoffPlayerIds: Record<TeamId, string | null>;
  faceoffAttempts: Record<TeamId, boolean>;
  faceoffBestTeamId: TeamId | null;
  faceoffBestAnswerIndex: number | null;
  activeGuessTeamId: TeamId | null;
  pendingGuess: PendingGuess | null;
  roundPoints: number;
  board: BoardAnswer[];
  teamStrikes: Record<TeamId, number>;
  stealGuess: string;
  logs: RoundLog[];
};

type RoomState = {
  roomId: string;
  title: string;
  gameStarted: boolean;
  generatedAt: number;
  updatedAt: number;
  questions: Question[];
  teams: Record<TeamId, Team>;
  round: RoundState;
};

type IdentityRecord = {
  participantId: string;
  name: string;
  teamId: TeamId;
  inviteToken: string;
};

const ROOM_STORAGE_KEY = "goon.minigames.room";
const ROOM_ID_STORAGE_KEY = "goon.minigames.roomId";
const IDENTITY_STORAGE_PREFIX = "goon.minigames.identity.";
const DELETE_CONFIRMATION_TEXT = "DELETE GAME";
const PLAYER_TTL_MS = 45000;
const HEARTBEAT_INTERVAL_MS = 4000;
const MAX_PLAYERS_PER_TEAM = 5;
const MAX_STRIKES_PER_QUESTION = 3;
const COOLDOWN_ROUNDS = MAX_PLAYERS_PER_TEAM;
const MAX_BOARD_ANSWERS = 8;
const POINTS_PER_SURVEY_RESPONSE = 100;

const DEFAULT_QUESTIONS: Question[] = [
  {
    id: "inflate",
    prompt: "Name something that can be inflated or deflated.",
    multiplier: 1,
    answers: [
      { word: "Tire", points: 42 },
      { word: "Balloon", points: 31 },
      { word: "Life jacket", points: 12 },
      { word: "Air mattress", points: 9 },
      { word: "Bicycle tube", points: 6 },
    ],
  },
  {
    id: "late",
    prompt: "Name a reason somebody gets to practice late.",
    multiplier: 1,
    answers: [
      { word: "Traffic", points: 39 },
      { word: "Overslept", points: 28 },
      { word: "Work", points: 14 },
      { word: "Forgot", points: 11 },
      { word: "Battery dead", points: 8 },
    ],
  },
  {
    id: "tilt",
    prompt: "Name something players blame first after a rough match.",
    multiplier: 2,
    answers: [
      { word: "Lag", points: 36 },
      { word: "Teammates", points: 25 },
      { word: "Ping", points: 18 },
      { word: "Toxic chat", points: 13 },
      { word: "Matchmaking", points: 8 },
    ],
  },
  {
    id: "boost",
    prompt: "Name something you would bring to a hype watch party.",
    multiplier: 2,
    answers: [
      { word: "Snacks", points: 34 },
      { word: "Energy drink", points: 24 },
      { word: "Controller", points: 15 },
      { word: "Mic", points: 11 },
      { word: "Team jersey", points: 10 },
    ],
  },
  {
    id: "secret",
    prompt: "Name a place to hide a secret strategy.",
    multiplier: 3,
    answers: [
      { word: "Notebook", points: 30 },
      { word: "Discord DM", points: 27 },
      { word: "Sticky note", points: 16 },
      { word: "Clipboard", points: 15 },
      { word: "Whiteboard", points: 12 },
    ],
  },
];

function now() {
  return Date.now();
}

function makeId() {
  return crypto.randomUUID();
}

function makeToken() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function getQuestionBoard(question: Question): BoardAnswer[] {
  const answers = [...question.answers]
    .filter((answer) => answer.word.trim().length > 0 && answer.points > 0)
    .sort((left, right) => right.points - left.points)
    .slice(0, MAX_BOARD_ANSWERS);

  return Array.from({ length: MAX_BOARD_ANSWERS }).map((_, index) => ({
    word: answers[index]?.word ?? "",
    points: answers[index]?.points ?? 0,
    revealed: false,
  }));
}

function isFilledAnswer(answer: QuestionAnswer) {
  return answer.word.trim().length > 0 && answer.points > 0;
}

function scoreAnswer(answer: QuestionAnswer, multiplier: number) {
  return answer.points * POINTS_PER_SURVEY_RESPONSE * multiplier;
}

function createParticipant(name = "", member?: MemberProfile | null) {
  const createdAt = now();
  return {
    id: makeId(),
    memberId: member?.id ?? null,
    name,
    profilePic: member?.profilePic ?? null,
    joinedAt: createdAt,
    lastSeenAt: createdAt,
    cooldownUntilRound: 0,
  } satisfies Participant;
}

function createTeam(id: TeamId, name: string, inviteToken: string): Team {
  return {
    id,
    name,
    logoUrl: null,
    captainId: null,
    inviteToken,
    score: 0,
    players: [],
  };
}

function createRoundState(): RoundState {
  return {
    number: 0,
    phase: "lobby",
    preparedQuestionIndex: 0,
    activeQuestionIndex: null,
    multiplier: 1,
    controllingTeamId: null,
    starterTeamId: null,
    starterPlayerId: null,
    faceoffPlayerIds: { alpha: null, beta: null },
    faceoffAttempts: { alpha: false, beta: false },
    faceoffBestTeamId: null,
    faceoffBestAnswerIndex: null,
    activeGuessTeamId: null,
    pendingGuess: null,
    roundPoints: 0,
    board: [],
    teamStrikes: { alpha: 0, beta: 0 },
    stealGuess: "",
    logs: [
      {
        id: makeId(),
        label: "Generate the secret links to start the room.",
        kind: "info",
      },
    ],
  };
}

function createRoomState(): RoomState {
  const generatedAt = now();
  return {
    roomId: makeToken(),
    title: "Family Feud Arcade",
    gameStarted: false,
    generatedAt,
    updatedAt: generatedAt,
    questions: DEFAULT_QUESTIONS,
    teams: {
      alpha: createTeam("alpha", "Team Alpha", makeToken()),
      beta: createTeam("beta", "Team Beta", makeToken()),
    },
    round: createRoundState(),
  };
}

function createFreshRoomState() {
  const room = createRoomState();
  return {
    ...room,
    round: {
      ...room.round,
      preparedQuestionIndex: 0,
      board: [],
    },
  } satisfies RoomState;
}

function hydrateRoomState(room: RoomState): RoomState {
  const baseline = createFreshRoomState();
  const round = room.round ?? baseline.round;
  const teams = room.teams ?? baseline.teams;

  return {
    ...baseline,
    ...room,
    gameStarted: Boolean(room.gameStarted),
    teams: {
      alpha: {
        ...baseline.teams.alpha,
        ...teams.alpha,
        players: (teams.alpha?.players ?? []).map((player) => ({
          ...player,
          memberId: player.memberId ?? null,
          profilePic: player.profilePic ?? null,
        })),
      },
      beta: {
        ...baseline.teams.beta,
        ...teams.beta,
        players: (teams.beta?.players ?? []).map((player) => ({
          ...player,
          memberId: player.memberId ?? null,
          profilePic: player.profilePic ?? null,
        })),
      },
    },
    round: {
      ...baseline.round,
      ...round,
      faceoffPlayerIds: {
        alpha: round.faceoffPlayerIds?.alpha ?? null,
        beta: round.faceoffPlayerIds?.beta ?? null,
      },
      faceoffAttempts: {
        alpha: Boolean(round.faceoffAttempts?.alpha),
        beta: Boolean(round.faceoffAttempts?.beta),
      },
      faceoffBestTeamId: round.faceoffBestTeamId ?? null,
      faceoffBestAnswerIndex: round.faceoffBestAnswerIndex ?? null,
      pendingGuess: round.pendingGuess ?? null,
      board: (round.board ?? []).map((answer) => ({
        ...answer,
        word: answer.word ?? "",
        points: Number(answer.points) || 0,
        revealed: Boolean(answer.revealed),
      })),
      teamStrikes: {
        alpha: Number(round.teamStrikes?.alpha) || 0,
        beta: Number(round.teamStrikes?.beta) || 0,
      },
    },
  };
}

type QuestionDraft = Question & {
  answers: QuestionAnswer[];
};

function createDraftQuestion(index: number): QuestionDraft {
  return {
    id: makeId(),
    prompt: index === 0 ? "Name something worth points on the board." : "",
    multiplier: 1,
    answers: Array.from({ length: MAX_BOARD_ANSWERS }).map(() => ({ word: "", points: 0 })),
  };
}

function createDraftQuestions() {
  return [createDraftQuestion(0)];
}

function createRoomFromDraft(title: string, questions: QuestionDraft[]): RoomState {
  const generatedAt = now();
  const normalizedQuestions = questions
    .map((question) => ({
      ...question,
      prompt: question.prompt.trim(),
      multiplier: Number.isFinite(question.multiplier) && question.multiplier > 0 ? question.multiplier : 1,
      answers: question.answers
        .map((answer) => ({
          word: answer.word.trim(),
          points: Number.isFinite(answer.points) && answer.points > 0 ? Math.round(answer.points) : 0,
        }))
        .filter((answer) => answer.word.length > 0 && answer.points > 0),
    }))
    .filter((question) => question.prompt.length > 0)
    .map((question) => ({
      ...question,
      answers: question.answers.length > 0 ? question.answers : [{ word: "Placeholder", points: 1 }],
    }));

  const roomQuestions = normalizedQuestions.length > 0 ? normalizedQuestions : DEFAULT_QUESTIONS;

  return {
    roomId: makeToken(),
    title: title.trim() || "Family Feud Arcade",
    gameStarted: false,
    generatedAt,
    updatedAt: generatedAt,
    questions: roomQuestions,
    teams: {
      alpha: createTeam("alpha", "Team Alpha", makeToken()),
      beta: createTeam("beta", "Team Beta", makeToken()),
    },
    round: createRoundState(),
  };
}

function readStoredRoom(): RoomState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ROOM_STORAGE_KEY);
    if (!raw) return null;
    return hydrateRoomState(JSON.parse(raw) as RoomState);
  } catch {
    return null;
  }
}

function writeStoredRoom(room: RoomState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ROOM_STORAGE_KEY, JSON.stringify(room));
  window.localStorage.setItem(ROOM_ID_STORAGE_KEY, room.roomId);
}

function readStoredRoomId() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(ROOM_ID_STORAGE_KEY) || "";
}

function readIdentity(inviteToken: string): IdentityRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${IDENTITY_STORAGE_PREFIX}${inviteToken}`);
    return raw ? (JSON.parse(raw) as IdentityRecord) : null;
  } catch {
    return null;
  }
}

function writeIdentity(record: IdentityRecord) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${IDENTITY_STORAGE_PREFIX}${record.inviteToken}`, JSON.stringify(record));
}

function clearIdentity(inviteToken: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(`${IDENTITY_STORAGE_PREFIX}${inviteToken}`);
}

function clearStoredRoom() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ROOM_STORAGE_KEY);
  window.localStorage.removeItem(ROOM_ID_STORAGE_KEY);
}

type FamilyFeudGamePayload = {
  state: RoomState;
};

async function createRemoteRoom(room: RoomState) {
  const payload = await apiRequest<FamilyFeudGamePayload>("/family-feud/games", {
    method: "POST",
    body: { state: room },
  });
  return hydrateRoomState(payload.state);
}

async function fetchRemoteRoom(roomId: string) {
  const payload = await apiRequest<FamilyFeudGamePayload>(`/family-feud/games/${encodeURIComponent(roomId)}`, {
    cache: "no-store",
  });
  return hydrateRoomState(payload.state);
}

async function fetchRemoteInvite(inviteToken: string) {
  const payload = await apiRequest<FamilyFeudGamePayload>(`/family-feud/invite/${encodeURIComponent(inviteToken)}`, {
    cache: "no-store",
  });
  return hydrateRoomState(payload.state);
}

async function updateRemoteRoom(room: RoomState) {
  const payload = await apiRequest<FamilyFeudGamePayload>(`/family-feud/games/${encodeURIComponent(room.roomId)}`, {
    method: "PUT",
    body: { state: room },
  });
  return hydrateRoomState(payload.state);
}

async function deleteRemoteRoom(roomId: string) {
  await apiRequest(`/family-feud/games/${encodeURIComponent(roomId)}`, {
    method: "DELETE",
  });
}

function clearRoomIdentities(room: RoomState | null) {
  if (!room) return;
  clearIdentity(room.teams.alpha.inviteToken);
  clearIdentity(room.teams.beta.inviteToken);
}

function encodeRoomSnapshot(room: RoomState) {
  if (typeof window === "undefined") return "";
  return window.btoa(unescape(encodeURIComponent(JSON.stringify(room))));
}

function decodeRoomSnapshot(snapshot: string) {
  if (typeof window === "undefined") return null;
  try {
    const json = decodeURIComponent(window.atob(snapshot).split("").map((character) => `%${character.charCodeAt(0).toString(16).padStart(2, "0")}`).join(""));
    return JSON.parse(json) as RoomState;
  } catch {
    return null;
  }
}

function roomFromInvite(room: RoomState | null, inviteToken: string) {
  if (!room) return null;
  if (room.teams.alpha.inviteToken === inviteToken) return { room, teamId: "alpha" as const };
  if (room.teams.beta.inviteToken === inviteToken) return { room, teamId: "beta" as const };
  return null;
}

function otherTeam(teamId: TeamId): TeamId {
  return teamId === "alpha" ? "beta" : "alpha";
}

function teamLabel(teamId: TeamId) {
  return teamId === "alpha" ? "Team Alpha" : "Team Beta";
}

function findQuestionByIndex(room: RoomState, index: number | null) {
  if (index === null) return null;
  return room.questions[index] ?? null;
}

function cleanupRoom(room: RoomState): RoomState {
  const cutoff = now() - PLAYER_TTL_MS;
  let changed = false;
  const hydrated = hydrateRoomState(room);
  const nextTeams = { ...hydrated.teams };
  const nextFaceoffPlayerIds = { ...hydrated.round.faceoffPlayerIds };

  for (const teamId of ["alpha", "beta"] as TeamId[]) {
    const team = hydrated.teams[teamId];
    const players = team.players.filter((player) => player.lastSeenAt >= cutoff);
    const selectedPlayerStillThere = nextFaceoffPlayerIds[teamId]
      ? players.some((player) => player.id === nextFaceoffPlayerIds[teamId])
      : true;

    if (players.length !== team.players.length || !selectedPlayerStillThere) {
      changed = true;
    }

    if (!selectedPlayerStillThere) {
      nextFaceoffPlayerIds[teamId] = null;
    }

    nextTeams[teamId] = {
      ...team,
      players,
    };
  }

  const starterTeam = hydrated.round.starterTeamId;
  const starterPlayerGone = starterTeam
    ? !nextTeams[starterTeam].players.some((player) => player.id === hydrated.round.starterPlayerId)
    : false;
  const pendingGuessPlayerGone = hydrated.round.pendingGuess?.playerId
    ? !nextTeams[hydrated.round.pendingGuess.teamId].players.some((player) => player.id === hydrated.round.pendingGuess?.playerId)
    : false;

  if (!changed && !starterPlayerGone && !pendingGuessPlayerGone) return hydrated;

  return {
    ...hydrated,
    updatedAt: now(),
    teams: nextTeams,
    round: starterPlayerGone || pendingGuessPlayerGone
      ? {
          ...hydrated.round,
          faceoffPlayerIds: nextFaceoffPlayerIds,
          starterTeamId: starterPlayerGone ? null : hydrated.round.starterTeamId,
          starterPlayerId: starterPlayerGone ? null : hydrated.round.starterPlayerId,
          activeGuessTeamId: starterPlayerGone ? null : hydrated.round.activeGuessTeamId,
          pendingGuess: pendingGuessPlayerGone ? null : hydrated.round.pendingGuess,
          logs: [createLog("A selected player disconnected. Review the current round before continuing.", "danger"), ...hydrated.round.logs],
        }
      : {
          ...hydrated.round,
          faceoffPlayerIds: nextFaceoffPlayerIds,
        },
  };
}

function formatInviteUrl(inviteToken: string, room?: RoomState | null) {
  if (typeof window === "undefined") return `/minigames?invite=${inviteToken}`;
  const params = new URLSearchParams({ invite: inviteToken, view: "user" });
  if (room) {
    params.set("game", room.roomId);
  }
  return `${window.location.origin}/minigames?${params.toString()}`;
}

function isParticipantLocked(participant: Participant, currentRound: number) {
  return participant.cooldownUntilRound > currentRound;
}

function createLog(label: string, kind: AnswerKind): RoundLog {
  return { id: makeId(), label, kind };
}

function copyToClipboard(text: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard) return Promise.reject(new Error("Clipboard not available."));
  return navigator.clipboard.writeText(text);
}

function findMemberForName(members: MemberProfile[], name: string) {
  const normalizedName = normalize(name);
  if (!normalizedName) return null;
  return members.find((member) => normalize(member.nickname) === normalizedName || normalize(member.user) === normalizedName) ?? null;
}

function getParticipant(room: RoomState, teamId: TeamId | null, playerId: string | null) {
  if (!teamId || !playerId) return null;
  return room.teams[teamId].players.find((player) => player.id === playerId) ?? null;
}

function getPendingGuessPlayer(room: RoomState, guess: PendingGuess | null) {
  if (!guess?.playerId) return null;
  return getParticipant(room, guess.teamId, guess.playerId);
}

function Panel({ title, eyebrow, children, footer }: { title: string; eyebrow?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <Card variant="featured" className="h-full">
      <CardHeader className="space-y-2">
        {eyebrow ? <div className="text-xs uppercase tracking-[0.32em] text-primary/80">{eyebrow}</div> : null}
        <CardTitle className="font-[family-name:var(--font-league-gothic)] text-3xl uppercase tracking-[0.14em] text-white">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
      {footer ? <CardFooter>{footer}</CardFooter> : null}
    </Card>
  );
}

function TeamPlayers({ team, currentRound, onPick, selectedPlayerId, disabled }: { team: Team; currentRound: number; onPick: (playerId: string) => void; selectedPlayerId: string | null; disabled?: boolean; }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: MAX_PLAYERS_PER_TEAM }).map((_, index) => {
        const player = team.players[index];
        const locked = player ? isParticipantLocked(player, currentRound) : false;
        return (
          <button
            key={`${team.id}-${index}`}
            type="button"
            disabled={!player || locked || disabled}
            onClick={() => player && onPick(player.id)}
            className={clsx(
              "flex w-full items-center justify-between rounded-md border px-3 py-2 text-left transition-colors",
              player
                ? selectedPlayerId === player.id
                  ? "border-primary bg-primary/10 text-white"
                  : "border-border bg-surface/70 hover:border-border/80"
                : "border-dashed border-border/60 bg-surface/30 text-muted-foreground",
              (locked || disabled) && "opacity-60"
            )}
            >
            <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
              {player ? <Avatar size="sm" src={player.profilePic ?? undefined} fallback={player.name} alt={player.name} /> : null}
              <span className="truncate">{player ? player.name : `Open slot ${index + 1}`}</span>
            </span>
            {player ? (
              <span className="text-xs text-muted-foreground">
                {locked ? `Bench until round ${player.cooldownUntilRound}` : "Ready"}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function FaceoffSlot({ label, team, participant }: { label: string; team: Team; participant: Participant | null }) {
  return (
    <div className="rounded-xl border border-border bg-surface/70 p-3">
      <div className="text-xs uppercase tracking-[0.26em] text-muted-foreground">{label}</div>
      <div className="mt-3 flex items-center gap-3">
        <Avatar size="lg" src={participant?.profilePic ?? team.logoUrl ?? undefined} fallback={participant?.name || team.name} alt={participant?.name || team.name} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">{participant?.name || "Waiting..."}</div>
          <div className="truncate text-xs text-muted-foreground">{team.name}</div>
        </div>
      </div>
    </div>
  );
}

function BoardGrid({ room }: { room: RoomState }) {
  const question = findQuestionByIndex(room, room.round.activeQuestionIndex);
  const alphaFaceoff = getParticipant(room, "alpha", room.round.faceoffPlayerIds.alpha);
  const betaFaceoff = getParticipant(room, "beta", room.round.faceoffPlayerIds.beta);
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-black/35 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="primary">Round {room.round.number || 1}</Badge>
          <Badge variant="outline">{room.round.phase.replace("-", " ")}</Badge>
          <Badge variant="secondary">x{room.round.multiplier} points</Badge>
          <Badge variant="warning">3 strikes max</Badge>
          <Badge variant={room.gameStarted ? "success" : "warning"}>{room.gameStarted ? "Game started" : "Waiting room"}</Badge>
        </div>
        <div className="mt-4 grid items-center gap-3 lg:grid-cols-[190px_1fr_190px]">
          <FaceoffSlot label="Left podium" team={room.teams.alpha} participant={alphaFaceoff} />
          <div className="space-y-2 text-center">
            <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Current question</div>
            <h3 className="font-[family-name:var(--font-league-gothic)] text-4xl uppercase leading-none tracking-[0.08em] text-white md:text-5xl">
              {question?.prompt || "Waiting for the next question"}
            </h3>
            {room.round.pendingGuess ? (
              <div className="mx-auto mt-3 max-w-xl rounded-xl border border-primary/35 bg-primary/10 px-4 py-3 text-sm text-primary">
                {teamLabel(room.round.pendingGuess.teamId)} answered "{room.round.pendingGuess.word}".
              </div>
            ) : null}
          </div>
          <FaceoffSlot label="Right podium" team={room.teams.beta} participant={betaFaceoff} />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {room.round.board.length > 0 ? room.round.board.map((answer, index) => (
          <div
            key={`${answer.word}-${index}`}
            className={clsx(
              "flex items-center justify-between rounded-xl border px-4 py-3",
              answer.revealed ? "border-success/30 bg-success/10" : "border-border bg-surface/70"
            )}
          >
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Answer {index + 1}</div>
              <div className="text-lg font-semibold text-white">
                {answer.revealed && isFilledAnswer(answer) ? answer.word : "Hidden"}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Points</div>
              <div className="text-xl font-bold text-primary">
                {answer.revealed && isFilledAnswer(answer) ? scoreAnswer(answer, room.round.multiplier) : "X"}
              </div>
            </div>
          </div>
        )) : (
          <div className="md:col-span-2 rounded-xl border border-dashed border-border/60 bg-surface/50 px-4 py-8 text-center text-sm text-muted-foreground">
            The board will populate after the manager starts a round.
          </div>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {(Object.entries(room.teams) as Array<[TeamId, Team]>).map(([teamId, team]) => (
          <div key={teamId} className="rounded-xl border border-border bg-surface/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{teamLabel(teamId)}</div>
                <div className="font-[family-name:var(--font-league-gothic)] text-3xl uppercase tracking-[0.12em] text-white">
                  {team.name}
                </div>
              </div>
              <Badge variant={teamId === "alpha" ? "primary" : "secondary"}>{team.score} pts</Badge>
            </div>
            <div className="mt-4 flex gap-2">
              {Array.from({ length: MAX_STRIKES_PER_QUESTION }).map((_, index) => (
                <span
                  key={`${teamId}-strike-${index}`}
                  className={clsx(
                    "h-3 w-3 rounded-full border",
                    index < room.round.teamStrikes[teamId]
                      ? "border-danger bg-danger"
                      : "border-border bg-transparent"
                  )}
                />
              ))}
            </div>
            <div className="mt-4 text-sm text-muted-foreground">
              {team.players.length} / {MAX_PLAYERS_PER_TEAM} players connected
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2 rounded-xl border border-border bg-black/25 p-4">
        <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Round log</div>
        <div className="space-y-2">
          {room.round.logs.length > 0 ? room.round.logs.map((entry) => (
            <div key={entry.id} className={clsx("rounded-lg border px-3 py-2 text-sm", {
              "border-primary/30 bg-primary/10 text-primary": entry.kind === "success",
              "border-danger/30 bg-danger/10 text-danger": entry.kind === "danger",
              "border-border bg-surface/60 text-foreground": entry.kind === "info",
            })}>
              {entry.label}
            </div>
          )) : (
            <div className="rounded-lg border border-dashed border-border/60 px-3 py-4 text-sm text-muted-foreground">
              Round actions will appear here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MinigamesPage() {
  const searchParams = useSearchParams();
  const inviteToken = (searchParams?.get("invite") || "").trim().toUpperCase();
  const initialViewMode = inviteToken ? "user" : (searchParams?.get("view") === "user" ? "user" : "manager");
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [draftTitle, setDraftTitle] = useState("Family Feud Arcade");
  const [draftQuestions, setDraftQuestions] = useState<QuestionDraft[]>(() => createDraftQuestions());
  const [joinName, setJoinName] = useState("");
  const [captainTeamName, setCaptainTeamName] = useState("");
  const [captainTeamLogo, setCaptainTeamLogo] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState<TeamId | null>(null);
  const [stealGuess, setStealGuess] = useState("");
  const [managerGuess, setManagerGuess] = useState("");
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const activeInviteTarget = useMemo(() => roomFromInvite(room, inviteToken), [room, inviteToken]);
  const activeTeam = activeInviteTarget?.teamId ?? null;
  const activeQuestion = useMemo(() => findQuestionByIndex(room ?? createFreshRoomState(), room?.round.activeQuestionIndex ?? null), [room]);
  const currentRoundNumber = room?.round.number || 0;

  const saveRoom = useCallback((updater: (current: RoomState) => RoomState) => {
    setRoom((current) => {
      const base = current ? hydrateRoomState(current) : createFreshRoomState();
      const next = cleanupRoom(updater(base));
      writeStoredRoom(next);
      window.setTimeout(() => {
        void updateRemoteRoom(next)
          .then((remoteRoom) => {
            writeStoredRoom(remoteRoom);
            setSyncFeedback(null);
          })
          .catch((error) => {
            setSyncFeedback(error instanceof Error ? error.message : "Backend sync failed; using local state for now.");
          });
      }, 0);
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadRoom() {
      const stored = readStoredRoom();
      const gameId = (searchParams?.get("game") || readStoredRoomId()).trim();
      let nextRoom: RoomState | null = null;

      try {
        if (inviteToken) {
          nextRoom = await fetchRemoteInvite(inviteToken);
        } else if (gameId) {
          nextRoom = await fetchRemoteRoom(gameId);
        }
      } catch (error) {
        nextRoom = stored;
        setSyncFeedback(error instanceof Error ? error.message : "Could not reach the Family Feud backend.");
      }

      if (cancelled) return;

      if (nextRoom) {
        const hydratedRoom = hydrateRoomState(nextRoom);
        writeStoredRoom(hydratedRoom);
        setDraftTitle(hydratedRoom.title);
        setDraftQuestions(hydratedRoom.questions.map((question) => ({ ...question })));
        const invitedMatch = inviteToken ? roomFromInvite(hydratedRoom, inviteToken) : null;
        const invitedTeam = invitedMatch ? invitedMatch.room.teams[invitedMatch.teamId] : null;
        setCaptainTeamName(invitedTeam?.name || "");
        setCaptainTeamLogo(invitedTeam?.logoUrl || "");
        setRoom(hydratedRoom);
      } else {
        setDraftTitle("Family Feud Arcade");
        setDraftQuestions(createDraftQuestions());
        setCaptainTeamName("");
        setCaptainTeamLogo("");
        setRoom(null);
      }

      setLoaded(true);
    }

    void loadRoom();
    return () => {
      cancelled = true;
    };
  }, [inviteToken, searchParams]);

  useEffect(() => {
    if (!loaded || !room) return;
    let cancelled = false;

    const syncFromStorage = () => {
      const stored = readStoredRoom();
      if (!stored) {
        return;
      }
      setRoom(hydrateRoomState(stored));
    };

    const syncFromBackend = async () => {
      try {
        const next = inviteToken ? await fetchRemoteInvite(inviteToken) : await fetchRemoteRoom(room.roomId);
        if (cancelled) return;
        writeStoredRoom(next);
        setRoom(next);
        setSyncFeedback(null);
      } catch (error) {
        if (!cancelled) {
          setSyncFeedback(error instanceof Error ? error.message : "Could not refresh Family Feud game state.");
        }
      }
    };

    const interval = window.setInterval(() => {
      void syncFromBackend();
    }, 2000);

    window.addEventListener("storage", syncFromStorage);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", syncFromStorage);
      window.clearInterval(interval);
    };
  }, [inviteToken, loaded, room?.roomId]);

  useEffect(() => {
    if (!inviteToken || !room) return;
    const inviteMatch = roomFromInvite(room, inviteToken);
    if (inviteMatch) {
      const identity = readIdentity(inviteToken);
      if (identity) {
        setJoinName(identity.name);
      }
    }
  }, [inviteToken, room]);

  useEffect(() => {
    let cancelled = false;
    async function loadMembers() {
      try {
        const allMembers = await apiRequest<MemberProfile[]>("/member/all", { cache: "no-store" });
        if (!cancelled) setMembers(allMembers);
      } catch {
        if (!cancelled) setMembers([]);
      }
    }

    void loadMembers();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!room || !inviteToken) return;
    const identity = readIdentity(inviteToken);
    if (identity && room.teams[identity.teamId].inviteToken === inviteToken) {
      setJoinName(identity.name);
      setSelectedTeamId(identity.teamId);
    }
  }, [inviteToken, room]);

  useEffect(() => {
    if (!inviteToken || viewMode !== "user") return;
    const beforeUnload = () => {
      const identity = readIdentity(inviteToken);
      if (!identity) return;
      saveRoom((current) => {
        const team = current.teams[identity.teamId];
        return {
          ...current,
          updatedAt: now(),
          teams: {
            ...current.teams,
            [identity.teamId]: {
              ...team,
              players: team.players.filter((player) => player.id !== identity.participantId),
            },
          },
        };
      });
      clearIdentity(inviteToken);
    };

    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [inviteToken, saveRoom, viewMode]);

  const updateRoom = useCallback((updater: (current: RoomState) => RoomState) => {
    saveRoom(updater);
  }, [saveRoom]);

  const handleAddDraftQuestion = useCallback(() => {
    setDraftQuestions((current) => [...current, createDraftQuestion(current.length)]);
  }, []);

  const handleUpdateDraftQuestion = useCallback((index: number, updater: (question: QuestionDraft) => QuestionDraft) => {
    setDraftQuestions((current) => current.map((question, questionIndex) => (questionIndex === index ? updater(question) : question)));
  }, []);

  const handleAddDraftAnswer = useCallback((questionIndex: number) => {
    handleUpdateDraftQuestion(questionIndex, (question) => ({
      ...question,
      answers: [...question.answers, { word: "", points: 0 }],
    }));
  }, [handleUpdateDraftQuestion]);

  const handleRemoveDraftAnswer = useCallback((questionIndex: number, answerIndex: number) => {
    handleUpdateDraftQuestion(questionIndex, (question) => ({
      ...question,
      answers: question.answers.filter((_, index) => index !== answerIndex),
    }));
  }, [handleUpdateDraftQuestion]);

  const handleUpdateDraftAnswer = useCallback((questionIndex: number, answerIndex: number, nextAnswer: Partial<QuestionAnswer>) => {
    handleUpdateDraftQuestion(questionIndex, (question) => ({
      ...question,
      answers: question.answers.map((answer, index) => (index === answerIndex ? { ...answer, ...nextAnswer } : answer)),
    }));
  }, [handleUpdateDraftQuestion]);

  const handleRemoveDraftQuestion = useCallback((questionIndex: number) => {
    setDraftQuestions((current) => {
      if (current.length <= 1) return current;
      return current.filter((_, index) => index !== questionIndex);
    });
  }, []);

  const handleUpdateDraftQuestionFields = useCallback((questionIndex: number, nextFields: Partial<QuestionDraft>) => {
    handleUpdateDraftQuestion(questionIndex, (question) => ({ ...question, ...nextFields }));
  }, [handleUpdateDraftQuestion]);

  const handleCreateGame = useCallback(async () => {
    const next = createRoomFromDraft(draftTitle, draftQuestions);
    let savedRoom = next;
    try {
      savedRoom = await createRemoteRoom(next);
      setSyncFeedback(null);
    } catch (error) {
      setSyncFeedback(error instanceof Error ? error.message : "Backend sync failed; created a local-only game.");
    }
    writeStoredRoom(savedRoom);
    setRoom(savedRoom);
    setJoinName("");
    setCaptainTeamName("");
    setCaptainTeamLogo("");
    setSelectedTeamId(null);
    setStealGuess("");
    setManagerGuess("");
    setViewMode("manager");
    setDraftTitle(savedRoom.title);
    setDraftQuestions(savedRoom.questions.map((question) => ({ ...question })));
  }, [draftQuestions, draftTitle]);

  const handleDeleteGame = useCallback(async () => {
    if (deleteConfirmation.trim() !== DELETE_CONFIRMATION_TEXT) return;
    const roomId = room?.roomId;
    if (roomId) {
      try {
        await deleteRemoteRoom(roomId);
        setSyncFeedback(null);
      } catch (error) {
        setSyncFeedback(error instanceof Error ? error.message : "Could not delete the backend game.");
      }
    }
    clearRoomIdentities(room);
    clearStoredRoom();
    setRoom(null);
    setDraftTitle("Family Feud Arcade");
    setDraftQuestions(createDraftQuestions());
    setJoinName("");
    setSelectedTeamId(null);
    setStealGuess("");
    setManagerGuess("");
    setCopyFeedback(null);
    setDeleteConfirmation("");
    setViewMode("manager");
  }, [deleteConfirmation, room]);

  const handleCopyInvite = useCallback(async (token: string) => {
    try {
      await copyToClipboard(formatInviteUrl(token, room));
      setCopyFeedback("Invite copied.");
      window.setTimeout(() => setCopyFeedback(null), 1800);
    } catch {
      setCopyFeedback("Copy failed. Use the displayed link.");
    }
  }, [room]);

  const handleStartGameLobby = useCallback(() => {
    if (!room) return;
    updateRoom((current) => ({
      ...current,
      gameStarted: true,
      updatedAt: now(),
      round: {
        ...current.round,
        phase: "lobby",
        logs: [createLog("Manager started the game. Invite links are now open for players.", "success"), ...current.round.logs],
      },
    }));
  }, [applyRoundPoints, room, updateRoom]);

  const handleJoinTeam = useCallback(() => {
    if (!room || !room.gameStarted || !inviteToken || !activeInviteTarget || !joinName.trim()) return;
    const teamId = activeTeam ?? selectedTeamId;
    if (!teamId) return;

    const identity = readIdentity(inviteToken);
    const existingPlayerId = identity?.participantId ?? null;
    const participantId = existingPlayerId || makeId();
    const trimmedName = joinName.trim();
    const member = findMemberForName(members, trimmedName);

    updateRoom((current) => {
      const team = current.teams[teamId];
      const isFirstPlayer = team.players.length === 0;
      if (isFirstPlayer && isBlank(captainTeamName)) return current;
      const nextTeamName = isFirstPlayer && !isBlank(captainTeamName) ? captainTeamName.trim() : team.name;
      const nextTeamLogo = isFirstPlayer && !isBlank(captainTeamLogo) ? captainTeamLogo.trim() : team.logoUrl;
      const nextPlayers = team.players.filter((player) => player.id !== participantId);
      const existingSameNameIndex = nextPlayers.findIndex((player) => normalize(player.name) === normalize(trimmedName));
      if (existingSameNameIndex >= 0) {
        nextPlayers[existingSameNameIndex] = {
          ...nextPlayers[existingSameNameIndex],
          memberId: member?.id ?? nextPlayers[existingSameNameIndex].memberId ?? null,
          name: trimmedName,
          profilePic: member?.profilePic ?? nextPlayers[existingSameNameIndex].profilePic ?? null,
          lastSeenAt: now(),
        };
      } else if (nextPlayers.length < MAX_PLAYERS_PER_TEAM) {
        nextPlayers.push({
          ...createParticipant(trimmedName, member),
          id: participantId,
        });
      }

      return {
        ...current,
        updatedAt: now(),
        teams: {
          ...current.teams,
          [teamId]: {
            ...team,
            name: nextTeamName,
            logoUrl: nextTeamLogo,
            captainId: team.captainId || (isFirstPlayer ? participantId : team.captainId),
            players: nextPlayers,
          },
        },
      };
    });

    writeIdentity({
      participantId,
      name: trimmedName,
      teamId,
      inviteToken,
    });
  }, [activeInviteTarget, activeTeam, captainTeamLogo, captainTeamName, inviteToken, joinName, members, room, selectedTeamId, updateRoom]);

  const handleLeaveTeam = useCallback(() => {
    if (!room || !inviteToken) return;
    const identity = readIdentity(inviteToken);
    if (!identity) return;

    updateRoom((current) => ({
      ...current,
      updatedAt: now(),
      teams: {
        ...current.teams,
        [identity.teamId]: {
          ...current.teams[identity.teamId],
          players: current.teams[identity.teamId].players.filter((player) => player.id !== identity.participantId),
        },
      },
    }));
    clearIdentity(inviteToken);
    setJoinName("");
  }, [inviteToken, room, updateRoom]);

  useEffect(() => {
    if (!room || !inviteToken || viewMode !== "user") return;
    const identity = readIdentity(inviteToken);
    if (!identity) return;

    const tick = window.setInterval(() => {
      updateRoom((current) => {
        const team = current.teams[identity.teamId];
        const updatedPlayers = team.players.map((player) => (
          player.id === identity.participantId
            ? { ...player, lastSeenAt: now() }
            : player
        ));

        return {
          ...current,
          updatedAt: now(),
          teams: {
            ...current.teams,
            [identity.teamId]: {
              ...team,
              players: updatedPlayers,
            },
          },
        };
      });
    }, HEARTBEAT_INTERVAL_MS);

    return () => window.clearInterval(tick);
  }, [inviteToken, room, updateRoom, viewMode]);

  const handleSetPreparedQuestion = useCallback((index: number) => {
    if (!room) return;
    updateRoom((current) => ({
      ...current,
      updatedAt: now(),
      round: {
        ...current.round,
        preparedQuestionIndex: index,
        logs: [createLog(`Prepared question ${index + 1}.`, "info"), ...current.round.logs],
      },
    }));
  }, [room, updateRoom]);

  const handleStartRound = useCallback(() => {
    if (!room || !room.gameStarted) return;
    updateRoom((current) => {
      const questionIndex = current.round.preparedQuestionIndex;
      const question = current.questions[questionIndex] ?? current.questions[0];
      return {
        ...current,
        updatedAt: now(),
        round: {
          ...current.round,
          number: current.round.number + 1,
          phase: "question",
          activeQuestionIndex: question ? questionIndex : null,
          multiplier: question?.multiplier || 1,
          controllingTeamId: null,
          starterTeamId: null,
          starterPlayerId: null,
          faceoffPlayerIds: { alpha: null, beta: null },
          faceoffAttempts: { alpha: false, beta: false },
          faceoffBestTeamId: null,
          faceoffBestAnswerIndex: null,
          activeGuessTeamId: null,
          pendingGuess: null,
          roundPoints: 0,
          board: question ? getQuestionBoard(question) : [],
          teamStrikes: { alpha: 0, beta: 0 },
          stealGuess: "",
          logs: [createLog(`Round ${current.round.number + 1} started. Question revealed first.`, "success"), ...current.round.logs],
        },
      };
    });
  }, [room, updateRoom]);

  const handlePickStarter = useCallback((teamId: TeamId, playerId: string) => {
    if (!room) return;
    updateRoom((current) => {
      const team = current.teams[teamId];
      const player = team.players.find((candidate) => candidate.id === playerId);
      if (!player) return current;

      return {
        ...current,
        updatedAt: now(),
        round: {
          ...current.round,
          faceoffPlayerIds: {
            ...current.round.faceoffPlayerIds,
            [teamId]: playerId,
          },
          logs: [createLog(`${team.name} selected ${player.name} for the face-off.`, "info"), ...current.round.logs],
        },
      };
    });
  }, [room, updateRoom]);

  const handleBeginFaceoff = useCallback((starterTeamId: TeamId) => {
    if (!room) return;
    updateRoom((current) => {
      const alphaPlayerId = current.round.faceoffPlayerIds.alpha;
      const betaPlayerId = current.round.faceoffPlayerIds.beta;
      if (!alphaPlayerId || !betaPlayerId) return current;

      const starterPlayerId = current.round.faceoffPlayerIds[starterTeamId];
      const currentRound = Math.max(current.round.number, 1);
      const nextTeams: Record<TeamId, Team> = { ...current.teams };

      for (const teamId of ["alpha", "beta"] as TeamId[]) {
        const selectedPlayerId = current.round.faceoffPlayerIds[teamId];
        nextTeams[teamId] = {
          ...current.teams[teamId],
          players: current.teams[teamId].players.map((player) => (
            player.id === selectedPlayerId
              ? { ...player, cooldownUntilRound: currentRound + COOLDOWN_ROUNDS }
              : player
          )),
        };
      }

      return {
        ...current,
        updatedAt: now(),
        teams: nextTeams,
        round: {
          ...current.round,
          phase: "faceoff",
          starterTeamId,
          starterPlayerId,
          activeGuessTeamId: starterTeamId,
          faceoffAttempts: { alpha: false, beta: false },
          faceoffBestTeamId: null,
          faceoffBestAnswerIndex: null,
          pendingGuess: null,
          logs: [createLog(`${teamLabel(starterTeamId)} starts the face-off answer window.`, "success"), ...current.round.logs],
        },
      };
    });
  }, [room, updateRoom]);

  const handleFaceoffWinner = useCallback((teamId: TeamId) => {
    if (!room) return;
    const winnerName = teamLabel(teamId);
    updateRoom((current) => ({
      ...current,
      updatedAt: now(),
      round: {
        ...current.round,
        phase: "control",
        controllingTeamId: teamId,
        activeGuessTeamId: teamId,
        pendingGuess: null,
        logs: [createLog(`${winnerName} won the face-off and controls the board.`, "success"), ...current.round.logs],
      },
    }));
  }, [room, updateRoom]);

  const handleBothFaceoffMiss = useCallback(() => {
    if (!room) return;
    updateRoom((current) => ({
      ...current,
      updatedAt: now(),
      round: {
        ...current.round,
        phase: "round-over",
        controllingTeamId: null,
        activeGuessTeamId: null,
        pendingGuess: null,
        logs: [createLog("Both teams missed the face-off. Round closed with Xs on the board.", "danger"), ...current.round.logs],
      },
    }));
  }, [room, updateRoom]);

  const applyRoundPoints = useCallback((current: RoomState, teamId: TeamId, points: number) => {
    const nextScore = current.teams[teamId].score + points;
    return {
      ...current,
      teams: {
        ...current.teams,
        [teamId]: {
          ...current.teams[teamId],
          score: nextScore,
        },
      },
    };
  }, []);

  const finishRound = useCallback((teamId: TeamId) => {
    updateRoom((current) => {
      const next = applyRoundPoints(current, teamId, current.round.roundPoints);
      return {
        ...next,
        updatedAt: now(),
        round: {
          ...next.round,
          phase: "round-over",
          controllingTeamId: teamId,
          activeGuessTeamId: null,
          logs: [createLog(`${teamLabel(teamId)} keeps ${current.round.roundPoints} points.`, "success"), ...current.round.logs],
        },
      };
    });
  }, [applyRoundPoints, updateRoom]);

  const handleCorrectAnswer = useCallback((guessTeamId: TeamId, answerIndex: number) => {
    if (!room || !["faceoff", "control", "steal"].includes(room.round.phase)) return;
    updateRoom((current) => {
      const answer = current.round.board[answerIndex];
      if (!answer || answer.revealed || !isFilledAnswer(answer)) {
        return current;
      }

      const earned = scoreAnswer(answer, current.round.multiplier);
      const nextBoard = current.round.board.map((entry, index) => (
        index === answerIndex ? { ...entry, revealed: true } : entry
      ));
      const nextRoundPoints = current.round.roundPoints + earned;
      const isBoardClear = nextBoard.every((entry) => entry.revealed);
      const revealLog = createLog(`${teamLabel(guessTeamId)} revealed "${answer.word}" for ${earned} points.`, "success");

      if (current.round.phase === "steal") {
        const stealTotal = nextRoundPoints;
        const next: RoomState = {
          ...current,
          updatedAt: now(),
          round: {
            ...current.round,
            board: nextBoard,
            logs: [createLog(`${teamLabel(guessTeamId)} stole the round with "${answer.word}".`, "success"), revealLog, ...current.round.logs],
            phase: "round-over",
            activeGuessTeamId: null,
            controllingTeamId: null,
            pendingGuess: null,
            roundPoints: 0,
          },
        };
        return applyRoundPoints(next, guessTeamId, stealTotal);
      }

      const next: RoomState = {
        ...current,
        updatedAt: now(),
        round: {
          ...current.round,
          board: nextBoard,
          roundPoints: nextRoundPoints,
          pendingGuess: null,
          logs: [revealLog, ...current.round.logs],
        },
      };

      if (isBoardClear) {
        return {
          ...applyRoundPoints(next, guessTeamId, nextRoundPoints),
          round: {
            ...next.round,
            phase: "round-over",
            controllingTeamId: null,
            activeGuessTeamId: null,
            roundPoints: 0,
            pendingGuess: null,
            logs: [createLog("Every answer is on the board. Round is complete.", "success"), ...next.round.logs],
          },
        };
      }

      if (current.round.phase === "faceoff") {
        const other = otherTeam(guessTeamId);
        const previousBestIndex = current.round.faceoffBestAnswerIndex;
        const previousBestTeamId = current.round.faceoffBestTeamId;
        const bestAnswerIndex = previousBestIndex === null || answerIndex < previousBestIndex ? answerIndex : previousBestIndex;
        const bestTeamId = previousBestIndex === null || answerIndex < previousBestIndex ? guessTeamId : previousBestTeamId ?? guessTeamId;
        const nextAttempts = {
          ...current.round.faceoffAttempts,
          [guessTeamId]: true,
        };

        if (answerIndex === 0 || nextAttempts[other]) {
          return {
            ...next,
            round: {
              ...next.round,
              phase: "control",
              controllingTeamId: bestTeamId,
              activeGuessTeamId: bestTeamId,
              faceoffAttempts: nextAttempts,
              faceoffBestAnswerIndex: bestAnswerIndex,
              faceoffBestTeamId: bestTeamId,
              logs: [createLog(`${teamLabel(bestTeamId)} takes control after the face-off.`, "success"), ...next.round.logs],
            },
          };
        }

        return {
          ...next,
          round: {
            ...next.round,
            activeGuessTeamId: other,
            faceoffAttempts: nextAttempts,
            faceoffBestAnswerIndex: bestAnswerIndex,
            faceoffBestTeamId: bestTeamId,
            logs: [createLog(`${teamLabel(other)} can answer once to beat it.`, "info"), ...next.round.logs],
          },
        };
      }

      return next;
    });
  }, [applyRoundPoints, room, updateRoom]);

  const handleWrongAnswer = useCallback((guessTeamId: TeamId, guessWord: string) => {
    if (!room || !["faceoff", "control", "steal"].includes(room.round.phase)) return;
    const other = otherTeam(guessTeamId);
    updateRoom((current) => {
      if (current.round.phase === "faceoff") {
        const nextAttempts = {
          ...current.round.faceoffAttempts,
          [guessTeamId]: true,
        };
        const nextLogs = [createLog(`${teamLabel(guessTeamId)} missed "${guessWord.trim() || "unknown"}".`, "danger"), ...current.round.logs];

        if (!nextAttempts[other]) {
          return {
            ...current,
            updatedAt: now(),
            round: {
              ...current.round,
              faceoffAttempts: nextAttempts,
              activeGuessTeamId: other,
              pendingGuess: null,
              logs: [createLog(`${teamLabel(other)} gets the next face-off answer.`, "info"), ...nextLogs],
            },
          };
        }

        if (current.round.faceoffBestTeamId) {
          return {
            ...current,
            updatedAt: now(),
            round: {
              ...current.round,
              phase: "control",
              controllingTeamId: current.round.faceoffBestTeamId,
              activeGuessTeamId: current.round.faceoffBestTeamId,
              faceoffAttempts: nextAttempts,
              pendingGuess: null,
              logs: [createLog(`${teamLabel(current.round.faceoffBestTeamId)} keeps control after the other miss.`, "success"), ...nextLogs],
            },
          };
        }

        return {
          ...current,
          updatedAt: now(),
          round: {
            ...current.round,
            phase: "round-over",
            activeGuessTeamId: null,
            controllingTeamId: null,
            faceoffAttempts: nextAttempts,
            pendingGuess: null,
            logs: [createLog("Both face-off answers missed. Close or restart the round.", "danger"), ...nextLogs],
          },
        };
      }

      if (current.round.phase === "steal") {
        const winningTeamId = current.round.controllingTeamId ?? other;
        return {
          ...applyRoundPoints(current, winningTeamId, current.round.roundPoints),
          updatedAt: now(),
          round: {
            ...current.round,
            logs: [createLog(`${teamLabel(guessTeamId)} missed the steal. Original team keeps the points.`, "danger"), ...current.round.logs],
            phase: "round-over",
            activeGuessTeamId: null,
            controllingTeamId: null,
            pendingGuess: null,
            roundPoints: 0,
          },
        };
      }

      const nextStrikes = current.round.teamStrikes[guessTeamId] + 1;
      const nextRound: RoundState = {
        ...current.round,
        teamStrikes: {
          ...current.round.teamStrikes,
          [guessTeamId]: nextStrikes,
        },
        pendingGuess: null,
        logs: [createLog(`${teamLabel(guessTeamId)} missed "${guessWord.trim() || "unknown"}" and got an X.`, "danger"), ...current.round.logs],
      };

      if (nextStrikes >= MAX_STRIKES_PER_QUESTION) {
        return {
          ...current,
          updatedAt: now(),
          round: {
            ...nextRound,
            phase: "steal",
            activeGuessTeamId: other,
            stealGuess: "",
            logs: [createLog(`${teamLabel(guessTeamId)} hit three strikes. ${teamLabel(other)} gets one steal answer.`, "danger"), ...nextRound.logs],
          },
        };
      }

      return {
        ...current,
        updatedAt: now(),
        round: nextRound,
      };
    });
  }, [room, updateRoom]);

  const handleSubmitGuess = useCallback((teamId: TeamId, guessWord: string) => {
    if (!room || !["faceoff", "control", "steal"].includes(room.round.phase) || !guessWord.trim()) return;
    const identity = inviteToken ? readIdentity(inviteToken) : null;
    const playerId = identity?.teamId === teamId ? identity.participantId : null;
    updateRoom((current) => ({
      ...current,
      updatedAt: now(),
      round: {
        ...current.round,
        stealGuess: current.round.phase === "steal" ? guessWord.trim() : current.round.stealGuess,
        pendingGuess: {
          id: makeId(),
          teamId,
          playerId,
          word: guessWord.trim(),
          source: playerId ? "player" : "manager",
          createdAt: now(),
        },
        logs: [createLog(`${teamLabel(teamId)} submitted "${guessWord.trim()}". Manager must confirm a match or no coincidence.`, "info"), ...current.round.logs],
      },
    }));
  }, [inviteToken, room, updateRoom]);

  const handleSteal = useCallback(() => {
    if (!room || room.round.phase !== "steal" || !room.round.activeGuessTeamId) return;
    const teamId = room.round.activeGuessTeamId;
    const normalizedGuess = normalize(stealGuess || room.round.stealGuess);
    if (!normalizedGuess) return;

    handleSubmitGuess(teamId, stealGuess || room.round.stealGuess);
  }, [handleSubmitGuess, room, stealGuess]);

  const handleFinishRound = useCallback(() => {
    if (!room) return;
    const winner = room.round.controllingTeamId;
    if (!winner) {
      updateRoom((current) => ({
        ...current,
        updatedAt: now(),
        round: {
          ...current.round,
          phase: "round-over",
          logs: [createLog("Round closed without a controlling team.", "info"), ...current.round.logs],
        },
      }));
      return;
    }

    finishRound(winner);
  }, [finishRound, room, updateRoom]);

  const nextRoundStarterHint = useMemo(() => {
    if (!room || room.round.number <= 0) return "Choose a participant to start.";
    return `Selected players sit out until round ${room.round.number + COOLDOWN_ROUNDS}.`;
  }, [room]);

  if (!loaded) {
    return (
      <main className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading minigames...
      </main>
    );
  }

  if (viewMode === "user" && !room) {
    return (
      <main className="min-h-screen px-4 py-6 md:px-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.35em] text-primary/80">Minigames</div>
              <h1 className="font-[family-name:var(--font-league-gothic)] text-5xl uppercase tracking-[0.18em] text-white">
                Family Feud Arcade
              </h1>
            </div>
            <Link href="/">
              <Button variant="outline">Back home</Button>
            </Link>
          </div>
          <Panel title="Waiting for the manager" eyebrow="User view">
            <p className="text-sm text-muted-foreground">
              The secret link has not been generated yet in this browser session. Open the manager view first to create the room, then share the invite links.
            </p>
          </Panel>
        </div>
      </main>
    );
  }

  if (viewMode === "manager" && !room) {
    return (
      <main className="min-h-screen px-4 py-6 md:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border bg-black/25 p-4 backdrop-blur">
            <div>
              <div className="text-xs uppercase tracking-[0.35em] text-primary/80">Minigames</div>
              <h1 className="font-[family-name:var(--font-league-gothic)] text-5xl uppercase tracking-[0.18em] text-white md:text-6xl">
                Build the game
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Create the title, add as many questions as you want, attach unlimited answers with points, and set the multiplier for each round directly on the question.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" onClick={handleCreateGame}>Create game</Button>
              <Link href="/">
                <Button variant="ghost">Back home</Button>
              </Link>
            </div>
          </header>

          <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <Card variant="featured" className="border-primary/25 bg-card/95">
              <CardHeader>
                <CardTitle className="font-[family-name:var(--font-league-gothic)] text-4xl uppercase tracking-[0.14em]">
                  Game title
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  label="Title"
                  placeholder="Family Feud Arcade"
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.target.value)}
                />
                <div className="rounded-xl border border-border bg-surface/60 p-3 text-sm text-muted-foreground">
                  This title will appear in the manager board and the player view once the game is created.
                </div>
              </CardContent>
            </Card>

            <Card variant="featured" className="border-border bg-card/95">
              <CardHeader className="flex items-center justify-between gap-3">
                <CardTitle className="font-[family-name:var(--font-league-gothic)] text-4xl uppercase tracking-[0.14em]">
                  Questions
                </CardTitle>
                <Button variant="outline" onClick={handleAddDraftQuestion}>+ Add question</Button>
              </CardHeader>
              <CardContent className="space-y-5">
                {draftQuestions.map((question, questionIndex) => (
                  <div key={question.id} className="rounded-2xl border border-border bg-black/25 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                        Question {questionIndex + 1}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveDraftQuestion(questionIndex)}
                          disabled={draftQuestions.length <= 1}
                        >
                          Remove question
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-[1fr_160px]">
                      <Input
                        label="Question prompt"
                        placeholder='Name something that can be inflated or deflated.'
                        value={question.prompt}
                        onChange={(event) => handleUpdateDraftQuestionFields(questionIndex, { prompt: event.target.value })}
                      />
                      <Input
                        label="Multiplier"
                        type="number"
                        min={1}
                        step={1}
                        value={String(question.multiplier)}
                        onChange={(event) => handleUpdateDraftQuestionFields(questionIndex, { multiplier: Number(event.target.value) || 1 })}
                      />
                    </div>

                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Answers</div>
                          <div className="text-sm text-muted-foreground">Add as many board answers as you need.</div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => handleAddDraftAnswer(questionIndex)}>+ Add answer</Button>
                      </div>

                      {question.answers.map((answer, answerIndex) => (
                        <div key={`${question.id}-${answerIndex}`} className="grid gap-3 md:grid-cols-[1fr_160px_auto]">
                          <Input
                            label={answerIndex === 0 ? "Word" : `Word ${answerIndex + 1}`}
                            placeholder="Tire"
                            value={answer.word}
                            onChange={(event) => handleUpdateDraftAnswer(questionIndex, answerIndex, { word: event.target.value })}
                          />
                          <Input
                            label={answerIndex === 0 ? "Points" : `Points ${answerIndex + 1}`}
                            type="number"
                            min={0}
                            step={1}
                            value={String(answer.points)}
                            onChange={(event) => handleUpdateDraftAnswer(questionIndex, answerIndex, { points: Number(event.target.value) || 0 })}
                          />
                          <div className="flex items-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveDraftAnswer(questionIndex, answerIndex)}
                              disabled={question.answers.length <= 1}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
              <CardFooter className="flex items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">Multiplier applies to every reveal in that question.</div>
                <Button onClick={handleCreateGame}>Create game</Button>
              </CardFooter>
            </Card>
          </section>
        </div>
      </main>
    );
  }

  const activeRoom = room ?? createFreshRoomState();
  const currentQuestion = findQuestionByIndex(activeRoom, activeRoom.round.activeQuestionIndex) ?? activeQuestion;
  const teamForInvite = activeTeam ? activeRoom.teams[activeTeam] : null;
  const canJoin = Boolean(
    activeTeam &&
      inviteToken &&
      joinName.trim() &&
      (!activeInviteTarget || !room || activeRoom.teams[activeInviteTarget.teamId].players.length > 0 || (captainTeamName.trim() && captainTeamLogo.trim()))
  );
  const visibleTeams = (Object.entries(activeRoom.teams) as Array<[TeamId, Team]>).filter(([, team]) => team.players.length > 0);
  const activeInviteTeamIsEmpty = activeInviteTarget ? activeRoom.teams[activeInviteTarget.teamId].players.length === 0 : false;

  return (
    <main className="min-h-screen px-4 py-6 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border bg-black/25 p-4 backdrop-blur">
          <div>
            <div className="text-xs uppercase tracking-[0.35em] text-primary/80">Minigames</div>
            <h1 className="font-[family-name:var(--font-league-gothic)] text-5xl uppercase tracking-[0.18em] text-white md:text-6xl">
              {activeRoom.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              A two-team, five-player structure for Overwatch nights. The manager handles the room, the users join with secret links, and the round board stays visible the whole time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant={viewMode === "manager" ? "primary" : "outline"} onClick={() => setViewMode("manager")}>
              Manager view
            </Button>
            <Button variant={viewMode === "user" ? "primary" : "outline"} onClick={() => setViewMode("user")}>
              User view
            </Button>
            <Link href="/">
              <Button variant="ghost">Back home</Button>
            </Link>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Panel title="The board" eyebrow="Live round">
            <BoardGrid room={activeRoom} />
          </Panel>

          <div className="space-y-6">
            <Card variant="bordered" className="border-primary/25 bg-card/95">
              <CardHeader>
                <CardTitle className="font-[family-name:var(--font-league-gothic)] text-3xl uppercase tracking-[0.14em]">
                  Team scores
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                {visibleTeams.length > 0 ? visibleTeams.map(([teamId, team]) => (
                  <div key={teamId} className="rounded-xl border border-border bg-surface/70 p-4">
                    <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{teamLabel(teamId)}</div>
                    <div className="font-[family-name:var(--font-league-gothic)] text-4xl uppercase tracking-[0.12em] text-white">
                      {team.name}
                    </div>
                    <div className="mt-3 text-3xl font-bold text-primary">{team.score}</div>
                    <div className="mt-2 text-sm text-muted-foreground">{team.players.length} / {MAX_PLAYERS_PER_TEAM} players</div>
                  </div>
                )) : (
                  <div className="sm:col-span-2 rounded-xl border border-dashed border-border/60 bg-surface/40 px-4 py-6 text-sm text-muted-foreground">
                    No teams are visible yet. The captain appears after the first player joins an invite link.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card variant="bordered" className="border-border bg-card/95">
              <CardHeader>
                <CardTitle className="font-[family-name:var(--font-league-gothic)] text-3xl uppercase tracking-[0.14em]">
                  Round controls
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-border bg-surface/60 p-3 text-sm text-muted-foreground">
                  Current question multiplier: x{currentQuestion?.multiplier || 1}
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Button onClick={handleStartRound}>Start round</Button>
                  <Button variant="outline" onClick={handleFinishRound}>Close round</Button>
                </div>

                {room ? (
                  <div className="rounded-xl border border-border bg-surface/60 p-3 text-sm text-muted-foreground">
                    {nextRoundStarterHint}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <Panel title="Secret links" eyebrow="Manager setup">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Generate two invite links, one per team. Players join, type their name, and stay visible until their heartbeat expires or they leave.
              </p>
              <div className="grid gap-3">
                <Button onClick={handleCreateGame}>Generate new secret links</Button>
                {copyFeedback ? <div className="text-sm text-primary">{copyFeedback}</div> : null}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {(Object.entries(activeRoom.teams) as Array<[TeamId, Team]>).map(([teamId, team], index) => (
                  <div key={teamId} className="rounded-2xl border border-border bg-black/25 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                          Invite link {index + 1}
                        </div>
                        <div className="font-[family-name:var(--font-league-gothic)] text-3xl uppercase tracking-[0.12em] text-white">
                          {team.players.length > 0 ? team.name : `Team ${index + 1}`}
                        </div>
                      </div>
                      <Badge variant={teamId === "alpha" ? "primary" : "secondary"}>{team.inviteToken}</Badge>
                    </div>
                    <div className="mt-3 break-all rounded-lg border border-border bg-surface/70 p-3 text-xs text-muted-foreground">
                      {formatInviteUrl(team.inviteToken, activeRoom)}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleCopyInvite(team.inviteToken)}>
                        Copy link
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setViewMode("user")}>Preview user view</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <Panel title="Question flow" eyebrow="Manager control">
            <div className="space-y-4">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Choose the next question</div>
                <select
                  className="mt-2 w-full rounded-md border border-input-border bg-input px-3 py-2 text-foreground"
                  value={activeRoom.round.preparedQuestionIndex}
                  onChange={(event) => handleSetPreparedQuestion(Number(event.target.value))}
                >
                  {activeRoom.questions.map((question, index) => (
                    <option key={question.id} value={index}>{index + 1}. {question.prompt}</option>
                  ))}
                </select>
              </div>

              <div className="rounded-2xl border border-border bg-surface/60 p-4">
                <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Question preview</div>
                <div className="mt-2 font-[family-name:var(--font-league-gothic)] text-4xl uppercase tracking-[0.1em] text-white">
                  {currentQuestion?.prompt || "No question selected"}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-black/25 p-4">
                  <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Face-off control</div>
                  <div className="mt-3 grid gap-2">
                    <Button variant="outline" onClick={() => handleFaceoffWinner("alpha")}>Alpha wins face-off</Button>
                    <Button variant="outline" onClick={() => handleFaceoffWinner("beta")}>Beta wins face-off</Button>
                    <Button variant="danger" onClick={handleBothFaceoffMiss}>Both teams miss</Button>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-black/25 p-4">
                  <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Steal round</div>
                  <Input
                    label="Steal guess"
                    placeholder="Type the one-word steal answer"
                    value={stealGuess}
                    onChange={(event) => setStealGuess(event.target.value)}
                  />
                  <Button className="mt-3 w-full" variant="primary" onClick={handleSteal} disabled={!stealGuess.trim()}>
                    Submit steal
                  </Button>
                </div>
              </div>
            </div>
          </Panel>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Panel title="Team rosters" eyebrow="Lobby management">
            <div className="grid gap-4 md:grid-cols-2">
              {(Object.entries(activeRoom.teams) as Array<[TeamId, Team]>).map(([teamId, team]) => (
                <div key={teamId} className="rounded-2xl border border-border bg-black/25 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{teamLabel(teamId)}</div>
                      <div className="font-[family-name:var(--font-league-gothic)] text-3xl uppercase tracking-[0.12em] text-white">
                        {team.name}
                      </div>
                    </div>
                    <Badge variant={teamId === "alpha" ? "primary" : "secondary"}>{team.players.length}/5</Badge>
                  </div>

                  <div className="mt-4 space-y-2">
                    {team.players.length > 0 ? team.players.map((player) => (
                      <div key={player.id} className="rounded-lg border border-border bg-surface/70 px-3 py-2 text-sm text-foreground">
                        <div className="flex items-center justify-between gap-2">
                          <span>{player.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {isParticipantLocked(player, currentRoundNumber) ? `Locked until round ${player.cooldownUntilRound}` : "Active"}
                          </span>
                        </div>
                      </div>
                    )) : (
                      <div className="rounded-lg border border-dashed border-border/60 px-3 py-4 text-sm text-muted-foreground">
                        No players have joined yet.
                      </div>
                    )}
                  </div>

                  <div className="mt-4">
                    <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Pick the round participant</div>
                    <div className="mt-3">
                      <TeamPlayers
                        team={team}
                        currentRound={currentRoundNumber}
                        selectedPlayerId={activeRoom.round.starterTeamId === teamId ? activeRoom.round.starterPlayerId : null}
                        onPick={(playerId) => handlePickStarter(teamId, playerId)}
                        disabled={activeRoom.round.phase === "round-over" || activeRoom.round.phase === "lobby"}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="User view" eyebrow="Join lobby">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Switch to the user view to simulate how the invited players will join the room. Names are stored per invite link and cleared when the heartbeat expires.
              </p>

              {activeInviteTarget ? (
                <div className="space-y-4 rounded-2xl border border-border bg-surface/60 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="primary">Invite active</Badge>
                    <Badge variant="outline">{activeInviteTarget.teamId === "alpha" ? "Alpha channel" : "Beta channel"}</Badge>
                  </div>
                  {activeInviteTeamIsEmpty ? (
                    <>
                      <Input
                        label="Captain name"
                        placeholder="Enter your player name"
                        value={joinName}
                        onChange={(event) => setJoinName(event.target.value)}
                      />
                      <Input
                        label="Team name"
                        placeholder="Enter team name"
                        value={captainTeamName}
                        onChange={(event) => setCaptainTeamName(event.target.value)}
                      />
                      <Input
                        label="Team logo image link"
                        placeholder="https://example.com/logo.png"
                        value={captainTeamLogo}
                        onChange={(event) => setCaptainTeamLogo(event.target.value)}
                      />
                    </>
                  ) : (
                    <Input
                      label="Player name"
                      placeholder="Enter player name"
                      value={joinName}
                      onChange={(event) => setJoinName(event.target.value)}
                    />
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={handleJoinTeam} disabled={!canJoin}>Join team</Button>
                    <Button variant="outline" onClick={handleLeaveTeam} disabled={!readIdentity(inviteToken)}>Leave team</Button>
                  </div>
                  <div className="rounded-xl border border-border bg-black/25 p-3 text-sm text-muted-foreground">
                    {activeInviteTeamIsEmpty
                      ? "You are the first player here, so you become the captain and name the team before joining."
                      : `You are joining ${teamForInvite?.name || "this team"}. If the tab closes or the heartbeat stops, the player name disappears from the lobby.`}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/60 bg-surface/40 p-4 text-sm text-muted-foreground">
                  Open the secret invite link in this view to bind a player to a team.
                </div>
              )}

              <div className="rounded-2xl border border-border bg-black/25 p-4">
                <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Current answer board</div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {activeRoom.round.board.length > 0 ? activeRoom.round.board.map((answer, index) => (
                    <div key={`${answer.word}-${index}`} className="rounded-lg border border-border bg-surface/60 px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span>{answer.revealed ? answer.word : "Hidden answer"}</span>
                        <span className="text-xs text-muted-foreground">{answer.revealed ? `${answer.points * activeRoom.round.multiplier}` : "X"}</span>
                      </div>
                    </div>
                  )) : (
                    <div className="md:col-span-2 rounded-lg border border-dashed border-border/60 px-3 py-4 text-sm text-muted-foreground">
                      The board appears after a round starts.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Danger zone" eyebrow="Delete current game">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This removes the current room from storage and sends the manager back to the setup screen.
                Any invited player identities tied to this room are cleared too.
              </p>
              <Input
                label={`Type ${DELETE_CONFIRMATION_TEXT} to confirm`}
                placeholder={DELETE_CONFIRMATION_TEXT}
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
              />
              <Button
                variant="danger"
                onClick={handleDeleteGame}
                disabled={deleteConfirmation.trim() !== DELETE_CONFIRMATION_TEXT}
              >
                Delete game and reset
              </Button>
              <div className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
                You must type {DELETE_CONFIRMATION_TEXT} exactly before the delete button works.
              </div>
            </div>
          </Panel>
        </section>
      </div>
    </main>
  );
}

function isBlank(value: string | null | undefined) {
  return !value || value.trim().length === 0;
}
