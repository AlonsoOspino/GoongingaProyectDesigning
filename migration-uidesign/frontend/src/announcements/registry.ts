import { ClipboardList, Gamepad2, Megaphone, Trophy } from "lucide-react";
import type { AnnouncementTemplate } from "@/announcements/templateTypes";
import type { AnnouncementType } from "@/announcements/types";
import { TournamentEditor, TournamentMode } from "@/announcements/TournamentMode";
import { MinigameEditor, MinigameMode } from "@/announcements/MinigameMode";
import { CustomEditor, CustomMode } from "@/announcements/CustomMode";
import { FormEditor, FormMode } from "@/announcements/FormMode";

export const announcementRegistry: Record<AnnouncementType, AnnouncementTemplate> = {
  TOURNAMENT: { type: "TOURNAMENT", label: "Tournament", description: "Live, upcoming, or latest match result.", icon: Trophy, defaultContent: { matchId: null, headline: "" }, Editor: TournamentEditor, View: TournamentMode },
  MINIGAME: { type: "MINIGAME", label: "Minigame", description: "Send signed-in members to a Game Nights activity.", icon: Gamepad2, defaultContent: { minigameSlug: "", ctaLabel: "" }, Editor: MinigameEditor, View: MinigameMode },
  CUSTOM: { type: "CUSTOM", label: "Custom", description: "A flexible headline, message, image, and action.", icon: Megaphone, defaultContent: { eyebrow: "", headline: "", body: "", imageUrl: "", ctaLabel: "", ctaHref: "" }, Editor: CustomEditor, View: CustomMode },
  FORM: { type: "FORM", label: "GGL Form", description: "Promote a registration, survey, or submission form.", icon: ClipboardList, defaultContent: { headline: "", body: "", formUrl: "", ctaLabel: "" }, Editor: FormEditor, View: FormMode },
};
export const announcementTemplates = Object.values(announcementRegistry);
export function getAnnouncementTemplate(type: AnnouncementType) { return announcementRegistry[type]; }
