import { apiRequest } from "@/lib/api/client";

export type MvpCandidate = {
  id: number;
  memberId: number;
  displayName: string;
  imageUrl: string | null;
  sortOrder: number;
  voteCount?: number;
};

export type MvpCampaign = {
  id: number;
  matchId: number;
  status: "DRAFT" | "OPEN" | "CLOSED";
  winnerCandidateId: number | null;
  openedAt: string | null;
  closedAt: string | null;
  publishedAt: string | null;
  candidates: MvpCandidate[];
};

export type MvpResponse = {
  active: boolean;
  reason?: string;
  campaign: MvpCampaign | null;
};

export function getMvpVoting(options?: { cache?: RequestCache }) {
  return apiRequest<MvpResponse>("/mvp-voting", options);
}

export function voteForMvp(token: string, candidateId: number) {
  return apiRequest("/mvp-voting/vote", {
    method: "POST",
    token,
    body: { candidateId },
  });
}

export function getMyMvpVote(token: string) {
  return apiRequest<{ hasVoted: boolean; candidateId: number | null }>("/mvp-voting/my-vote", {
    token,
    cache: "no-store",
  });
}

export function getMvpManage(token: string) {
  return apiRequest<{
    active: boolean;
    reason?: string;
    campaign: MvpCampaign | null;
    match?: {
      id: number;
      title: string | null;
      status: string;
      winningTeam: string;
    };
  }>("/mvp-voting/manage", {
    token,
    cache: "no-store",
  });
}

export function updateMvpStatus(token: string, status: "OPEN" | "CLOSED") {
  return apiRequest("/mvp-voting/manage/status", {
    method: "PATCH",
    token,
    body: { status },
  });
}

export function uploadMvpImage(token: string, candidateId: number, image: File) {
  const formData = new FormData();
  formData.append("image", image);

  return apiRequest(`/mvp-voting/manage/candidates/${candidateId}/image`, {
    method: "POST",
    token,
    formData,
  });
}

export type MvpPublishError = {
  message: string;
  needsManualPick?: boolean;
  tiedCandidateIds?: number[];
  voteCount?: number;
};

export function publishMvpWinner(token: string, candidateId?: number) {
  return apiRequest("/mvp-voting/manage/publish", {
    method: "POST",
    token,
    ...(candidateId === undefined ? {} : { body: { candidateId } }),
  });
}
