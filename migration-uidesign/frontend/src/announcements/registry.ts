import { Gamepad2, Trophy } from "lucide-react";
import type { AnnouncementMode } from "@/announcements/types";

export const announcementModes: Array<{
  id: AnnouncementMode;
  title: string;
  description: string;
  icon: typeof Trophy;
}> = [
  {
    id: "TOURNAMENT",
    title: "Tournament mode",
    description: "Shows the nearest scheduled match or the live score when a match is active.",
    icon: Trophy,
  },
  {
    id: "JEOPARDY",
    title: "Jeopardy Minigame mode",
    description: "Promotes the current Jeopardy game and sends visitors to the Minigames experience.",
    icon: Gamepad2,
  },
];
