"use client";

import { Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiRequest } from "@/lib/api/client";
import type { MemberProfile } from "@/lib/api/types";
import { getMemberProfileById } from "@/lib/api/auth";
import { parseSurveyQuestionBlocks } from "@/lib/familyFeud/surveyImport";
import { useSession } from "@/features/session/SessionProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { ImageUploadField } from "@/components/ui/ImageUploadField";
import { Input } from "@/components/ui/Input";
import { clsx } from "clsx";
import styles from "./family-feud.module.css";

type TeamId = "alpha" | "beta";
type ViewMode = "manager" | "user" | "stream";
type RoundPhase = "lobby" | "question" | "faceoff" | "control" | "steal" | "round-over";
type GamePhase = "notStarted" | "teamLobby" | "choosingParticipant" | "playing" | "roundComplete";
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
  phase: GamePhase;
  currentRound: number | null;
  gameStarted: boolean;
  generatedAt: number;
  updatedAt: number;
  questions: Question[];
  teams: Record<TeamId, Team>;
  round: RoundState;
};

const ROOM_STORAGE_KEY = "goon.minigames.room";
const ROOM_ID_STORAGE_KEY = "goon.minigames.roomId";
const DELETE_CONFIRMATION_TEXT = "DELETE GAME";
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
    phase: "notStarted",
    currentRound: null,
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

  const hydrated = {
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

  const phase: GamePhase = hydrated.round.phase === "question"
    ? "choosingParticipant"
    : ["faceoff", "control", "steal"].includes(hydrated.round.phase)
      ? "playing"
      : hydrated.round.phase === "round-over"
        ? "roundComplete"
        : hydrated.gameStarted
          ? "teamLobby"
          : "notStarted";

  return {
    ...hydrated,
    phase,
    currentRound: hydrated.round.number > 0 ? hydrated.round.number : null,
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
    phase: "notStarted",
    currentRound: null,
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

async function fetchRemoteInvite(inviteToken: string, token: string) {
  const payload = await apiRequest<FamilyFeudGamePayload>(`/family-feud/invite/${encodeURIComponent(inviteToken)}`, {
    cache: "no-store",
    token,
  });
  return hydrateRoomState(payload.state);
}

async function joinRemoteTeam(roomId: string, inviteToken: string, token: string, teamName?: string) {
  const payload = await apiRequest<FamilyFeudGamePayload>(`/family-feud/games/${encodeURIComponent(roomId)}/join`, {
    method: "POST",
    token,
    body: { inviteToken, teamName },
  });
  return hydrateRoomState(payload.state);
}

async function updateRemoteTeam(roomId: string, inviteToken: string, token: string, name: string, logoUrl: string) {
  const payload = await apiRequest<FamilyFeudGamePayload>(`/family-feud/games/${encodeURIComponent(roomId)}/team`, {
    method: "PATCH",
    token,
    body: { inviteToken, name, logoUrl },
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
  return hydrateRoomState(room);
}

function formatInviteUrl(inviteToken: string) {
  if (typeof window === "undefined") return `/minigames?invite=${inviteToken}`;
  const params = new URLSearchParams({ invite: inviteToken, view: "user" });
  return `${window.location.origin}/minigames?${params.toString()}`;
}

function formatGameViewUrl(view: "manager" | "stream", room?: RoomState | null) {
  if (typeof window === "undefined") return `/minigames?view=${view}`;
  const params = new URLSearchParams({ view });
  if (room) params.set("game", room.roomId);
  return `${window.location.origin}/minigames?${params.toString()}`;
}

function isParticipantLocked(participant: Participant, currentRound: number) {
  return participant.cooldownUntilRound > currentRound;
}

function isAnswerPhase(phase: RoundPhase) {
  return phase === "faceoff" || phase === "control" || phase === "steal";
}

function createLog(label: string, kind: AnswerKind): RoundLog {
  return { id: makeId(), label, kind };
}

function copyToClipboard(text: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard) return Promise.reject(new Error("Clipboard not available."));
  return navigator.clipboard.writeText(text);
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

function DecorRail() {
  return null;
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

function StreamBoard({ room }: { room: RoomState }) {
  const question = findQuestionByIndex(room, room.round.activeQuestionIndex);
  const alphaFaceoff = getParticipant(room, "alpha", room.round.faceoffPlayerIds.alpha);
  const betaFaceoff = getParticipant(room, "beta", room.round.faceoffPlayerIds.beta);
  const isLobby = room.phase === "notStarted" || room.phase === "teamLobby";

  if (isLobby) {
    return (
      <main className={clsx(styles.streamStage, styles.streamCover)}>
        <div className={styles.stageShade} />
        <div className={styles.coverContent}>
          <div className={styles.showKicker}>GOONGINGA PRESENTS</div>
          <h1 className={styles.showTitle}>{room.title}</h1>
          <p className={styles.showSubtitle}>{room.phase === "teamLobby" ? "The teams are entering the studio" : "The show starts soon"}</p>
          <div className={styles.lobbyTeams}>
            {(["alpha", "beta"] as TeamId[]).map((teamId) => {
              const team = room.teams[teamId];
              return (
                <div key={teamId} className={clsx(styles.coverTeam, teamId === "alpha" ? styles.redSide : styles.blueSide)}>
                  <Avatar size="lg" src={team.logoUrl ?? undefined} fallback={team.name} alt={team.name} />
                  <div>
                    <strong>{team.name}</strong>
                    <span>{team.players.length} / {MAX_PLAYERS_PER_TEAM}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    );
  }

  if (room.phase === "choosingParticipant") {
    return (
      <main className={clsx(styles.streamStage, styles.duelStage)}>
        <div className={styles.stageShade} />
        <div className={styles.roundBug}>ROUND {room.currentRound}</div>
        <div className={styles.duelQuestion}>{question?.prompt || "Get ready for the next question"}</div>
        <section className={styles.duelGrid}>
          {(["alpha", "beta"] as TeamId[]).map((teamId) => {
            const participant = teamId === "alpha" ? alphaFaceoff : betaFaceoff;
            const team = room.teams[teamId];
            return (
              <div key={teamId} className={clsx(styles.duelist, teamId === "alpha" ? styles.redSide : styles.blueSide)}>
                <div className={styles.duelistAvatar}>
                  <Avatar size="xl" src={participant?.profilePic ?? undefined} fallback={participant?.name || "?"} alt={participant?.name || "Not selected"} />
                </div>
                <span>{team.name}</span>
                <strong>{participant?.name || "SELECTING..."}</strong>
              </div>
            );
          })}
          <div className={styles.versus}>VS</div>
        </section>
      </main>
    );
  }

  if (room.phase === "roundComplete") {
    const leader = room.teams.alpha.score === room.teams.beta.score
      ? null
      : room.teams.alpha.score > room.teams.beta.score ? room.teams.alpha : room.teams.beta;
    return (
      <main className={clsx(styles.streamStage, styles.resultStage)}>
        <div className={styles.stageShade} />
        <div className={styles.resultContent}>
          <div className={styles.showKicker}>ROUND {room.currentRound} COMPLETE</div>
          <h1 className={styles.resultTitle}>{leader ? `${leader.name} TAKES THE LEAD` : "TIED SCORE"}</h1>
          <div className={styles.resultScores}>
            {(["alpha", "beta"] as TeamId[]).map((teamId) => (
              <div key={teamId} className={teamId === "alpha" ? styles.redSide : styles.blueSide}>
                <Avatar size="xl" src={room.teams[teamId].logoUrl ?? undefined} fallback={room.teams[teamId].name} alt={room.teams[teamId].name} />
                <strong>{room.teams[teamId].name}</strong>
                <span>{room.teams[teamId].score}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.boardStage}>
      <header className={styles.scoreRibbon}>
        <div className={styles.redSide}>
          <Avatar size="sm" src={room.teams.alpha.logoUrl ?? undefined} fallback={room.teams.alpha.name} alt={room.teams.alpha.name} />
          <strong>{room.teams.alpha.name}</strong>
          <span>{room.teams.alpha.score}</span>
        </div>
        <div className={styles.roundPot}>
          <small>ROUND {room.currentRound} · X{room.round.multiplier}</small>
          <strong>{room.round.roundPoints}</strong>
        </div>
        <div className={styles.blueSide}>
          <span>{room.teams.beta.score}</span>
          <strong>{room.teams.beta.name}</strong>
          <Avatar size="sm" src={room.teams.beta.logoUrl ?? undefined} fallback={room.teams.beta.name} alt={room.teams.beta.name} />
        </div>
      </header>

      <section className={styles.questionCurtain}>
        <h1>{question?.prompt || "Waiting for a question"}</h1>
        <div className={styles.answerBoard}>
          {Array.from({ length: MAX_BOARD_ANSWERS }).map((_, index) => {
            const answer = room.round.board[index];
            const revealed = answer?.revealed && isFilledAnswer(answer);
            return (
              <div key={`${answer?.word || "empty"}-${index}`} className={clsx(styles.answerTile, revealed && styles.answerRevealed)}>
                <span className={styles.answerNumber}>{index + 1}</span>
                <strong>{revealed ? answer.word : ""}</strong>
                <span className={styles.answerPoints}>{revealed ? scoreAnswer(answer, room.round.multiplier) : ""}</span>
              </div>
            );
          })}
        </div>
        {room.round.pendingGuess ? <div className={styles.pendingPulse}>ANSWER RECEIVED</div> : null}
      </section>

      <footer className={styles.strikeBar}>
        {(["alpha", "beta"] as TeamId[]).map((teamId) => (
          <div key={teamId}>
            <span>{room.teams[teamId].name}</span>
            <div>
              {Array.from({ length: MAX_STRIKES_PER_QUESTION }).map((_, index) => (
                <b key={index} className={index < room.round.teamStrikes[teamId] ? styles.strikeOn : ""}>X</b>
              ))}
            </div>
          </div>
        ))}
      </footer>
    </main>
  );
}

function MinigamesPage() {
  const searchParams = useSearchParams();
  const { token, user, isAuthenticated, isHydrated } = useSession();
  const inviteToken = (searchParams?.get("invite") || "").trim().toUpperCase();
  const requestedView = searchParams?.get("view");
  const loginReturnPath = `/minigames${searchParams?.toString() ? `?${searchParams.toString()}` : ""}`;
  const initialViewMode: ViewMode = inviteToken ? "user" : (requestedView === "stream" ? "stream" : requestedView === "user" ? "user" : "manager");
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [draftTitle, setDraftTitle] = useState("Family Feud Arcade");
  const [draftQuestions, setDraftQuestions] = useState<QuestionDraft[]>(() => createDraftQuestions());
  const [questionEntryMode, setQuestionEntryMode] = useState<"paste" | "manual">("paste");
  const [questionImport, setQuestionImport] = useState("");
  const [questionImportFeedback, setQuestionImportFeedback] = useState<string | null>(null);
  const [captainTeamName, setCaptainTeamName] = useState("");
  const [captainTeamLogo, setCaptainTeamLogo] = useState("");
  const [stealGuess, setStealGuess] = useState("");
  const [managerGuess, setManagerGuess] = useState("");
  const [playerGuess, setPlayerGuess] = useState("");
  const [currentMember, setCurrentMember] = useState<MemberProfile | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  useEffect(() => {
    setViewMode(inviteToken ? "user" : (requestedView === "stream" ? "stream" : requestedView === "user" ? "user" : "manager"));
  }, [inviteToken, requestedView]);

  const activeInviteTarget = useMemo(() => roomFromInvite(room, inviteToken), [room, inviteToken]);
  const activeTeam = activeInviteTarget?.teamId ?? null;
  const activeQuestion = useMemo(() => findQuestionByIndex(room ?? createFreshRoomState(), room?.round.activeQuestionIndex ?? null), [room]);
  const currentRoundNumber = room?.round.number || 0;
  const parsedQuestionImport = useMemo(
    () => parseSurveyQuestionBlocks(questionImport, MAX_BOARD_ANSWERS),
    [questionImport]
  );
  const parsedQuestionImportAnswerCount = useMemo(
    () => parsedQuestionImport.reduce((total, question) => total + question.answers.length, 0),
    [parsedQuestionImport]
  );

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
      if (inviteToken && !isHydrated) return;
      const stored = readStoredRoom();
      const gameId = (searchParams?.get("game") || readStoredRoomId()).trim();
      let nextRoom: RoomState | null = !inviteToken && !gameId ? stored : null;

      try {
        if (inviteToken) {
          if (!token) {
            nextRoom = null;
          } else {
            nextRoom = await fetchRemoteInvite(inviteToken, token);
          }
        } else if (gameId) {
          nextRoom = await fetchRemoteRoom(gameId);
        }
      } catch (error) {
        nextRoom = inviteToken ? null : stored;
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
  }, [inviteToken, isHydrated, searchParams, token]);

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
        if (inviteToken && !token) return;
        const next = inviteToken ? await fetchRemoteInvite(inviteToken, token!) : await fetchRemoteRoom(room.roomId);
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
  }, [inviteToken, loaded, room?.roomId, token]);

  useEffect(() => {
    let cancelled = false;
    if (!inviteToken || !token || !user) {
      setCurrentMember(null);
      return;
    }

    void getMemberProfileById(user.id, token)
      .then((member) => {
        if (!cancelled) setCurrentMember(member);
      })
      .catch((error) => {
        if (!cancelled) setSyncFeedback(error instanceof Error ? error.message : "Could not load your Goonginga profile.");
      });

    return () => {
      cancelled = true;
    };
  }, [inviteToken, token, user]);

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
      answers: question.answers.length >= MAX_BOARD_ANSWERS
        ? question.answers
        : [...question.answers, { word: "", points: 0 }],
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
    setCaptainTeamName("");
    setCaptainTeamLogo("");
    setStealGuess("");
    setManagerGuess("");
    setPlayerGuess("");
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
    clearStoredRoom();
    setRoom(null);
    setDraftTitle("Family Feud Arcade");
    setDraftQuestions(createDraftQuestions());
    setCaptainTeamLogo("");
    setStealGuess("");
    setManagerGuess("");
    setPlayerGuess("");
    setCopyFeedback(null);
    setDeleteConfirmation("");
    setViewMode("manager");
  }, [deleteConfirmation, room]);

  const handleCopyLink = useCallback(async (url: string, label: string) => {
    try {
      await copyToClipboard(url);
      setCopyFeedback(`${label} copied.`);
      window.setTimeout(() => setCopyFeedback(null), 1800);
    } catch {
      setCopyFeedback("Copy failed. Use the displayed link.");
    }
  }, []);

  const handleImportQuestions = useCallback(() => {
    if (parsedQuestionImport.length === 0) {
      setQuestionImportFeedback("No questions detected. Add a question followed by answers such as: 1 Answer x10.");
      return;
    }

    setDraftQuestions(parsedQuestionImport.map((question) => ({
      id: makeId(),
      prompt: question.prompt,
      multiplier: 1,
      answers: question.answers.map(({ word, points }) => ({ word, points })),
    })));
    setQuestionEntryMode("manual");
    setQuestionImportFeedback(`${parsedQuestionImport.length} questions and ${parsedQuestionImportAnswerCount} answers imported.`);
  }, [parsedQuestionImport, parsedQuestionImportAnswerCount]);

  const handleCopyInvite = useCallback((token: string) => (
    handleCopyLink(formatInviteUrl(token), "Player link")
  ), [handleCopyLink]);

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
  }, [room, updateRoom]);

  const handleJoinTeam = useCallback(async () => {
    if (!room || !room.gameStarted || !inviteToken || !activeInviteTarget || !token || !currentMember) return;
    try {
      const joinedRoom = await joinRemoteTeam(
        room.roomId,
        inviteToken,
        token,
        activeInviteTarget.room.teams[activeInviteTarget.teamId].players.length === 0 ? captainTeamName : undefined
      );
      writeStoredRoom(joinedRoom);
      setRoom(joinedRoom);
      const joinedTeam = joinedRoom.teams[activeInviteTarget.teamId];
      setCaptainTeamName(joinedTeam.name);
      setCaptainTeamLogo(joinedTeam.logoUrl || "");
      setSyncFeedback(null);
    } catch (error) {
      setSyncFeedback(error instanceof Error ? error.message : "Could not join this Family Feud team.");
    }
  }, [activeInviteTarget, captainTeamName, currentMember, inviteToken, room, token]);

  const handleCustomizeTeam = useCallback(async () => {
    if (!room || !inviteToken || !token || !activeTeam || !captainTeamName.trim()) return;
    try {
      const updatedRoom = await updateRemoteTeam(
        room.roomId,
        inviteToken,
        token,
        captainTeamName,
        captainTeamLogo
      );
      writeStoredRoom(updatedRoom);
      setRoom(updatedRoom);
      setSyncFeedback(null);
      setCopyFeedback("Team updated.");
      window.setTimeout(() => setCopyFeedback(null), 1800);
    } catch (error) {
      setSyncFeedback(error instanceof Error ? error.message : "Could not customize the team.");
    }
  }, [activeTeam, captainTeamLogo, captainTeamName, inviteToken, room, token]);

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
          pendingGuess: null,
          roundPoints: 0,
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
      const isBoardClear = nextBoard.filter(isFilledAnswer).every((entry) => entry.revealed);
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
  }, [applyRoundPoints, room, updateRoom]);

  const handleSubmitGuess = useCallback((teamId: TeamId, guessWord: string) => {
    if (!room || !["faceoff", "control", "steal"].includes(room.round.phase) || !guessWord.trim()) return;
    const playerId = activeTeam === teamId && currentMember ? `member-${currentMember.id}` : null;
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
  }, [activeTeam, currentMember, room, updateRoom]);

  const handleSteal = useCallback(() => {
    if (!room || room.round.phase !== "steal" || !room.round.activeGuessTeamId) return;
    const teamId = room.round.activeGuessTeamId;
    const normalizedGuess = normalize(stealGuess || room.round.stealGuess);
    if (!normalizedGuess) return;

    handleSubmitGuess(teamId, stealGuess || room.round.stealGuess);
  }, [handleSubmitGuess, room, stealGuess]);

  const handleManagerSubmitGuess = useCallback(() => {
    if (!room?.round.activeGuessTeamId || !managerGuess.trim()) return;
    handleSubmitGuess(room.round.activeGuessTeamId, managerGuess);
    setManagerGuess("");
  }, [handleSubmitGuess, managerGuess, room]);

  const handleResolvePendingMatch = useCallback((answerIndex: number) => {
    const guess = room?.round.pendingGuess;
    if (!guess) return;
    handleCorrectAnswer(guess.teamId, answerIndex);
    setManagerGuess("");
    setStealGuess("");
    setPlayerGuess("");
  }, [handleCorrectAnswer, room]);

  const handleResolveNoCoincidence = useCallback(() => {
    const guess = room?.round.pendingGuess;
    if (!guess) return;
    handleWrongAnswer(guess.teamId, guess.word);
    setManagerGuess("");
    setStealGuess("");
    setPlayerGuess("");
  }, [handleWrongAnswer, room]);

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

  if ((viewMode === "user" || viewMode === "stream") && !room) {
    if (viewMode === "stream") {
      return (
        <main className={clsx(styles.streamStage, styles.streamCover)}>
          <div className={styles.stageShade} />
          <div className={styles.coverContent}>
            <div className={styles.showKicker}>GOONGINGA PRESENTS</div>
            <h1 className={styles.showTitle}>FAMILY FEUD</h1>
            <p className={styles.showSubtitle}>Waiting for the manager</p>
          </div>
        </main>
      );
    }

    return (
      <main className="min-h-screen bg-[#080b12] px-4 py-6 text-white md:px-8">
        <div className="mx-auto max-w-3xl">
          <header className="flex items-center justify-between gap-3 border-b border-[#303a49] pb-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.22em] text-[#e7b958]">Goonginga · Family Feud</div>
              <h1 className="font-display text-4xl uppercase">Player access</h1>
            </div>
            <Link href="/"><Button variant="ghost">Exit</Button></Link>
          </header>
          <section className="mt-8 border-t-4 border-[#e7b958] bg-[#111722] p-7 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center border-2 border-[#e7b958] font-display text-3xl text-[#e7b958]">FF</div>
            <h2 className="mt-5 font-display text-4xl uppercase">{!isAuthenticated ? "Sign in to join" : "Link unavailable"}</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#9da6b5]">
              {!isAuthenticated
                ? "We use your Goonginga name and profile picture to keep you on the team even if you close your browser."
                : "This link is not connected to an active game yet. Ask the manager for a new link."}
            </p>
            {!isAuthenticated ? (
              <Link href={`/login?next=${encodeURIComponent(loginReturnPath)}`}>
                <Button className="mt-6">Sign in and continue</Button>
              </Link>
            ) : null}
          </section>
        </div>
      </main>
    );
  }

  if (viewMode === "manager" && !room) {
    const validQuestionCount = draftQuestions.filter((question) => question.prompt.trim() && question.answers.some(isFilledAnswer)).length;
    return (
      <main className="min-h-screen bg-[#080b12] text-white">
        <header className="border-b border-[#e7b958]/35 bg-[#0d111a]">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 md:px-8">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.24em] text-[#e7b958]">Family Feud · Control</div>
              <h1 className="font-display text-5xl uppercase md:text-6xl">Question bank</h1>
            </div>
            <div className="flex items-center gap-3">
              <span className="border border-[#e7b958]/40 bg-[#16120b] px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#f3ce7a]">Step 1 of 5</span>
              <Link href="/"><Button variant="ghost">Exit</Button></Link>
            </div>
          </div>
          <div className="mx-auto grid max-w-7xl grid-cols-5 px-4 md:px-8">
            <div className="h-1 bg-[#e7b958]" />
            {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-1 bg-[#252b36]" />)}
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-4 py-7 md:px-8">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#8e98a7]">Game content</div>
              <h2 className="mt-2 max-w-3xl font-display text-4xl uppercase leading-none md:text-5xl">Set up the board answers</h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-[#aab2c0]">Import the full survey or edit each question. Every answer keeps its response count, and each round can have its own multiplier.</p>
            </div>
            <Button onClick={handleCreateGame} disabled={validQuestionCount === 0}>Create lobby · {validQuestionCount} questions</Button>
          </div>

          <div className="mt-8 inline-flex border border-[#303a49] bg-[#0a0e15] p-1">
            <button
              type="button"
              onClick={() => setQuestionEntryMode("paste")}
              className={clsx("px-5 py-2 text-sm font-bold", questionEntryMode === "paste" ? "bg-[#e7b958] text-[#171008]" : "text-[#9da6b5]")}
            >
              Paste survey
            </button>
            <button
              type="button"
              onClick={() => setQuestionEntryMode("manual")}
              className={clsx("px-5 py-2 text-sm font-bold", questionEntryMode === "manual" ? "bg-[#e7b958] text-[#171008]" : "text-[#9da6b5]")}
            >
              Manual editor
            </button>
          </div>

          {questionEntryMode === "paste" ? (
            <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <label htmlFor="survey-question-import-v2" className="text-xs font-bold uppercase tracking-[0.2em] text-[#e7b958]">Full survey</label>
                <textarea
                  id="survey-question-import-v2"
                  className="mt-3 min-h-[430px] w-full resize-y border-2 border-[#303a49] bg-[#0a0e15] p-4 font-mono text-sm leading-6 text-white outline-none placeholder:text-[#596170] focus:border-[#e7b958]"
                  value={questionImport}
                  onChange={(event) => setQuestionImport(event.target.value)}
                  placeholder={"Most hated\n1 Sombra x11\n2 Cat x7\n3 Moira x6\n\nHottest\n1 Widow x6\n2 Winton x5\n3 Torb x4"}
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-[#8e98a7]">One question per line, followed by: rank, answer, and x(count).</p>
                  <Button onClick={handleImportQuestions} disabled={!questionImport.trim()}>Import to board</Button>
                </div>
                {questionImportFeedback ? <p className="mt-3 text-sm font-medium text-[#e7b958]">{questionImportFeedback}</p> : null}
              </div>

              <aside className="border-t-4 border-[#e7b958] bg-[#111722] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#e7b958]">Live preview</div>
                  <span className="font-mono text-xs text-[#9da6b5]">{parsedQuestionImport.length} questions · {parsedQuestionImportAnswerCount} answers</span>
                </div>
                <div className="mt-5 space-y-5">
                  {parsedQuestionImport.length > 0 ? parsedQuestionImport.slice(0, 5).map((question, questionIndex) => (
                    <div key={`${question.prompt}-${questionIndex}`} className="border-b border-[#2b3442] pb-5 last:border-0">
                      <div className="font-display text-2xl uppercase leading-none">{questionIndex + 1}. {question.prompt}</div>
                      <div className="mt-3 grid gap-1.5">
                        {question.answers.map((answer) => (
                          <div key={`${answer.rank}-${answer.word}`} className="grid grid-cols-[28px_1fr_auto] gap-2 text-sm">
                            <span className="font-mono text-[#e7b958]">{answer.rank}</span>
                            <span className="truncate text-[#d7dce5]">{answer.word}</span>
                            <span className="font-mono text-[#8e98a7]">x{answer.points}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )) : (
                    <div className="grid min-h-72 place-items-center border border-dashed border-[#3b4656] text-center text-sm text-[#7f8998]">
                      A preview will appear as you type.
                    </div>
                  )}
                </div>
              </aside>
            </section>
          ) : (
            <section className="mt-6">
              <div className="flex items-center justify-between gap-4 border-b border-[#303a49] pb-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#e7b958]">Manual editor</div>
                  <p className="mt-1 text-sm text-[#8e98a7]">{draftQuestions.length} questions in this game.</p>
                </div>
                <Button variant="outline" onClick={handleAddDraftQuestion}>Add question</Button>
              </div>

              <div className="divide-y divide-[#303a49]">
                {draftQuestions.map((question, questionIndex) => (
                  <article key={question.id} className="py-7">
                    <div className="grid gap-4 lg:grid-cols-[56px_minmax(0,1fr)_140px_auto] lg:items-end">
                      <div className="font-display text-5xl text-[#e7b958]">{String(questionIndex + 1).padStart(2, "0")}</div>
                      <Input
                        label="Question"
                        value={question.prompt}
                        onChange={(event) => handleUpdateDraftQuestionFields(questionIndex, { prompt: event.target.value })}
                        placeholder="Enter the question..."
                      />
                      <Input
                        label="Multiplier"
                        type="number"
                        min={1}
                        value={String(question.multiplier)}
                        onChange={(event) => handleUpdateDraftQuestionFields(questionIndex, { multiplier: Math.max(1, Number(event.target.value) || 1) })}
                      />
                      <Button variant="ghost" onClick={() => handleRemoveDraftQuestion(questionIndex)} disabled={draftQuestions.length <= 1}>Remove</Button>
                    </div>
                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                      {question.answers.map((answer, answerIndex) => (
                        <div key={`${question.id}-${answerIndex}`} className="grid grid-cols-[34px_minmax(0,1fr)_90px] items-center gap-2">
                          <span className="font-display text-2xl text-[#e7b958]">{answerIndex + 1}</span>
                          <input
                            aria-label={`Answer ${answerIndex + 1} for question ${questionIndex + 1}`}
                            value={answer.word}
                            onChange={(event) => handleUpdateDraftAnswer(questionIndex, answerIndex, { word: event.target.value })}
                            placeholder="Answer"
                            className="h-11 border border-[#3a4556] bg-[#0a0e15] px-3 text-sm text-white outline-none focus:border-[#e7b958]"
                          />
                          <input
                            aria-label={`Count ${answerIndex + 1} for question ${questionIndex + 1}`}
                            type="number"
                            min={0}
                            value={answer.points}
                            onChange={(event) => handleUpdateDraftAnswer(questionIndex, answerIndex, { points: Number(event.target.value) || 0 })}
                            className="h-11 border border-[#3a4556] bg-[#0a0e15] px-3 text-sm text-white outline-none focus:border-[#e7b958]"
                          />
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
              <div className="flex justify-end border-t border-[#303a49] pt-5">
                <Button onClick={handleCreateGame} disabled={validQuestionCount === 0}>Create lobby · {validQuestionCount} questions</Button>
              </div>
            </section>
          )}
        </div>
      </main>
    );
  }

  if (false && viewMode === "manager" && !room) {
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
                Set the game title, add questions, import survey results in one paste, and keep up to eight ranked answers per question.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" onClick={handleCreateGame}>Create game</Button>
              <Link href="/">
                <Button variant="ghost">Back home</Button>
              </Link>
            </div>
          </header>

          <Card variant="featured" className="border-primary/25 bg-card/95">
            <CardHeader className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-primary/80">Bulk question import</div>
                <CardTitle className="mt-1 font-[family-name:var(--font-league-gothic)] text-4xl uppercase tracking-[0.14em]">
                  Paste survey results
                </CardTitle>
              </div>
              <Button variant="primary" onClick={handleImportQuestions} disabled={!questionImport.trim()}>
                Import questions
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="block text-sm font-medium text-foreground" htmlFor="survey-question-import">Question blocks</label>
              <textarea
                id="survey-question-import"
                className="min-h-56 w-full resize-y rounded-md border border-input-border bg-input px-3 py-3 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
                value={questionImport}
                onChange={(event) => setQuestionImport(event.target.value)}
                placeholder={"Most hated\n1 Sombra x11\n2 Cat x7\n3 moira x6\n\nHottest\n1 Widow x6\n2 Winton x5\n5 Domina 3x"}
              />
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                <span>Format: one question per line; answers such as <code>1 Sombra x11</code>, <code>1 - Sombra - x11</code>, or <code>5 Domina 3x</code>.</span>
                {questionImportFeedback ? <span className="font-medium text-primary">{questionImportFeedback}</span> : null}
              </div>
              {questionImport.trim() ? (
                <div className="rounded-xl border border-border bg-black/25 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Preview</div>
                    <div className="text-sm text-muted-foreground">
                      {parsedQuestionImport.length} questions | {parsedQuestionImportAnswerCount} answers
                    </div>
                  </div>
                  {parsedQuestionImport.length > 0 ? (
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {parsedQuestionImport.slice(0, 4).map((question, questionIndex) => (
                        <div key={`${question.prompt}-${questionIndex}`} className="rounded-lg border border-border bg-surface/70 p-3">
                          <div className="break-words text-sm font-semibold text-white">
                            {questionIndex + 1}. {question.prompt}
                          </div>
                          <div className="mt-2 space-y-1">
                            {question.answers.map((answer, answerIndex) => (
                              <div key={`${questionIndex}-${answer.rank}-${answer.word}-${answerIndex}`} className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                                <span className="truncate">{answer.rank}. {answer.word}</span>
                                <span className="shrink-0 font-medium text-primary">x{answer.points}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-lg border border-dashed border-border/60 p-3 text-sm text-muted-foreground">
                      No readable questions yet.
                    </div>
                  )}
                  {parsedQuestionImport.length > 4 ? (
                    <div className="mt-3 text-xs text-muted-foreground">
                      Showing 4 of {parsedQuestionImport.length} importable questions.
                    </div>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>

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
                          <div className="text-sm text-muted-foreground">Add up to 8 ranked board answers.</div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAddDraftAnswer(questionIndex)}
                          disabled={question.answers.length >= MAX_BOARD_ANSWERS}
                        >
                          + Add answer
                        </Button>
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
  if (viewMode === "stream") return <StreamBoard room={activeRoom} />;
  const currentQuestion = findQuestionByIndex(activeRoom, activeRoom.round.activeQuestionIndex) ?? activeQuestion;
  const teamForInvite = activeTeam ? activeRoom.teams[activeTeam] : null;
  const activeIdentityParticipant = activeTeam && currentMember
    ? activeRoom.teams[activeTeam].players.find((player) => player.memberId === currentMember.id) ?? null
    : null;
  const activeIdentity = activeTeam && activeIdentityParticipant
    ? { participantId: activeIdentityParticipant.id, name: activeIdentityParticipant.name, teamId: activeTeam, inviteToken }
    : null;
  const pendingGuess = activeRoom.round.pendingGuess;
  const pendingGuessPlayer = getPendingGuessPlayer(activeRoom, pendingGuess);
  const activeRoundInProgress = activeRoom.round.phase === "question" || isAnswerPhase(activeRoom.round.phase);
  const canStartRound = activeRoom.gameStarted && !activeRoundInProgress;
  const canBeginFaceoff = activeRoom.round.phase === "question" && Boolean(activeRoom.round.faceoffPlayerIds.alpha && activeRoom.round.faceoffPlayerIds.beta);
  const managerSearchTerm = normalize(pendingGuess?.word || managerGuess);
  const managerMatchCandidates = activeRoom.round.board
    .map((answer, index) => ({ answer, index }))
    .filter(({ answer }) => isFilledAnswer(answer) && !answer.revealed)
    .filter(({ answer }) => !managerSearchTerm || normalize(answer.word).includes(managerSearchTerm) || managerSearchTerm.includes(normalize(answer.word)));
  const userIsFaceoffParticipant = activeIdentity?.teamId
    ? activeRoom.round.phase !== "faceoff" || activeRoom.round.faceoffPlayerIds[activeIdentity.teamId] === activeIdentity.participantId
    : false;
  const userCanSubmitAnswer = Boolean(
    viewMode === "user" &&
      activeTeam &&
      activeIdentity &&
      activeIdentityParticipant &&
      isAnswerPhase(activeRoom.round.phase) &&
      !pendingGuess &&
      activeRoom.round.activeGuessTeamId === activeIdentity.teamId &&
      activeTeam === activeIdentity.teamId &&
      userIsFaceoffParticipant
  );
  const activeInviteTeamIsEmpty = activeInviteTarget ? activeRoom.teams[activeInviteTarget.teamId].players.length === 0 : false;
  const canJoin = Boolean(
    activeRoom.gameStarted &&
      activeTeam &&
      token &&
      currentMember &&
      (!activeInviteTeamIsEmpty || captainTeamName.trim())
  );
  const visibleTeams = (Object.entries(activeRoom.teams) as Array<[TeamId, Team]>).filter(([, team]) => team.players.length > 0);
  const activeInviteTeam = activeTeam ? activeRoom.teams[activeTeam] : null;
  const activeUserIsCaptain = Boolean(activeIdentityParticipant && activeInviteTeam?.captainId === activeIdentityParticipant.id);
  const hiddenAnswers = activeRoom.round.board
    .map((answer, index) => ({ answer, index }))
    .filter(({ answer }) => isFilledAnswer(answer) && !answer.revealed);

  const phaseTitle: Record<GamePhase, string> = {
    notStarted: "Set up the lobby",
    teamLobby: "Teams in the lobby",
    choosingParticipant: "Choose contestants",
    playing: "Answer desk",
    roundComplete: "Round complete",
  };

  const phaseStep: Record<GamePhase, number> = {
    notStarted: 2,
    teamLobby: 2,
    choosingParticipant: 3,
    playing: 4,
    roundComplete: 5,
  };

  if (viewMode === "manager") {
    return (
      <main className="min-h-screen bg-[#080b12] text-white">
        <header className="border-b border-[#e7b958]/35 bg-[#0d111a]">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-8">
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-[0.24em] text-[#e7b958]">Family Feud · Control</div>
              <h1 className="truncate font-display text-4xl uppercase md:text-5xl">{phaseTitle[activeRoom.phase]}</h1>
            </div>
            <div className="flex items-center gap-3">
              <span className="border border-[#e7b958]/40 bg-[#16120b] px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#f3ce7a]">
                Step {phaseStep[activeRoom.phase]} of 5
              </span>
              <Link href="/"><Button variant="ghost">Exit</Button></Link>
            </div>
          </div>
          <div className="mx-auto grid max-w-7xl grid-cols-5 px-4 md:px-8">
            {["Questions", "Lobby", "Contestants", "Playing", "Results"].map((label, index) => (
              <div key={label} className={clsx(
                "h-1",
                index + 1 <= phaseStep[activeRoom.phase] ? "bg-[#e7b958]" : "bg-[#252b36]"
              )} title={label} />
            ))}
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-4 py-7 md:px-8">
          {syncFeedback ? <div className="mb-5 border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">{syncFeedback}</div> : null}
          {copyFeedback ? <div className="mb-5 border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">{copyFeedback}</div> : null}

          {(activeRoom.phase === "notStarted" || activeRoom.phase === "teamLobby") ? (
            <section className="space-y-7">
              <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#e7b958]">Access links</div>
                  <h2 className="mt-2 max-w-3xl font-display text-4xl uppercase leading-none md:text-5xl">
                    Bring both teams to the stage
                  </h2>
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-[#aab2c0]">
                    Each link is assigned to one team. The first Goonginga user to join becomes its captain.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    {activeRoom.phase === "notStarted" ? (
                      <Button onClick={handleStartGameLobby}>Open player links</Button>
                    ) : (
                      <Button onClick={handleStartRound} disabled={activeRoom.teams.alpha.players.length === 0 || activeRoom.teams.beta.players.length === 0}>
                        Start with question 1
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => handleCopyLink(formatGameViewUrl("stream", activeRoom), "Stream link")}>
                      Copy stream link
                    </Button>
                  </div>
                </div>

                <div className="border-l-4 border-[#e7b958] bg-[#111722] p-5">
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#7f8998]">Lobby status</div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {(["alpha", "beta"] as TeamId[]).map((teamId) => (
                      <div key={teamId} className={clsx("border p-4", teamId === "alpha" ? "border-[#f24f43]/50 bg-[#2a1113]" : "border-[#4fbdf0]/50 bg-[#0d2030]")}>
                        <div className="flex items-center gap-3">
                          <Avatar size="lg" src={activeRoom.teams[teamId].logoUrl ?? undefined} fallback={activeRoom.teams[teamId].name} alt={activeRoom.teams[teamId].name} />
                          <div className="min-w-0">
                            <div className="truncate font-display text-2xl uppercase">{activeRoom.teams[teamId].name}</div>
                            <div className="text-xs text-[#aab2c0]">{activeRoom.teams[teamId].players.length} / {MAX_PLAYERS_PER_TEAM} players</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {activeRoom.phase === "teamLobby" && (activeRoom.teams.alpha.players.length === 0 || activeRoom.teams.beta.players.length === 0) ? (
                    <p className="mt-4 text-sm text-[#e7b958]">You need at least one player on each team to begin.</p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                {(["alpha", "beta"] as TeamId[]).map((teamId, index) => {
                  const team = activeRoom.teams[teamId];
                  const inviteUrl = formatInviteUrl(team.inviteToken);
                  return (
                    <article key={teamId} className={clsx("border-t-4 bg-[#111722] p-5", teamId === "alpha" ? "border-[#f24f43]" : "border-[#4fbdf0]")}>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#7f8998]">Team {index + 1}</div>
                          <h3 className="mt-1 font-display text-4xl uppercase">{team.name}</h3>
                        </div>
                        <span className="bg-[#070b12] px-3 py-2 font-mono text-xs text-[#e7b958]">{team.inviteToken}</span>
                      </div>
                      <div className="mt-4 overflow-hidden border border-[#2c3544] bg-[#090d14] px-3 py-3 font-mono text-xs text-[#9ca5b4]">
                        <span className="block truncate">{inviteUrl}</span>
                      </div>
                      <Button className="mt-4" variant="outline" onClick={() => handleCopyInvite(team.inviteToken)}>Copy link</Button>
                      <div className="mt-5 grid grid-cols-5 gap-2">
                        {Array.from({ length: MAX_PLAYERS_PER_TEAM }).map((_, playerIndex) => {
                          const player = team.players[playerIndex];
                          return (
                            <div key={player?.id || playerIndex} className="grid min-w-0 justify-items-center gap-2 text-center">
                              {player ? <Avatar size="md" src={player.profilePic ?? undefined} fallback={player.name} alt={player.name} /> : <div className="h-10 w-10 border border-dashed border-[#384252]" />}
                              <span className="w-full truncate text-[11px] text-[#aab2c0]">{player?.name || "Open"}</span>
                            </div>
                          );
                        })}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          {activeRoom.phase === "choosingParticipant" ? (
            <section className="space-y-7">
              <div className="border-y border-[#e7b958]/40 bg-[#111722] px-5 py-6 text-center">
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-[#e7b958]">Round {activeRoom.currentRound} · Question live</div>
                <h2 className="mx-auto mt-3 max-w-5xl font-display text-4xl uppercase leading-none md:text-6xl">{currentQuestion?.prompt}</h2>
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                {(["alpha", "beta"] as TeamId[]).map((teamId) => {
                  const team = activeRoom.teams[teamId];
                  const selected = getParticipant(activeRoom, teamId, activeRoom.round.faceoffPlayerIds[teamId]);
                  return (
                    <article key={teamId} className={clsx("border-t-4 bg-[#111722] p-5", teamId === "alpha" ? "border-[#f24f43]" : "border-[#4fbdf0]")}>
                      <div className="mb-5 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-[0.18em] text-[#8e98a7]">{team.name}</div>
                          <h3 className="font-display text-4xl uppercase">{selected?.name || "Choose a contestant"}</h3>
                        </div>
                        <Avatar size="lg" src={selected?.profilePic ?? team.logoUrl ?? undefined} fallback={selected?.name || team.name} alt={selected?.name || team.name} />
                      </div>
                      <TeamPlayers
                        team={team}
                        currentRound={currentRoundNumber}
                        selectedPlayerId={activeRoom.round.faceoffPlayerIds[teamId]}
                        onPick={(playerId) => handlePickStarter(teamId, playerId)}
                      />
                    </article>
                  );
                })}
              </div>
              <div className="mx-auto max-w-2xl border border-[#e7b958]/40 bg-[#15130e] p-5 text-center">
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#e7b958]">Who answers first?</div>
                <p className="mt-2 text-sm text-[#aab2c0]">Choose one player from each side, then select who won the buzzer.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Button onClick={() => handleBeginFaceoff("alpha")} disabled={!canBeginFaceoff}>{activeRoom.teams.alpha.name}</Button>
                  <Button onClick={() => handleBeginFaceoff("beta")} disabled={!canBeginFaceoff}>{activeRoom.teams.beta.name}</Button>
                </div>
              </div>
            </section>
          ) : null}

          {activeRoom.phase === "playing" ? (
            <section className="mx-auto max-w-5xl">
              <div className="text-center">
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-[#e7b958]">Round {activeRoom.currentRound} · {activeRoom.round.roundPoints} points on the board</div>
                <h2 className="mt-2 font-display text-4xl uppercase leading-none md:text-6xl">{currentQuestion?.prompt}</h2>
                <p className="mt-3 text-sm text-[#aab2c0]">
                  {activeRoom.round.activeGuessTeamId ? activeRoom.teams[activeRoom.round.activeGuessTeamId].name : "The active team"} answers.
                </p>
              </div>

              {pendingGuess ? (
                <div className="mt-8 border-t-4 border-[#e7b958] bg-[#111722] p-6">
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#e7b958]">Answer received</div>
                  <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <div className="text-sm text-[#8e98a7]">{pendingGuessPlayer?.name || activeRoom.teams[pendingGuess.teamId].name} said</div>
                      <div className="font-display text-5xl uppercase text-white md:text-7xl">“{pendingGuess.word}”</div>
                    </div>
                    <Badge variant={pendingGuess.teamId === "alpha" ? "danger" : "secondary"}>{activeRoom.teams[pendingGuess.teamId].name}</Badge>
                  </div>
                  <div className="mt-7">
                    <div className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[#8e98a7]">Choose the matching board answer</div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {hiddenAnswers.map(({ answer, index }) => {
                        const suggested = managerMatchCandidates.some((candidate) => candidate.index === index);
                        return (
                          <button
                            key={`${answer.word}-${index}`}
                            type="button"
                            onClick={() => handleResolvePendingMatch(index)}
                            className={clsx(
                              "grid grid-cols-[40px_1fr_auto] items-center border px-4 py-3 text-left transition-colors",
                              suggested ? "border-success bg-success/10 hover:bg-success/20" : "border-[#303a49] bg-[#0a0f17] hover:border-[#e7b958]"
                            )}
                          >
                            <span className="font-display text-2xl text-[#e7b958]">{index + 1}</span>
                            <strong className="truncate uppercase">{answer.word}</strong>
                            <span className="text-sm text-[#aab2c0]">{scoreAnswer(answer, activeRoom.round.multiplier)} pts</span>
                          </button>
                        );
                      })}
                    </div>
                    <Button className="mt-5 w-full" variant="danger" onClick={handleResolveNoCoincidence}>No match · mark an X</Button>
                  </div>
                </div>
              ) : (
                <div className="mt-8 grid min-h-72 place-items-center border border-[#303a49] bg-[#0d121b] p-8 text-center">
                  <div>
                    <div className="mx-auto grid h-16 w-16 place-items-center border-2 border-[#e7b958] font-display text-4xl text-[#e7b958]">?</div>
                    <h3 className="mt-5 font-display text-4xl uppercase">Waiting for an answer</h3>
                    <p className="mt-2 text-sm text-[#8e98a7]">The player&apos;s answer will appear here for you to confirm.</p>
                  </div>
                </div>
              )}
            </section>
          ) : null}

          {activeRoom.phase === "roundComplete" ? (
            <section className="mx-auto max-w-5xl text-center">
              <div className="text-xs font-bold uppercase tracking-[0.22em] text-[#e7b958]">Round {activeRoom.currentRound} complete</div>
              <h2 className="mt-2 font-display text-6xl uppercase md:text-8xl">Scoreboard</h2>
              <div className="mt-8 grid gap-5 md:grid-cols-2">
                {(["alpha", "beta"] as TeamId[]).map((teamId) => (
                  <div key={teamId} className={clsx("border-t-4 bg-[#111722] p-7", teamId === "alpha" ? "border-[#f24f43]" : "border-[#4fbdf0]")}>
                    <Avatar size="xl" src={activeRoom.teams[teamId].logoUrl ?? undefined} fallback={activeRoom.teams[teamId].name} alt={activeRoom.teams[teamId].name} />
                    <div className="mt-4 font-display text-4xl uppercase">{activeRoom.teams[teamId].name}</div>
                    <div className="font-display text-7xl text-[#e7b958]">{activeRoom.teams[teamId].score}</div>
                  </div>
                ))}
              </div>
              <div className="mx-auto mt-7 max-w-2xl border border-[#303a49] bg-[#0d121b] p-5">
                <label className="block text-left text-xs font-bold uppercase tracking-[0.18em] text-[#8e98a7]" htmlFor="next-question">Next question</label>
                <select
                  id="next-question"
                  className="mt-2 w-full border border-[#3a4556] bg-[#080c13] px-3 py-3 text-white"
                  value={activeRoom.round.preparedQuestionIndex}
                  onChange={(event) => handleSetPreparedQuestion(Number(event.target.value))}
                >
                  {activeRoom.questions.map((question, index) => <option key={question.id} value={index}>{index + 1}. {question.prompt}</option>)}
                </select>
                <Button className="mt-4 w-full" onClick={handleStartRound}>Set up next round</Button>
              </div>
            </section>
          ) : null}
        </div>
      </main>
    );
  }

  if (viewMode === "user") {
    const team = activeInviteTeam;
    const selectedParticipant = activeTeam ? getParticipant(activeRoom, activeTeam, activeRoom.round.faceoffPlayerIds[activeTeam]) : null;
    return (
      <main className="min-h-screen bg-[#080b12] text-white">
        <header className={clsx("border-b-4 bg-[#0d111a]", activeTeam === "alpha" ? "border-[#f24f43]" : "border-[#4fbdf0]")}>
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4">
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#e7b958]">Family Feud · Player</div>
              <h1 className="truncate font-display text-4xl uppercase">{team?.name || activeRoom.title}</h1>
            </div>
            {team ? <Avatar size="lg" src={team.logoUrl ?? undefined} fallback={team.name} alt={team.name} /> : null}
          </div>
        </header>

        <div className="mx-auto max-w-4xl px-4 py-7">
          {syncFeedback ? <div className="mb-5 border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">{syncFeedback}</div> : null}
          {copyFeedback ? <div className="mb-5 border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">{copyFeedback}</div> : null}

          {!activeInviteTarget ? (
            <div className="border border-danger/40 bg-danger/10 p-6 text-center text-danger">This link does not belong to a team.</div>
          ) : null}

          {activeInviteTarget && activeRoom.phase === "notStarted" ? (
            <section className="grid min-h-[65vh] place-items-center text-center">
              <div>
                <div className="mx-auto grid h-20 w-20 place-items-center border-2 border-[#e7b958] font-display text-5xl text-[#e7b958]">FF</div>
                <h2 className="mt-6 font-display text-5xl uppercase">The lobby is still closed</h2>
                <p className="mt-3 text-[#9da6b5]">Stay on this page. It will update when the manager opens the teams.</p>
              </div>
            </section>
          ) : null}

          {activeInviteTarget && activeRoom.phase === "teamLobby" ? (
            <section className="mx-auto max-w-2xl">
              {!activeIdentity ? (
                <div className="border-t-4 border-[#e7b958] bg-[#111722] p-6">
                  <div className="flex items-center gap-4">
                    <Avatar size="xl" src={currentMember?.profilePic ?? undefined} fallback={currentMember?.nickname || "?"} alt={currentMember?.nickname || "User"} />
                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#e7b958]">Your Goonginga account</div>
                      <h2 className="font-display text-4xl uppercase">{currentMember?.nickname || "Sign in"}</h2>
                    </div>
                  </div>
                  {activeInviteTeamIsEmpty ? (
                    <div className="mt-6">
                      <Input label="Team name" value={captainTeamName} onChange={(event) => setCaptainTeamName(event.target.value)} placeholder="Choose a name" />
                      <p className="mt-2 text-xs text-[#9da6b5]">You will be captain because you are the first player to join.</p>
                    </div>
                  ) : (
                    <p className="mt-6 text-sm text-[#aab2c0]">You are joining {team?.name}. Your name and picture come from your profile.</p>
                  )}
                  <Button className="mt-6 w-full" onClick={handleJoinTeam} disabled={!canJoin}>Join team</Button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="border-t-4 border-[#e7b958] bg-[#111722] p-6">
                    <div className="flex items-center gap-4">
                      <Avatar size="xl" src={activeIdentityParticipant?.profilePic ?? undefined} fallback={activeIdentityParticipant?.name || "?"} alt={activeIdentityParticipant?.name || "Player"} />
                      <div>
                        <div className="text-xs font-bold uppercase tracking-[0.18em] text-success">Connected</div>
                        <h2 className="font-display text-4xl uppercase">{activeIdentityParticipant?.name}</h2>
                        <p className="text-sm text-[#9da6b5]">{activeUserIsCaptain ? "Team captain" : "Team member"}</p>
                      </div>
                    </div>
                  </div>

                  {activeUserIsCaptain ? (
                    <div className="border border-[#303a49] bg-[#0d121b] p-6">
                      <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#e7b958]">Customize your team</div>
                      <div className="mt-5 space-y-5">
                        <Input label="Name" value={captainTeamName} onChange={(event) => setCaptainTeamName(event.target.value)} />
                        <ImageUploadField
                          label="Logo"
                          value={captainTeamLogo}
                          onChange={setCaptainTeamLogo}
                          type="logo"
                          previewAlt={`${team?.name || "Team"} logo`}
                          placeholder="Paste a URL or upload an image"
                        />
                        <Button className="w-full" onClick={handleCustomizeTeam} disabled={!captainTeamName.trim()}>Save team</Button>
                      </div>
                    </div>
                  ) : null}

                  <div>
                    <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#8e98a7]">Your team · {team?.players.length}/{MAX_PLAYERS_PER_TEAM}</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {team?.players.map((player) => (
                        <div key={player.id} className="flex items-center gap-3 border border-[#303a49] bg-[#111722] p-3">
                          <Avatar size="sm" src={player.profilePic ?? undefined} fallback={player.name} alt={player.name} />
                          <span className="truncate">{player.name}</span>
                          {team.captainId === player.id ? <span className="ml-auto text-xs text-[#e7b958]">CAP</span> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>
          ) : null}

          {activeInviteTarget && activeRoom.phase === "choosingParticipant" ? (
            <section className="grid min-h-[65vh] place-items-center text-center">
              <div className="w-full max-w-2xl">
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-[#e7b958]">Round {activeRoom.currentRound}</div>
                <h2 className="mt-3 font-display text-5xl uppercase leading-none md:text-7xl">{currentQuestion?.prompt}</h2>
                <div className={clsx("mx-auto mt-9 flex max-w-md items-center gap-4 border p-5", selectedParticipant ? "border-[#e7b958] bg-[#17140d]" : "border-[#303a49] bg-[#111722]")}>
                  <Avatar size="xl" src={selectedParticipant?.profilePic ?? team?.logoUrl ?? undefined} fallback={selectedParticipant?.name || team?.name || "?"} alt={selectedParticipant?.name || "Waiting"} />
                  <div className="text-left">
                    <div className="text-xs uppercase tracking-[0.18em] text-[#8e98a7]">Your team&apos;s contestant</div>
                    <div className="font-display text-4xl uppercase">{selectedParticipant?.name || "The manager is choosing"}</div>
                    {selectedParticipant?.id === activeIdentityParticipant?.id ? <div className="mt-1 text-sm font-bold text-[#e7b958]">Get ready: it&apos;s you.</div> : null}
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {activeInviteTarget && activeRoom.phase === "playing" ? (
            <section className="grid min-h-[65vh] place-items-center">
              <div className="w-full max-w-2xl text-center">
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-[#e7b958]">Round {activeRoom.currentRound} · {activeRoom.round.roundPoints} points</div>
                <h2 className="mt-3 font-display text-4xl uppercase leading-none md:text-6xl">{currentQuestion?.prompt}</h2>
                {userCanSubmitAnswer ? (
                  <div className="mt-9 border-t-4 border-[#e7b958] bg-[#111722] p-6 text-left">
                    <label htmlFor="player-answer" className="text-xs font-bold uppercase tracking-[0.2em] text-[#e7b958]">Your answer</label>
                    <input
                      id="player-answer"
                      value={playerGuess}
                      onChange={(event) => setPlayerGuess(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && playerGuess.trim() && activeTeam) {
                          handleSubmitGuess(activeTeam, playerGuess);
                          setPlayerGuess("");
                        }
                      }}
                      placeholder="Type the first thing that comes to mind..."
                      autoComplete="off"
                      className="mt-3 h-16 w-full border-2 border-[#e7b958] bg-[#070b12] px-4 font-display text-3xl uppercase text-white placeholder:text-[#596170] focus:outline-none"
                    />
                    <Button
                      className="mt-4 w-full"
                      disabled={!playerGuess.trim()}
                      onClick={() => {
                        if (!activeTeam) return;
                        handleSubmitGuess(activeTeam, playerGuess);
                        setPlayerGuess("");
                      }}
                    >
                      Submit answer
                    </Button>
                  </div>
                ) : (
                  <div className="mt-9 border border-[#303a49] bg-[#111722] p-7">
                    <div className="font-display text-4xl uppercase">{pendingGuess ? "Answer submitted" : "Wait for your turn"}</div>
                    <p className="mt-2 text-sm text-[#9da6b5]">
                      {pendingGuess ? "The manager is comparing it with the board." : `${activeRoom.round.activeGuessTeamId ? activeRoom.teams[activeRoom.round.activeGuessTeamId].name : "The other team"} is answering.`}
                    </p>
                  </div>
                )}
              </div>
            </section>
          ) : null}

          {activeInviteTarget && activeRoom.phase === "roundComplete" ? (
            <section className="grid min-h-[65vh] place-items-center text-center">
              <div className="w-full max-w-xl">
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-[#e7b958]">Round {activeRoom.currentRound} complete</div>
                <h2 className="mt-3 font-display text-6xl uppercase">Scoreboard</h2>
                <div className="mt-7 grid grid-cols-2 gap-3">
                  {(["alpha", "beta"] as TeamId[]).map((teamId) => (
                    <div key={teamId} className={clsx("border-t-4 bg-[#111722] p-5", teamId === "alpha" ? "border-[#f24f43]" : "border-[#4fbdf0]")}>
                      <div className="truncate font-display text-2xl uppercase">{activeRoom.teams[teamId].name}</div>
                      <div className="font-display text-6xl text-[#e7b958]">{activeRoom.teams[teamId].score}</div>
                    </div>
                  ))}
                </div>
                <p className="mt-6 text-sm text-[#9da6b5]">The next round will appear automatically.</p>
              </div>
            </section>
          ) : null}
        </div>
      </main>
    );
  }

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
              <DecorRail />
            </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={viewMode === "manager" ? "primary" : "secondary"}>{viewMode === "manager" ? "Manager console" : "Player link"}</Badge>
            <Link href="/">
              <Button variant="ghost">Back home</Button>
            </Link>
          </div>
        </header>

        {syncFeedback ? (
          <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
            {syncFeedback}
          </div>
        ) : null}

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

            {viewMode === "manager" ? (
              <Card variant="bordered" className="border-border bg-card/95">
                <CardHeader>
                  <CardTitle className="font-[family-name:var(--font-league-gothic)] text-3xl uppercase tracking-[0.14em]">
                    Run the round
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2 text-sm md:grid-cols-3">
                    <div className={clsx("border p-3", !activeRoom.gameStarted ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}><span className="font-semibold">1. Open lobby</span><br />Players can join after Start game.</div>
                    <div className={clsx("border p-3", activeRoom.round.phase === "question" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}><span className="font-semibold">2. Face-off</span><br />Start round, choose both players, then pick who buzzed first.</div>
                    <div className={clsx("border p-3", isAnswerPhase(activeRoom.round.phase) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}><span className="font-semibold">3. Confirm board</span><br />Approve a matching answer or mark NO COINCIDENCE.</div>
                  </div>
                  <div className="rounded-xl border border-border bg-surface/60 p-3 text-sm text-muted-foreground">
                    Current state: <span className="font-semibold text-foreground">{activeRoom.round.phase.replace("-", " ")}</span>. Question multiplier: x{currentQuestion?.multiplier || 1}.
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    <Button onClick={handleStartGameLobby} disabled={activeRoom.gameStarted}>
                      Start game
                    </Button>
                    <Button onClick={handleStartRound} disabled={!canStartRound}>
                      Start round
                    </Button>
                    <Button variant="outline" onClick={handleFinishRound} disabled={activeRoom.round.phase === "lobby"}>
                      Close round
                    </Button>
                  </div>

                  {room ? (
                    <div className="rounded-xl border border-border bg-surface/60 p-3 text-sm text-muted-foreground">
                      {nextRoundStarterHint}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ) : (
              <Card variant="bordered" className="border-border bg-card/95">
                <CardHeader>
                  <CardTitle className="font-[family-name:var(--font-league-gothic)] text-3xl uppercase tracking-[0.14em]">
                    Your turn
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {activeIdentityParticipant && activeIdentity ? (
                    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface/60 p-3">
                      <Avatar size="lg" src={activeIdentityParticipant.profilePic ?? teamForInvite?.logoUrl ?? undefined} fallback={activeIdentityParticipant.name} alt={activeIdentityParticipant.name} />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white">{activeIdentityParticipant.name}</div>
                        <div className="truncate text-xs text-muted-foreground">{activeRoom.teams[activeIdentity.teamId].name}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border/60 bg-surface/40 p-4 text-sm text-muted-foreground">
                      Join with your team invite before answering.
                    </div>
                  )}

                  {userCanSubmitAnswer ? (
                    <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/10 p-4">
                      <Input
                        label={activeRoom.round.phase === "steal" ? "Steal answer" : "Answer"}
                        placeholder="Type your answer"
                        value={playerGuess}
                        onChange={(event) => setPlayerGuess(event.target.value)}
                      />
                      <Button
                        className="w-full"
                        onClick={() => {
                          if (!activeIdentity || !playerGuess.trim()) return;
                          handleSubmitGuess(activeIdentity.teamId, playerGuess);
                          setPlayerGuess("");
                        }}
                        disabled={!playerGuess.trim()}
                      >
                        Submit answer
                      </Button>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border bg-black/25 p-3 text-sm text-muted-foreground">
                      {!activeRoom.gameStarted
                        ? "Waiting for the manager to start the game."
                        : pendingGuess
                          ? "An answer is waiting for manager confirmation."
                          : activeRoom.round.activeGuessTeamId
                            ? `${teamLabel(activeRoom.round.activeGuessTeamId)} is answering.`
                            : "Waiting for the next answer window."}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </section>

        {viewMode === "manager" ? (
          <>
            <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
              <Panel title="Share links" eyebrow="Step 1 - Open each workspace">
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Use the manager link only at the host computer, send a player link to each team, and put the stream link into OBS as a browser source. The links stay assigned to this game.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button onClick={handleStartGameLobby} disabled={activeRoom.gameStarted}>
                      Start game
                    </Button>
                    <Badge variant={activeRoom.gameStarted ? "success" : "warning"}>
                      {activeRoom.gameStarted ? "Links open" : "Links waiting"}
                    </Badge>
                    {copyFeedback ? <div className="text-sm text-primary">{copyFeedback}</div> : null}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="border border-primary/30 bg-primary/10 p-3">
                      <div className="text-xs uppercase tracking-[0.25em] text-primary">Manager link</div>
                      <div className="mt-2 break-all text-xs text-muted-foreground">{formatGameViewUrl("manager", activeRoom)}</div>
                      <Button size="sm" variant="outline" className="mt-3" onClick={() => handleCopyLink(formatGameViewUrl("manager", activeRoom), "Manager link")}>Copy manager link</Button>
                    </div>
                    <div className="border border-accent/30 bg-accent/10 p-3">
                      <div className="text-xs uppercase tracking-[0.25em] text-accent">Stream key link</div>
                      <div className="mt-2 break-all text-xs text-muted-foreground">{formatGameViewUrl("stream", activeRoom)}</div>
                      <Button size="sm" variant="outline" className="mt-3" onClick={() => handleCopyLink(formatGameViewUrl("stream", activeRoom), "Stream link")}>Copy stream link</Button>
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 text-xs uppercase tracking-[0.25em] text-muted-foreground">User links - one per team</div>
                    <div className="grid gap-4 md:grid-cols-2">
                    {(Object.entries(activeRoom.teams) as Array<[TeamId, Team]>).map(([teamId, team], index) => (
                      <div key={teamId} className="border border-border bg-black/25 p-4">
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
                          {formatInviteUrl(team.inviteToken)}
                        </div>
                        <div className="mt-3 flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleCopyInvite(team.inviteToken)}>
                            Copy player link
                          </Button>
                        </div>
                      </div>
                    ))}
                    </div>
                  </div>
                </div>
              </Panel>

              <Panel title="Face-off and answer desk" eyebrow="Step 2 - Run the live question">
                <div className="space-y-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Choose the next question</div>
                    <select
                      className="mt-2 w-full rounded-md border border-input-border bg-input px-3 py-2 text-foreground"
                      value={activeRoom.round.preparedQuestionIndex}
                      onChange={(event) => handleSetPreparedQuestion(Number(event.target.value))}
                      disabled={activeRoundInProgress}
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

                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="rounded-xl border border-border bg-black/25 p-4">
                      <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Face-off control</div>
                      <div className="mt-3 grid gap-2">
                        <Button variant="outline" onClick={() => handleBeginFaceoff("alpha")} disabled={!canBeginFaceoff}>
                          Alpha starts
                        </Button>
                        <Button variant="outline" onClick={() => handleBeginFaceoff("beta")} disabled={!canBeginFaceoff}>
                          Beta starts
                        </Button>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Button size="sm" variant="ghost" onClick={() => handleFaceoffWinner("alpha")}>Force Alpha control</Button>
                          <Button size="sm" variant="ghost" onClick={() => handleFaceoffWinner("beta")}>Force Beta control</Button>
                        </div>
                        <Button variant="danger" onClick={handleBothFaceoffMiss}>Both teams miss</Button>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border bg-black/25 p-4">
                      <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Answer confirmation</div>
                      {pendingGuess ? (
                        <div className="mt-3 space-y-3">
                          <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
                            {pendingGuessPlayer?.name || teamLabel(pendingGuess.teamId)} submitted "{pendingGuess.word}".
                          </div>
                          <div className="grid gap-2">
                            {managerMatchCandidates.length > 0 ? managerMatchCandidates.map(({ answer, index }) => (
                              <Button
                                key={`${answer.word}-${index}`}
                                size="sm"
                                variant="outline"
                                onClick={() => handleResolvePendingMatch(index)}
                              >
                                Match #{index + 1}: {answer.word} ({scoreAnswer(answer, activeRoom.round.multiplier)} pts)
                              </Button>
                            )) : (
                              <div className="rounded-lg border border-dashed border-border/60 p-3 text-sm text-muted-foreground">
                                No hidden board answer matches this text.
                              </div>
                            )}
                            <Button variant="danger" onClick={handleResolveNoCoincidence}>
                              NO COINCIDENCE
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 space-y-3">
                          <Input
                            label="Manager answer entry"
                            placeholder="Type an answer to search the board"
                            value={managerGuess}
                            onChange={(event) => setManagerGuess(event.target.value)}
                          />
                          <Button
                            className="w-full"
                            onClick={handleManagerSubmitGuess}
                            disabled={!activeRoom.round.activeGuessTeamId || !isAnswerPhase(activeRoom.round.phase) || !managerGuess.trim()}
                          >
                            Submit for {activeRoom.round.activeGuessTeamId ? teamLabel(activeRoom.round.activeGuessTeamId) : "active team"}
                          </Button>
                          {managerGuess.trim() ? (
                            <div className="grid gap-2">
                              {managerMatchCandidates.map(({ answer, index }) => (
                                <div key={`${answer.word}-${index}`} className="rounded-lg border border-border bg-surface/60 px-3 py-2 text-sm text-foreground">
                                  #{index + 1} {answer.word} - {scoreAnswer(answer, activeRoom.round.multiplier)} pts
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      )}
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
                              <span className="flex min-w-0 items-center gap-2">
                                <Avatar size="sm" src={player.profilePic ?? undefined} fallback={player.name} alt={player.name} />
                                <span className="truncate">{player.name}</span>
                              </span>
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
                            selectedPlayerId={activeRoom.round.faceoffPlayerIds[teamId]}
                            onPick={(playerId) => handlePickStarter(teamId, playerId)}
                            disabled={activeRoom.round.phase !== "question"}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
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
          </>
        ) : (
          <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <Panel title="Join team" eyebrow="Player lobby">
              <div className="space-y-4">
                {activeInviteTarget ? (
                  <div className="space-y-4 rounded-2xl border border-border bg-surface/60 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="primary">Invite active</Badge>
                      <Badge variant="outline">{activeInviteTarget.teamId === "alpha" ? "Alpha channel" : "Beta channel"}</Badge>
                    </div>
                    {!activeRoom.gameStarted ? (
                      <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
                        Waiting for the manager to start the game before players can join.
                      </div>
                    ) : !isAuthenticated || !currentMember ? (
                      <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
                        Your Goonginga session is required to join this team.
                      </div>
                    ) : activeInviteTeamIsEmpty ? (
                      <>
                        <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 p-3">
                          <Avatar size="lg" src={currentMember.profilePic ?? undefined} fallback={currentMember.nickname} alt={currentMember.nickname} />
                          <div>
                            <div className="font-semibold text-white">{currentMember.nickname}</div>
                            <div className="text-xs text-muted-foreground">This Goonginga account will become captain.</div>
                          </div>
                        </div>
                        <Input
                          label="Team name"
                          placeholder="Enter team name"
                          value={captainTeamName}
                          onChange={(event) => setCaptainTeamName(event.target.value)}
                        />
                      </>
                    ) : (
                      <div className="flex items-center gap-3 rounded-xl border border-border bg-black/25 p-3">
                        <Avatar size="lg" src={currentMember.profilePic ?? undefined} fallback={currentMember.nickname} alt={currentMember.nickname} />
                        <div>
                          <div className="font-semibold text-white">{currentMember.nickname}</div>
                          <div className="text-xs text-muted-foreground">Your profile photo and name come from Goonginga.</div>
                        </div>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={handleJoinTeam} disabled={!canJoin}>{activeIdentity ? "Refresh profile" : "Join team"}</Button>
                    </div>
                    <div className="rounded-xl border border-border bg-black/25 p-3 text-sm text-muted-foreground">
                      {activeInviteTeamIsEmpty
                        ? "The first signed-in player becomes captain. Their saved Goonginga profile photo is used automatically."
                        : `Join ${teamForInvite?.name || "this team"} with your saved Goonginga profile.`}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/60 bg-surface/40 p-4 text-sm text-muted-foreground">
                    Open one of the secret invite links to bind this page to a team.
                  </div>
                )}
              </div>
            </Panel>

            <Panel title="Team members" eyebrow="Player view">
              <div className="grid gap-4 md:grid-cols-2">
                {(Object.entries(activeRoom.teams) as Array<[TeamId, Team]>).map(([teamId, team]) => (
                  <div key={teamId} className="rounded-2xl border border-border bg-black/25 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-[family-name:var(--font-league-gothic)] text-3xl uppercase tracking-[0.12em] text-white">
                        {team.name}
                      </div>
                      <Badge variant={teamId === "alpha" ? "primary" : "secondary"}>{team.players.length}/5</Badge>
                    </div>
                    <div className="mt-3 space-y-2">
                      {team.players.length > 0 ? team.players.map((player) => (
                        <div key={player.id} className="flex items-center gap-2 rounded-lg border border-border bg-surface/70 px-3 py-2 text-sm">
                          <Avatar size="sm" src={player.profilePic ?? undefined} fallback={player.name} alt={player.name} />
                          <span className="truncate text-foreground">{player.name}</span>
                        </div>
                      )) : (
                        <div className="rounded-lg border border-dashed border-border/60 p-3 text-sm text-muted-foreground">
                          Waiting...
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </section>
        )}
      </div>
    </main>
  );
}

export default function FamilyFeudPage() {
  return <Suspense fallback={<main className="min-h-screen bg-[#070a10]" />}><MinigamesPage /></Suspense>;
}

