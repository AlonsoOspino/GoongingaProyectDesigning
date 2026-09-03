import { apiRequest } from "@/lib/api/client";
import type { ActiveAnnouncements, Announcement, AnnouncementContent, AnnouncementSettings, AnnouncementType } from "@/announcements/types";

export function getActiveAnnouncements() {
  return apiRequest<ActiveAnnouncements>("/announcements/active", { cache: "no-store" });
}
export function listAnnouncements(token: string) {
  return apiRequest<Announcement[]>("/announcements", { token, cache: "no-store" });
}
export function createAnnouncement(token: string, payload: { name: string; type: AnnouncementType; content: AnnouncementContent; countdownAt: string | null; published?: boolean }) {
  return apiRequest<Announcement>("/announcements", { method: "POST", token, body: payload });
}
export function updateAnnouncement(token: string, id: number, payload: { name?: string; type?: AnnouncementType; content?: AnnouncementContent; countdownAt?: string | null; published?: boolean }) {
  return apiRequest<Announcement>(`/announcements/${id}`, { method: "PATCH", token, body: payload });
}
export function deleteAnnouncement(token: string, id: number) {
  return apiRequest<{ deleted: true; id: number }>(`/announcements/${id}`, { method: "DELETE", token });
}
export function reorderAnnouncements(token: string, ids: number[]) {
  return apiRequest<{ ids: number[] }>("/announcements/reorder", { method: "PATCH", token, body: { ids } });
}
export function getAnnouncementSettings(token: string) {
  return apiRequest<AnnouncementSettings>("/announcements/settings", { token, cache: "no-store" });
}
export function updateAnnouncementSettings(
  token: string,
  patch: { enabled?: boolean; mode?: "TOURNAMENT" | "CUSTOM"; activeAnnouncementId?: number | null }
) {
  return apiRequest<AnnouncementSettings>("/announcements/settings", { method: "PATCH", token, body: patch });
}

/**
 * Upload an image for a custom announcement.
 *
 * Returns the public URL the announcement stores. The studio used to require
 * hosting the file somewhere else and pasting a link.
 */
export async function uploadAnnouncementImage(token: string, file: File, name?: string) {
  const form = new FormData();
  form.append("image", file);
  if (name) form.append("name", name);

  return apiRequest<{ url: string }>("/announcements/image", {
    method: "POST",
    token,
    formData: form,
  });
}
