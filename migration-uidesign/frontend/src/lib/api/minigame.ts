import { apiRequest } from "@/lib/api/client";

export type JeopardyPhase = "CREATED" | "PICKING_MEMBER" | "PICKING_QUESTION" | "RESPONDING" | "RESPONDED" | "FINALIZED";

export type MiniGameMember = { id: number; username: string; avatarUrl: string | null };
export type JeopardyQuestion = { id: string; question: string; answer?: string; reward: number; categoryName?: string; categoryId?: string };
export type JeopardyCategory = { id: string; name: string; questions: JeopardyQuestion[] };
export type JeopardyParticipant = { id: number; memberId: number; score: number; joinedAt: string | null; member: MiniGameMember };

export type JeopardyGame = {
  id: number;
  slug: string;
  title: string;
  description: string;
  coverImageUrl: string | null;
  gameType: "JEOPARDY" | "FAMILY_FEUD" | "CUSTOM";
  status: "LIVE" | "UNDER_DEVELOPMENT";
  phase: JeopardyPhase;
  currentPlayer: MiniGameMember | null;
  participants: JeopardyParticipant[];
  board: { categories: Array<{ id: string; name: string; questions: Array<{ id: string; reward: number; used: boolean; selected: boolean; requested: boolean; answeredMemberId: number | null; unanswered: boolean }> }> } | null;
  gameState: {
    turnMemberId: number | null;
    requestedQuestionId: string | null;
    currentQuestionId: string | null;
    revealed: boolean;
    responseText: string;
    answerCorrect: boolean | null;
    currentQuestion: (JeopardyQuestion & { categoryName: string }) | null;
    questionResults: Array<{ questionId: string; memberId: number | null; reward: number }>;
  };
  config?: { categories: JeopardyCategory[] };
  state?: JeopardyGame["gameState"] & { usedQuestionIds: string[]; respondedAt: string | null };
  currentQuestion?: (JeopardyQuestion & { answer: string; categoryName: string }) | null;
  player?: {
    isParticipant: boolean;
    joined: boolean;
    isTurn: boolean;
    score: number;
    requestedQuestionId: string | null;
    responseText: string;
    currentQuestion: (JeopardyQuestion & { categoryName: string }) | null;
  };
};

export function listMiniGames() {
  return apiRequest<JeopardyGame[]>("/minigames/games", { cache: "no-store" });
}

export function getActiveJeopardy() {
  return apiRequest<JeopardyGame>("/minigames/jeopardy/active", { cache: "no-store" });
}

export function getManagedMiniGame(token: string, slug: string) {
  return apiRequest<JeopardyGame>(`/minigames/games/${slug}/manage`, { token, cache: "no-store" });
}

export function searchMiniGameMembers(token: string, search: string) {
  return apiRequest<MiniGameMember[]>(`/minigames/members?search=${encodeURIComponent(search)}`, { token, cache: "no-store" });
}

export function createJeopardy(token: string, payload: { title: string; description: string; coverImageUrl?: string; participantIds: number[]; config: { categories: JeopardyCategory[] } }) {
  return apiRequest<JeopardyGame>("/minigames/games", { method: "POST", token, body: { ...payload, gameType: "JEOPARDY" } });
}

export function deleteMiniGame(token: string, slug: string) {
  return apiRequest<{ deleted: true; slug: string }>(`/minigames/games/${slug}`, { method: "DELETE", token });
}

function gameAction(token: string, slug: string, action: string, body?: unknown) {
  return apiRequest<JeopardyGame>(`/minigames/games/${slug}/${action}`, { method: "POST", token, body: body ?? {} });
}

export const startJeopardy = (token: string, slug: string) => gameAction(token, slug, "start");
export const awardJeopardyQuestion = (token: string, slug: string, questionId: string, memberId: number | null) => gameAction(token, slug, "award", { questionId, memberId });
export const finalizeJeopardy = (token: string, slug: string) => gameAction(token, slug, "finalize");
