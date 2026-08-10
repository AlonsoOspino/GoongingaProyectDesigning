import { apiRequest } from "@/lib/api/client";
import type { ActiveAnnouncement, AnnouncementSettings, AnnouncementMode } from "@/announcements/types";

export function getActiveAnnouncement() {
  return apiRequest<ActiveAnnouncement>("/announcements/active", { cache: "no-store" });
}

export function getAnnouncementSettings(token: string) {
  return apiRequest<AnnouncementSettings>("/announcements/settings", { token, cache: "no-store" });
}

export function updateAnnouncementSettings(
  token: string,
  payload: { activeMode?: AnnouncementMode; enabled?: boolean; config?: Record<string, unknown> },
) {
  return apiRequest<AnnouncementSettings>("/announcements/settings", {
    method: "PATCH",
    token,
    body: payload,
  });
}
