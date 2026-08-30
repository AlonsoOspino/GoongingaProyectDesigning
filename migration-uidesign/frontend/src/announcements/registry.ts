import { ClipboardList, Megaphone, Trophy } from "lucide-react";
import type { AnnouncementTemplate } from "@/announcements/templateTypes";
import type { AnnouncementType } from "@/announcements/types";
import { TournamentEditor, TournamentMode } from "@/announcements/TournamentMode";
import { CustomEditor, CustomMode } from "@/announcements/CustomMode";
import { FormEditor, FormMode } from "@/announcements/FormMode";

/*
 * Partial on purpose. Minigames moved to their own site, so MINIGAME is still a
 * type the backend can return for rows published before the split, but nothing
 * here renders or authors it any more. Callers must handle a missing template
 * rather than assume every stored type still has one.
 */
export const announcementRegistry: Partial<Record<AnnouncementType, AnnouncementTemplate>> = {
  TOURNAMENT: { type: "TOURNAMENT", label: "Tournament", description: "Live, upcoming, or latest match result.", icon: Trophy, defaultContent: { matchId: null, headline: "" }, Editor: TournamentEditor, View: TournamentMode },
  CUSTOM: { type: "CUSTOM", label: "Custom", description: "A flexible headline, message, image, and action.", icon: Megaphone, defaultContent: { eyebrow: "", headline: "", body: "", imageUrl: "", ctaLabel: "", ctaHref: "" }, Editor: CustomEditor, View: CustomMode },
  FORM: { type: "FORM", label: "GGL Form", description: "Promote a registration, survey, or submission form.", icon: ClipboardList, defaultContent: { headline: "", body: "", formUrl: "", ctaLabel: "" }, Editor: FormEditor, View: FormMode },
};

export const announcementTemplates = Object.values(announcementRegistry).filter(
  (template): template is AnnouncementTemplate => Boolean(template)
);

export function getAnnouncementTemplate(type: AnnouncementType): AnnouncementTemplate | undefined {
  return announcementRegistry[type];
}
