import { apiRequest } from "@/lib/api/client";

export type MiniGameType = "JEOPARDY" | "FAMILY_FEUD" | "CUSTOM";
export type MiniGameStatus = "LIVE" | "UNDER_DEVELOPMENT";

export type MiniGameMember = { id: number; username: string; avatarUrl: string | null };
export type FamilyFeudStatus = {
  slug: "family-feud"; title: string; description: string; coverImageUrl: string | null;
  status: "UNDER_DEVELOPMENT"; underDevelopmentBy: MiniGameMember | null;
};
export type JeopardyQuestion = { id: string; question: string; answer: string; reward: number };
export type JeopardyCategory = { id: string; name: string; questions: JeopardyQuestion[] };
export type BoardQuestion = { id: string; reward: number; used: boolean; selected: boolean; requested: boolean };
export type PublicBoard = { categories: Array<{ id: string; name: string; questions: BoardQuestion[] }> };

export type MiniGame = {
  id: number; slug: string; title: string; description: string; coverImageUrl: string | null;
  gameType: MiniGameType; status: MiniGameStatus; createdAt: string; updatedAt: string;
  createdBy: MiniGameMember; underDevelopmentBy: MiniGameMember | null; currentPlayer: MiniGameMember | null;
  board: PublicBoard | null;
  gameState: { turnMemberId: number | null; requestedQuestionId: string | null; currentQuestionId: string | null; revealed: boolean };
};

export type ManagedMiniGame = MiniGame & { config: { categories: JeopardyCategory[] }; state: MiniGame["gameState"] & { usedQuestionIds: string[] } };
export type PlayerMiniGame = MiniGame & { player: { isTurn: boolean; requestedQuestionId: string | null; currentQuestion: (JeopardyQuestion & { categoryName: string; revealed: boolean }) | null } };

export function getGames() { return apiRequest<MiniGame[]>("/minigames/games", { cache: "no-store" }); }
export function getFamilyFeudStatus() { return apiRequest<FamilyFeudStatus>("/minigames/system/family-feud", { cache: "no-store" }); }
export function getGame(slug: string) { return apiRequest<MiniGame>(`/minigames/games/${encodeURIComponent(slug)}`, { cache: "no-store" }); }
export function getPlayerGame(slug: string, token: string) { return apiRequest<PlayerMiniGame>(`/minigames/games/${encodeURIComponent(slug)}/player`, { token, cache: "no-store" }); }
export function getManagedGame(slug: string, token: string) { return apiRequest<ManagedMiniGame>(`/minigames/games/${encodeURIComponent(slug)}/manage`, { token, cache: "no-store" }); }

export function createGame(input: { title: string; slug: string; description: string; gameType: MiniGameType }, token: string) {
  return apiRequest<ManagedMiniGame>("/minigames/games", { method: "POST", token, body: input });
}
export function saveGame(slug: string, input: Partial<Pick<ManagedMiniGame, "title" | "slug" | "description" | "coverImageUrl" | "config">>, token: string) {
  return apiRequest<ManagedMiniGame>(`/minigames/games/${encodeURIComponent(slug)}`, { method: "PATCH", token, body: input });
}
export function setGameStatus(slug: string, status: MiniGameStatus, token: string) {
  return apiRequest<ManagedMiniGame>(`/minigames/games/${encodeURIComponent(slug)}/status`, { method: "PATCH", token, body: { status } });
}
export function setTurn(slug: string, memberId: number, token: string) {
  return apiRequest<ManagedMiniGame>(`/minigames/games/${encodeURIComponent(slug)}/turn`, { method: "PUT", token, body: { memberId } });
}
export function requestQuestion(slug: string, questionId: string, token: string) {
  return apiRequest<MiniGame>(`/minigames/games/${encodeURIComponent(slug)}/request`, { method: "POST", token, body: { questionId } });
}
export function selectQuestion(slug: string, questionId: string, token: string) {
  return apiRequest<ManagedMiniGame>(`/minigames/games/${encodeURIComponent(slug)}/select`, { method: "POST", token, body: { questionId } });
}
export function resolveQuestion(slug: string, action: "reveal" | "complete", token: string) {
  return apiRequest<ManagedMiniGame>(`/minigames/games/${encodeURIComponent(slug)}/resolve`, { method: "POST", token, body: { action } });
}
export function findMembers(search: string, token: string) {
  return apiRequest<MiniGameMember[]>(`/minigames/members?search=${encodeURIComponent(search)}`, { token, cache: "no-store" });
}
export async function uploadCover(slug: string, image: File, token: string) {
  const formData = new FormData(); formData.append("image", image);
  return apiRequest<{ url: string; game: ManagedMiniGame }>(`/minigames/games/${encodeURIComponent(slug)}/cover`, { method: "POST", token, formData });
}

export function newJeopardyQuestion(question: string, answer: string, reward: number): JeopardyQuestion {
  return { id: `question-${crypto.randomUUID()}`, question, answer, reward };
}
