export type AnnouncementMode = "TOURNAMENT" | "JEOPARDY";

export type AnnouncementConfig = {
  countdownAt?: string | null;
  [key: string]: unknown;
};

export type AnnouncementTeam = {
  id: number;
  name: string;
  logo: string | null;
};

export type AnnouncementMatch = {
  id: number;
  title: string | null;
  type: string;
  bestOf: number;
  status: "SCHEDULED" | "ACTIVE" | "PENDINGREGISTERS" | "FINISHED";
  startDate: string | null;
  mapWinsTeamA: number;
  mapWinsTeamB: number;
  gameNumber: number;
  teamA: AnnouncementTeam;
  teamB: AnnouncementTeam;
};

export type TournamentAnnouncementPayload = {
  state: "LIVE" | "UPCOMING" | "IDLE";
  match: AnnouncementMatch | null;
};

export type JeopardyAnnouncementPayload = {
  state: "LIVE" | "IDLE";
  game: {
    slug: string;
    title: string;
    description: string;
    coverImageUrl: string | null;
    phase: "CREATED" | "PICKING_MEMBER" | "PICKING_QUESTION" | "RESPONDING" | "RESPONDED" | "FINALIZED";
    state: Record<string, unknown>;
    updatedAt: string;
  } | null;
};

export type ActiveAnnouncement = {
  enabled: boolean;
  mode: AnnouncementMode;
  config: AnnouncementConfig;
  updatedAt: string;
  payload: TournamentAnnouncementPayload | JeopardyAnnouncementPayload;
};

export type AnnouncementSettings = {
  id: number;
  activeMode: AnnouncementMode;
  enabled: boolean;
  config: AnnouncementConfig;
  updatedById: number | null;
  createdAt: string;
  updatedAt: string;
};
