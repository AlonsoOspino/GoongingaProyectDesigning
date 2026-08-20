export type AnnouncementType = "TOURNAMENT" | "MINIGAME" | "CUSTOM" | "FORM";

export type TournamentContent = { matchId: number | null; headline: string };
export type MinigameContent = { minigameSlug: string; ctaLabel: string };
export type CustomContent = { eyebrow: string; headline: string; body: string; imageUrl: string; ctaLabel: string; ctaHref: string };
export type FormContent = { headline: string; body: string; formUrl: string; ctaLabel: string };
export type AnnouncementContent = TournamentContent | MinigameContent | CustomContent | FormContent;

export type Announcement = {
  id: number;
  name: string;
  type: AnnouncementType;
  content: AnnouncementContent;
  countdownAt: string | null;
  published: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type AnnouncementTeam = { id: number; name: string; logo: string | null };
export type AnnouncementMatch = {
  id: number; title: string | null; type: string; bestOf: number;
  status: "SCHEDULED" | "ACTIVE" | "FINISHED";
  startDate: string | null; mapWinsTeamA: number; mapWinsTeamB: number; gameNumber: number;
  teamA: AnnouncementTeam; teamB: AnnouncementTeam;
};
export type AnnouncementGame = {
  slug: string; title: string; description: string; coverImageUrl: string | null;
  gameType: "JEOPARDY" | "FAMILY_FEUD" | "CUSTOM"; status: "LIVE" | "UNDER_DEVELOPMENT";
  phase: string; updatedAt: string;
};

export type TournamentPayload = { state: "LIVE" | "UPCOMING" | "RESULT" | "IDLE"; match: AnnouncementMatch | null };
export type MinigamePayload = { state: "LIVE" | "IDLE"; game: AnnouncementGame | null };
export type AnnouncementPayload = TournamentPayload | MinigamePayload | null;
export type ActiveAnnouncementEntry = Pick<Announcement, "id" | "name" | "type" | "content" | "countdownAt" | "order"> & { payload: AnnouncementPayload };
export type ActiveAnnouncements = { enabled: boolean; announcements: ActiveAnnouncementEntry[] };
export type AnnouncementSettings = { enabled: boolean; updatedAt: string };
