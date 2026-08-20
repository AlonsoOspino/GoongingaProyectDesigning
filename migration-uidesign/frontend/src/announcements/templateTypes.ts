import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";
import type { AnnouncementContent, AnnouncementPayload, AnnouncementType } from "@/announcements/types";

export type EditorProps<C extends AnnouncementContent = AnnouncementContent> = { content: C; onChange: (content: C) => void };
export type ViewProps<C extends AnnouncementContent = AnnouncementContent, P extends AnnouncementPayload = AnnouncementPayload> = {
  content: C; payload: P; countdownAt: string | null; now: number; standalone?: boolean; secondary?: boolean;
};
export type AnnouncementTemplate = {
  type: AnnouncementType; label: string; description: string; icon: LucideIcon;
  defaultContent: AnnouncementContent; Editor: ComponentType<EditorProps>; View: ComponentType<ViewProps>;
};
