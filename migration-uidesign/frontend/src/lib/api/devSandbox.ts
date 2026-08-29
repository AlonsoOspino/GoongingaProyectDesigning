import { apiRequest } from "@/lib/api/client";

export interface SandboxAutopilotResult {
  matchId: number;
  step: string;
  detail: string;
}

export interface SandboxMatchSummary {
  id: number;
  status: string;
  bestOf: number;
  gameNumber: number;
  mapWinsTeamA: number;
  mapWinsTeamB: number;
  teamAId: number;
  teamBId: number;
  teamAready: number;
  teamBready: number;
  phase: string | null;
  draftId: number | null;
}

export interface SandboxStatus {
  enabled: boolean;
  tournament: { id: number; name: string; state: string } | null;
  autopilot: {
    running: boolean;
    tickMs: number;
    lastResults: SandboxAutopilotResult[];
  };
  matches: SandboxMatchSummary[];
}

export interface SandboxCreateResult {
  matchId: number;
  draftId: number;
  teamA: { id: number; name: string };
  teamB: { id: number; name: string };
  status: SandboxStatus;
}

export function getSandboxStatus(token: string) {
  return apiRequest<SandboxStatus>("/dev-sandbox", { token });
}

export function createSandboxMatch(
  token: string,
  payload: { bestOf?: number; tickMs?: number; autopilot?: boolean } = {}
) {
  return apiRequest<SandboxCreateResult>("/dev-sandbox/match", {
    method: "POST",
    token,
    body: payload,
  });
}

export function deleteSandboxMatch(token: string, matchId: number) {
  return apiRequest<{ deletedMatchId: number; status: SandboxStatus }>(
    `/dev-sandbox/match/${matchId}`,
    { method: "DELETE", token }
  );
}

export function setSandboxAutopilot(
  token: string,
  payload: { running: boolean; tickMs?: number }
) {
  return apiRequest<SandboxStatus>("/dev-sandbox/autopilot", {
    method: "POST",
    token,
    body: payload,
  });
}

export function stepSandboxOnce(token: string) {
  return apiRequest<{ results: SandboxAutopilotResult[]; status: SandboxStatus }>(
    "/dev-sandbox/step",
    { method: "POST", token }
  );
}
