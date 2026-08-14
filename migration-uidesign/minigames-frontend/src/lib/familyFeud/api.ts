import { apiRequest, getApiBase } from "@/lib/api/client";
import type { FeudProjection, FeudQuestionAnswerDraft, FeudQuestionRecord, TeamSide } from "./types";

export type FeudView = "lobby" | "player" | "manager" | "spectator";

export function getFeudGame(gameCode: string, view: FeudView, token?: string | null) {
  return apiRequest<FeudProjection>(`/family-feud/games/${encodeURIComponent(gameCode)}?view=${view}`, { token: token || undefined, cache: "no-store" });
}

export function createFeudGame(token: string, input: { title: string; teamAlphaName: string; teamBetaName: string; config: Record<string, unknown> }) {
  return apiRequest<FeudProjection>("/family-feud/games", { method: "POST", token, body: input });
}

export function joinFeudGame(token: string, gameCode: string, role: "PLAYER" | "SPECTATOR", side?: TeamSide, inviteToken?: string) {
  return apiRequest<FeudProjection>(`/family-feud/games/${encodeURIComponent(gameCode)}/join`, { method: "POST", token, body: { role, side, inviteToken } });
}

export function sendFeudAction(token: string, gameCode: string, action: string, payload: Record<string, unknown> = {}) {
  return apiRequest<FeudProjection>(`/family-feud/games/${encodeURIComponent(gameCode)}/actions`, { method: "POST", token, body: { action, payload } });
}

export function sendFeudHeartbeat(token: string, gameCode: string) {
  return apiRequest<void>(`/family-feud/games/${encodeURIComponent(gameCode)}/heartbeat`, { method: "POST", token, timeoutMs: 5000 });
}

export function feudEventsUrl(gameCode: string, view: FeudView) {
  return `${getApiBase()}/family-feud/games/${encodeURIComponent(gameCode)}/events?view=${view}`;
}

export function listFeudQuestions(token?: string | null) {
  return apiRequest<FeudQuestionRecord[]>("/family-feud/questions", { token: token || undefined, cache: "no-store" });
}

export interface FeudQuestionInput {
  question: string;
  category: string;
  pack: string;
  active: boolean;
  answers: FeudQuestionAnswerDraft[];
}

export function saveFeudQuestion(token: string, input: FeudQuestionInput, questionId?: number) {
  return apiRequest<FeudQuestionRecord>(questionId ? `/family-feud/questions/${questionId}` : "/family-feud/questions", {
    method: questionId ? "PUT" : "POST",
    token,
    body: input,
  });
}

export function importFeudQuestions(token: string, input: { pack: string; category?: string; questions: FeudQuestionInput[] }) {
  return apiRequest<{ count: number; questions: FeudQuestionRecord[] }>("/family-feud/questions/import", {
    method: "POST",
    token,
    body: input,
  });
}

export function deactivateFeudQuestion(token: string, questionId: number) {
  return apiRequest<FeudQuestionRecord>(`/family-feud/questions/${questionId}`, { method: "DELETE", token });
}
