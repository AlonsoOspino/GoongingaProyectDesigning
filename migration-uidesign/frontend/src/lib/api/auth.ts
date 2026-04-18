import { apiRequest } from "@/lib/api/client";
import type { LoginResponse } from "@/lib/api/types";

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
