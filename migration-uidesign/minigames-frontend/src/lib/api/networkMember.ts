import { apiRequest, getApiBase } from "@/lib/api/client";
import type { NetworkMember, NetworkPlayerProfile } from "@/lib/api/types";

export function getRecentNetworkMembers() {
  return apiRequest<NetworkMember[]>("/network-members/recent?limit=5");
}

export function getDiscordLoginUrl() {
  return `${getApiBase()}/network-auth/discord`;
}

export function getNetworkPlayerProfile(memberId: number, token: string) {
  return apiRequest<NetworkPlayerProfile>(`/network-members/players/${memberId}`, { token });
}
