import { apiRequest } from "@/lib/api/client";
import type { LoginResponse, MemberProfile } from "@/lib/api/types";

export async function login(user: string, password: string) {
  return apiRequest<LoginResponse>("/member/login", {
    method: "POST",
    body: { user, password },
  });
}

export async function registerMember(
  token: string,
  payload: { user: string; password: string; nickname: string }
) {
  return apiRequest("/member/register", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function getMemberProfileById(userId: number) {
  return apiRequest<MemberProfile>(`/member/${userId}`);
}

export async function updateMemberProfile(
  token: string,
  userId: number,
  payload: {
    nickname?: string;
    user?: string;
    password?: string;
    profilePic?: string;
    rank?: number;
  }
) {
  return apiRequest<MemberProfile>(`/member/${userId}`, {
    method: "PUT",
    token,
    body: payload,
  });
}
