import { apiRequest, getApiBase } from "@/lib/api/client";
import type { NetworkMember } from "@/lib/api/types";

export function getRecentNetworkMembers() {
  return apiRequest<NetworkMember[]>("/network-members/recent?limit=5");
}

export function getDiscordLoginUrl() {
  return `${getApiBase()}/network-auth/discord`;
}
