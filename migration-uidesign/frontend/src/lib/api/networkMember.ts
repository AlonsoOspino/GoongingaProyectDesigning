import { apiRequest, getApiBase } from "@/lib/api/client";
import type { NetworkMember } from "@/lib/api/types";

export function getRecentNetworkMembers() {
  return apiRequest<NetworkMember[]>("/network-members/recent?limit=5");
}

export function getCurrentNetworkMember(token: string) {
  return apiRequest<NetworkMember>("/network-members/me", { token, cache: "no-store" });
}

export interface NetworkMemberCapabilities {
  isAdmin: boolean;
  isCaster: boolean;
  isCaptain: boolean;
  captainOf: Array<{ tournamentId: number; teamId: number }>;
}

export function getNetworkMemberCapabilities(token: string) {
  return apiRequest<NetworkMemberCapabilities>("/network-members/me/capabilities", {
    token,
    cache: "no-store",
  });
}

export function getNetworkMembersForAdmin(token: string, search = "") {
  return apiRequest<NetworkMember[]>(`/network-members/admin/users?search=${encodeURIComponent(search)}`, { token, cache: "no-store" });
}

export function updateNetworkMemberRoles(token: string, memberId: number, roles: NetworkMember["roles"]) {
  return apiRequest<NetworkMember>(`/network-members/admin/users/${memberId}/roles`, {
    method: "PATCH",
    token,
    body: { roles },
  });
}

export function getDiscordLoginUrl() {
  return `${getApiBase()}/network-auth/discord`;
}
