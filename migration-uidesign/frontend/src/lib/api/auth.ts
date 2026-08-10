import { apiRequest } from "@/lib/api/client";
import type { MemberProfile } from "@/lib/api/types";

export async function getMemberProfileById(userId: number, token: string) {
  return apiRequest<MemberProfile>(`/network-members/players/${userId}`, {
    token,
  });
}

export async function updateMemberProfile(
  token: string,
  userId: number,
  payload: {
    nickname?: string;
    profilePic?: string;
    rank?: number;
    heroVideoFolderPath?: string | null;
    obsWebsocketUrl?: string | null;
    obsWebsocketPassword?: string;
  }
) {
  return apiRequest<MemberProfile>(`/network-members/players/${userId}`, {
    method: "PUT",
    token,
    body: payload,
  });
}
