export type FeudPhase =
  | "LOBBY"
  | "ROUND_INTRO"
  | "AWAITING_EXTERNAL_FACE_OFF"
  | "FACE_OFF_FIRST_ANSWER"
  | "FACE_OFF_SECOND_ANSWER"
  | "PLAY_PASS"
  | "ROUND_PLAY"
  | "STEAL"
  | "ROUND_RESULTS"
  | "FAST_MONEY"
  | "FINISHED"
  | "PAUSED";

export type TeamSide = "ALPHA" | "BETA";

export interface FeudPlayer {
  name: string;
  avatarUrl: string | null;
  ready: boolean;
  connected: boolean;
  isGuest?: boolean;
}

export interface FeudTeam {
  id?: number;
  side: TeamSide;
  name: string;
  color: string;
  score: number;
  captainName: string | null;
  captainMemberId?: number | null;
  players: FeudPlayer[];
  managerPlayers?: Array<FeudPlayer & { memberId: number }>;
}

export interface FeudBoardAnswer {
  id?: number;
  rank: number;
  revealed: boolean;
  answer?: string;
  points?: number;
  aliases?: string[];
}

export interface FeudProjection {
  serverNow: string;
  game: {
    code: string;
    title: string;
    phase: FeudPhase;
    pausedPhase: FeudPhase | null;
    currentRound: number;
    version: number;
    developmentMode: boolean;
    lastEvent: null | { id: string; type: "CORRECT" | "INCORRECT" | "NO_ANSWER"; label: string; at: string };
    timerEndsAt: string | null;
    manager: { name: string; avatarUrl: string | null };
    config: { maxPlayersPerTeam: number; answerSeconds: number; roundCount: number; fastMoneyTarget: number };
    teamsLocked: boolean;
    canJoin: boolean;
  };
  teams: FeudTeam[];
  round: null | {
    number: number;
    multiplier: number;
    question: string | null;
    category: string | null;
    bank: number;
    strikes: number;
    activeSide: TeamSide | null;
    currentPlayer: FeudPlayer | null;
    answerPending: boolean;
    board: FeudBoardAnswer[];
    faceOff: null | {
      alpha: Pick<FeudPlayer, "name" | "avatarUrl"> | null;
      beta: Pick<FeudPlayer, "name" | "avatarUrl"> | null;
      externalWinner: { name: string; side: TeamSide } | null;
      pendingWinnerName?: string | null;
      familyWinnerSide: TeamSide | null;
    };
    roundWinnerSide: TeamSide | null;
  };
  me: null | { role: "MANAGER" | "PLAYER" | "SPECTATOR"; side: TeamSide | null; ready: boolean; isCaptain: boolean; isCurrentPlayer: boolean; isGuest: boolean };
  manager?: {
    captainInvites: { alpha: string; beta: string };
    participants: Array<{ memberId: number; name: string; avatarUrl: string | null; role: string; teamSide: TeamSide | null; ready: boolean; connected: boolean; isGuest: boolean }>;
    pendingResponse: null | { id: number; text: string; playerName: string; suggestedAnswerIds: number[] };
    canUndoResponse: boolean;
    canUndoStrike: boolean;
    rawState: { pendingExternalWinnerMemberId: number | null; activeMemberId: number | null; playPassWinnerSide: TeamSide | null; revealedAnswerIds: number[] };
  };
  teamPrivate?: { suggestions: Array<{ text: string; playerName: string }> };
  fastMoney?: {
    questionIndex: number;
    questionCount: number;
    activePlayerIndex: number;
    total: number;
    target: number;
    complete: boolean;
    responses?: Array<{ playerIndex: number; questionIndex: number; text: string; answer: string | null; points: number }>;
  };
}

export interface FeudGameSummary {
  id: number;
  code: string;
  title: string;
  phase: FeudPhase;
  developmentMode: boolean;
  manager: { name: string; avatarUrl: string | null };
  teams: Array<{ side: TeamSide; name: string; score: number }>;
  playerCount: number;
  guestCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FeudQuestionAnswerDraft { answer: string; points: number; aliases: string[] }
export interface FeudQuestionRecord {
  id: number;
  question: string;
  category: string;
  pack: string;
  active: boolean;
  answers: Array<FeudQuestionAnswerDraft & { id: number; rank: number }>;
}
